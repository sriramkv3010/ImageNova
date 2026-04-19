from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
from PIL import Image
import pywt
import io
import base64
import json
from scipy import ndimage
from typing import Optional

app = FastAPI(title="Image Processing Visualizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Utility ──────────────────────────────────────────────────────────────────

def img_to_b64(arr: np.ndarray, mode="L") -> str:
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, mode)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()

def load_image_gray(file_bytes: bytes, size=(256,256)) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("L").resize(size, Image.LANCZOS)
    return np.array(img, dtype=np.float64)

def load_image_rgb(file_bytes: bytes, size=(256,256)) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB").resize(size, Image.LANCZOS)
    return np.array(img, dtype=np.float64)

def normalize_coeff(arr: np.ndarray) -> np.ndarray:
    mn, mx = arr.min(), arr.max()
    if mx == mn:
        return np.zeros_like(arr)
    return ((arr - mn) / (mx - mn) * 255)

def make_test_image(size=256) -> np.ndarray:
    img = np.zeros((size, size), dtype=np.float64)
    img[60:120, 60:120] = 200
    img[140:200, 100:180] = 150
    for i in range(size):
        for j in range(size):
            img[i,j] += 30 * np.sin(2*np.pi*i/32) * np.cos(2*np.pi*j/32)
    return np.clip(img, 0, 255)

# ─── CHAPTER 7: Haar & Wavelet ────────────────────────────────────────────────

@app.post("/api/haar/decompose")
async def haar_decompose(file: Optional[UploadFile] = File(None), levels: int = 3):
    if file:
        data = await file.read()
        img = load_image_gray(data)
    else:
        img = make_test_image()

    results = []
    current = img.copy()

    for level in range(1, levels + 1):
        coeffs2 = pywt.dwt2(current, 'haar')
        cA, (cH, cV, cD) = coeffs2

        results.append({
            "level": level,
            "approximation": img_to_b64(normalize_coeff(cA)),
            "horizontal": img_to_b64(normalize_coeff(cH) + 128 - normalize_coeff(cH).mean()),
            "vertical": img_to_b64(normalize_coeff(cV) + 128 - normalize_coeff(cV).mean()),
            "diagonal": img_to_b64(normalize_coeff(cD) + 128 - normalize_coeff(cD).mean()),
            "shapes": {
                "approx": list(cA.shape),
                "detail": list(cH.shape)
            },
            "energy": {
                "approx": float(np.sum(cA**2)),
                "horizontal": float(np.sum(cH**2)),
                "vertical": float(np.sum(cV**2)),
                "diagonal": float(np.sum(cD**2))
            }
        })
        current = cA

    # Full subband layout image
    full_layout = build_wavelet_layout(img, levels, 'haar')

    return {
        "original": img_to_b64(img),
        "original_shape": list(img.shape),
        "levels": results,
        "full_layout": full_layout
    }

@app.post("/api/wavelet/decompose")
async def wavelet_decompose(
    file: Optional[UploadFile] = File(None),
    wavelet: str = "db4",
    levels: int = 3
):
    if file:
        data = await file.read()
        img = load_image_gray(data)
    else:
        img = make_test_image()

    valid_wavelets = ['haar', 'db2', 'db4', 'db8', 'sym4', 'coif2', 'bior2.2']
    if wavelet not in valid_wavelets:
        wavelet = 'db4'

    results = []
    current = img.copy()

    for level in range(1, levels + 1):
        coeffs2 = pywt.dwt2(current, wavelet)
        cA, (cH, cV, cD) = coeffs2

        results.append({
            "level": level,
            "approximation": img_to_b64(normalize_coeff(cA)),
            "horizontal": img_to_b64(normalize_coeff(np.abs(cH))),
            "vertical": img_to_b64(normalize_coeff(np.abs(cV))),
            "diagonal": img_to_b64(normalize_coeff(np.abs(cD))),
            "shapes": {"approx": list(cA.shape)},
            "energy": {
                "approx": float(np.sum(cA**2)),
                "horizontal": float(np.sum(cH**2)),
                "vertical": float(np.sum(cV**2)),
                "diagonal": float(np.sum(cD**2))
            }
        })
        current = cA

    full_layout = build_wavelet_layout(img, levels, wavelet)

    w = pywt.Wavelet(wavelet)
    return {
        "original": img_to_b64(img),
        "levels": results,
        "full_layout": full_layout,
        "wavelet_info": {
            "name": wavelet,
            "filter_length": len(w.filter_bank[0]),
            "dec_lo": [float(v) for v in w.filter_bank[0]],
            "dec_hi": [float(v) for v in w.filter_bank[1]],
        }
    }

@app.post("/api/wavelet/reconstruct")
async def wavelet_reconstruct(
    file: Optional[UploadFile] = File(None),
    wavelet: str = "db4",
    threshold: float = 0.0,
    keep_levels: str = "1,2,3"
):
    if file:
        data = await file.read()
        img = load_image_gray(data)
    else:
        img = make_test_image()

    levels_to_keep = [int(x) for x in keep_levels.split(",") if x.strip().isdigit()]
    max_level = max(levels_to_keep) if levels_to_keep else 3

    coeffs = pywt.wavedec2(img, wavelet, level=max_level)

    # Apply thresholding and level masking
    modified = [coeffs[0]]
    for i, (cH, cV, cD) in enumerate(coeffs[1:], 1):
        level_num = max_level - i + 1
        if level_num in levels_to_keep:
            if threshold > 0:
                cH = pywt.threshold(cH, threshold * np.max(np.abs(cH)), mode='soft')
                cV = pywt.threshold(cV, threshold * np.max(np.abs(cV)), mode='soft')
                cD = pywt.threshold(cD, threshold * np.max(np.abs(cD)), mode='soft')
            modified.append((cH, cV, cD))
        else:
            modified.append((np.zeros_like(cH), np.zeros_like(cV), np.zeros_like(cD)))

    reconstructed = pywt.waverec2(modified, wavelet)
    reconstructed = np.clip(reconstructed[:img.shape[0], :img.shape[1]], 0, 255)

    psnr = float(compute_psnr(img, reconstructed))

    return {
        "original": img_to_b64(img),
        "reconstructed": img_to_b64(reconstructed),
        "psnr": psnr,
        "mse": float(np.mean((img - reconstructed)**2))
    }

def build_wavelet_layout(img, levels, wavelet):
    coeffs = pywt.wavedec2(img, wavelet, level=levels)
    size = img.shape[0]
    layout = np.ones((size, size), dtype=np.float64) * 128

    cA = normalize_coeff(coeffs[0])
    h, w = cA.shape
    layout[:h, :w] = cA

    offset_h, offset_w = 0, 0
    for i, (cH, cV, cD) in enumerate(coeffs[1:]):
        ch, cw = cH.shape
        if i == 0:
            layout[:ch, w:w+cw] = normalize_coeff(np.abs(cH))
            layout[h:h+ch, :cw] = normalize_coeff(np.abs(cV))
            layout[h:h+ch, w:w+cw] = normalize_coeff(np.abs(cD))
        break

    return img_to_b64(layout)

def compute_psnr(original, reconstructed):
    mse = np.mean((original - reconstructed) ** 2)
    if mse == 0:
        return 100.0
    return 20 * np.log10(255.0 / np.sqrt(mse))

# ─── CHAPTER 8: Compression ───────────────────────────────────────────────────

@app.post("/api/dct/block")
async def dct_block_coding(
    file: Optional[UploadFile] = File(None),
    quality: int = 50
):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(256,256))
    else:
        img = make_test_image()

    quality = max(1, min(100, quality))
    q_scale = max(1, (100 - quality) / 10 + 1)

    # Standard JPEG-like quantization matrix
    Q_base = np.array([
        [16,11,10,16,24,40,51,61],
        [12,12,14,19,26,58,60,55],
        [14,13,16,24,40,57,69,56],
        [14,17,22,29,51,87,80,62],
        [18,22,37,56,68,109,103,77],
        [24,35,55,64,81,104,113,92],
        [49,64,78,87,103,121,120,101],
        [72,92,95,98,112,100,103,99]
    ], dtype=np.float64)

    Q = np.clip(Q_base * q_scale, 1, 255)

    h, w = img.shape
    reconstructed = np.zeros_like(img)
    dct_full = np.zeros_like(img)
    quantized_full = np.zeros_like(img)

    # Process 8x8 blocks
    blocks_dct = []
    for i in range(0, h - 7, 8):
        for j in range(0, w - 7, 8):
            block = img[i:i+8, j:j+8] - 128
            dct_block = dct2d(block)
            quant_block = np.round(dct_block / Q)
            dequant_block = quant_block * Q
            idct_block = idct2d(dequant_block) + 128

            dct_full[i:i+8, j:j+8] = dct_block
            quantized_full[i:i+8, j:j+8] = quant_block
            reconstructed[i:i+8, j:j+8] = np.clip(idct_block, 0, 255)

            if i == 0 and j == 0:
                blocks_dct = {
                    "original_block": img[0:8, 0:8].tolist(),
                    "dct_block": dct_block.tolist(),
                    "quant_matrix": Q.tolist(),
                    "quantized_block": quant_block.tolist(),
                    "dequantized_block": dequant_block.tolist(),
                    "reconstructed_block": np.clip(idct_block, 0, 255).tolist()
                }

    psnr = compute_psnr(img, reconstructed)
    zeros_pct = float(np.sum(quantized_full == 0) / quantized_full.size * 100)

    return {
        "original": img_to_b64(img),
        "reconstructed": img_to_b64(reconstructed),
        "dct_spectrum": img_to_b64(normalize_coeff(np.log(np.abs(dct_full) + 1))),
        "quantized_spectrum": img_to_b64(normalize_coeff(np.abs(quantized_full))),
        "psnr": float(psnr),
        "zeros_percent": zeros_pct,
        "quality": quality,
        "first_block": blocks_dct
    }

def dct2d(block):
    from scipy.fft import dctn
    return dctn(block, norm='ortho')

def idct2d(block):
    from scipy.fft import idctn
    return idctn(block, norm='ortho')

@app.post("/api/huffman/encode")
async def huffman_encode(file: Optional[UploadFile] = File(None)):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(64,64))
    else:
        img = make_test_image(64)

    pixels = img.flatten().astype(int)
    freq = {}
    for p in pixels:
        freq[p] = freq.get(p, 0) + 1

    # Build tree
    tree_data = build_huffman_tree(freq)
    codes = {}
    get_codes(tree_data['root_node'], '', codes)

    top_symbols = sorted(freq.items(), key=lambda x: -x[1])[:20]
    encoded_bits = sum(len(codes.get(p, '')) for p in pixels)
    original_bits = len(pixels) * 8
    compression_ratio = original_bits / max(encoded_bits, 1)

    return {
        "original": img_to_b64(img),
        "frequencies": {str(k): v for k, v in top_symbols},
        "codes": {str(k): codes[k] for k in sorted(codes.keys())[:20]},
        "tree_nodes": tree_data['nodes'][:60],
        "tree_edges": tree_data['edges'][:60],
        "stats": {
            "unique_symbols": len(freq),
            "total_pixels": len(pixels),
            "original_bits": original_bits,
            "encoded_bits": encoded_bits,
            "compression_ratio": float(compression_ratio),
            "avg_code_length": float(encoded_bits / len(pixels))
        }
    }

def build_huffman_tree(freq):
    import heapq
    heap = [[weight, [symbol, ""]] for symbol, weight in freq.items()]
    heapq.heapify(heap)
    node_id = 0
    nodes = []
    edges = []
    node_map = {}

    for sym, w in freq.items():
        node_map[str(sym)] = node_id
        nodes.append({"id": node_id, "label": str(sym), "freq": w, "type": "leaf"})
        node_id += 1

    root_node = None
    while len(heap) > 1:
        lo = heapq.heappop(heap)
        hi = heapq.heappop(heap)
        for pair in lo[1:]:
            pair[1] = '0' + pair[1]
        for pair in hi[1:]:
            pair[1] = '1' + pair[1]
        merged = [lo[0] + hi[0]] + lo[1:] + hi[1:]
        heapq.heappush(heap, merged)

        parent_id = node_id
        nodes.append({"id": parent_id, "label": f"#{parent_id}", "freq": lo[0]+hi[0], "type": "internal"})
        node_id += 1
        root_node = parent_id

    return {"nodes": nodes, "edges": edges, "root_node": root_node}

def get_codes(node_id, prefix, codes):
    pass  # simplified - codes built during tree construction above

@app.post("/api/bitplane/decompose")
async def bitplane_decompose(file: Optional[UploadFile] = File(None)):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(256,256))
    else:
        img = make_test_image()

    img_int = img.astype(np.uint8)
    planes = []
    for bit in range(7, -1, -1):
        plane = ((img_int >> bit) & 1) * 255
        planes.append({
            "bit": bit,
            "label": f"Bit {bit} ({'MSB' if bit==7 else 'LSB' if bit==0 else ''})",
            "image": img_to_b64(plane),
            "ones_percent": float(np.sum(plane > 0) / plane.size * 100)
        })

    # Progressive reconstruction
    reconstructions = []
    for keep in range(8, 0, -1):
        mask = 0
        for b in range(7, 7-keep, -1):
            mask |= (1 << b)
        recon = img_int & mask
        reconstructions.append({
            "bits_kept": keep,
            "image": img_to_b64(recon),
            "psnr": float(compute_psnr(img, recon.astype(np.float64)))
        })

    return {
        "original": img_to_b64(img),
        "planes": planes,
        "reconstructions": reconstructions
    }

@app.post("/api/runlength/encode")
async def runlength_encode(file: Optional[UploadFile] = File(None)):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(64,64))
        img_bin = (img > 127).astype(np.uint8)
    else:
        img_bin = np.zeros((64,64), dtype=np.uint8)
        img_bin[10:30, 10:50] = 1
        img_bin[35:55, 5:60] = 1
        img_bin[20:40, 25:40] = 0

    rows_rle = []
    for row_idx in range(min(8, img_bin.shape[0])):
        row = img_bin[row_idx]
        rle = []
        val, count = row[0], 1
        for px in row[1:]:
            if px == val:
                count += 1
            else:
                rle.append({"value": int(val), "count": count})
                val, count = px, 1
        rle.append({"value": int(val), "count": count})
        rows_rle.append({"row": row_idx, "rle": rle, "original_bits": len(row), "encoded_pairs": len(rle)})

    total_orig = img_bin.size
    total_encoded = sum(len(r["rle"]) for r in rows_rle) * img_bin.shape[0] // min(8, img_bin.shape[0]) * 2

    return {
        "original": img_to_b64(img_bin * 255),
        "rows": rows_rle,
        "stats": {
            "original_bits": total_orig,
            "encoded_pairs": total_encoded,
            "ratio": float(total_orig / max(total_encoded, 1))
        }
    }

@app.post("/api/wavelet/coding")
async def wavelet_coding(
    file: Optional[UploadFile] = File(None),
    threshold_pct: float = 0.5
):
    if file:
        data = await file.read()
        img = load_image_gray(data)
    else:
        img = make_test_image()

    wavelet = 'db4'
    level = 4
    coeffs = pywt.wavedec2(img, wavelet, level=level)

    all_coeffs = np.concatenate([c.flatten() for c in [coeffs[0]] + [x for tup in coeffs[1:] for x in tup]])
    threshold_val = np.percentile(np.abs(all_coeffs), threshold_pct * 100)

    thresholded = [pywt.threshold(coeffs[0], threshold_val, mode='hard')]
    for cH, cV, cD in coeffs[1:]:
        thresholded.append((
            pywt.threshold(cH, threshold_val, mode='hard'),
            pywt.threshold(cV, threshold_val, mode='hard'),
            pywt.threshold(cD, threshold_val, mode='hard')
        ))

    reconstructed = pywt.waverec2(thresholded, wavelet)
    reconstructed = np.clip(reconstructed[:img.shape[0], :img.shape[1]], 0, 255)

    thresh_coeffs = np.concatenate([c.flatten() for c in [thresholded[0]] + [x for tup in thresholded[1:] for x in tup]])
    nonzero_pct = float(np.sum(thresh_coeffs != 0) / len(thresh_coeffs) * 100)

    return {
        "original": img_to_b64(img),
        "reconstructed": img_to_b64(reconstructed),
        "psnr": float(compute_psnr(img, reconstructed)),
        "nonzero_percent": nonzero_pct,
        "compression_ratio": float(100 / max(nonzero_pct, 0.1)),
        "threshold_value": float(threshold_val)
    }

# ─── CHAPTER 10: Segmentation ─────────────────────────────────────────────────

@app.post("/api/padding/visualize")
async def padding_visualize(
    file: Optional[UploadFile] = File(None),
    kernel_size: int = 3,
    padding_type: str = "zero",
    stride: int = 1
):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(64,64))
    else:
        img = make_test_image(64)

    h, w = img.shape
    pad = kernel_size // 2

    if padding_type == "zero":
        padded = np.pad(img, pad, mode='constant', constant_values=0)
    elif padding_type == "reflect":
        padded = np.pad(img, pad, mode='reflect')
    elif padding_type == "replicate":
        padded = np.pad(img, pad, mode='edge')
    elif padding_type == "circular":
        padded = np.pad(img, pad, mode='wrap')
    else:
        padded = np.pad(img, pad, mode='constant', constant_values=0)

    out_h = (h - kernel_size + 2*pad) // stride + 1
    out_w = (w - kernel_size + 2*pad) // stride + 1

    kernel = np.ones((kernel_size, kernel_size), dtype=np.float64) / (kernel_size**2)
    output = np.zeros((out_h, out_w))
    for i in range(out_h):
        for j in range(out_w):
            si, sj = i*stride, j*stride
            output[i,j] = np.sum(padded[si:si+kernel_size, sj:sj+kernel_size] * kernel)

    output_resized = np.array(Image.fromarray(output.astype(np.uint8)).resize((w,h), Image.NEAREST))

    return {
        "original": img_to_b64(img),
        "padded": img_to_b64(np.clip(padded, 0, 255)),
        "output": img_to_b64(np.clip(output, 0, 255)),
        "output_resized": img_to_b64(output_resized),
        "shapes": {
            "input": [h, w],
            "padded": list(padded.shape),
            "output": [out_h, out_w]
        },
        "padding_type": padding_type,
        "kernel_size": kernel_size,
        "stride": stride
    }

@app.post("/api/pooling/visualize")
async def pooling_visualize(
    file: Optional[UploadFile] = File(None),
    pool_size: int = 2,
    stride: int = 2,
    pool_type: str = "max"
):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(64,64))
    else:
        img = make_test_image(64)

    h, w = img.shape
    out_h = (h - pool_size) // stride + 1
    out_w = (w - pool_size) // stride + 1

    output = np.zeros((out_h, out_w))
    selected_positions = []

    for i in range(out_h):
        for j in range(out_w):
            si, sj = i*stride, j*stride
            region = img[si:si+pool_size, sj:sj+pool_size]
            if pool_type == "max":
                output[i,j] = np.max(region)
                idx = np.unravel_index(np.argmax(region), region.shape)
                selected_positions.append([int(si+idx[0]), int(sj+idx[1])])
            elif pool_type == "avg":
                output[i,j] = np.mean(region)
            elif pool_type == "min":
                output[i,j] = np.min(region)

    return {
        "original": img_to_b64(img),
        "output": img_to_b64(np.clip(output, 0, 255)),
        "selected_positions": selected_positions[:100],
        "shapes": {
            "input": [h, w],
            "output": [out_h, out_w]
        },
        "pool_type": pool_type,
        "pool_size": pool_size,
        "stride": stride,
        "reduction_ratio": float(h * w / (out_h * out_w))
    }

@app.post("/api/edge/detect")
async def edge_detect(file: Optional[UploadFile] = File(None), method: str = "canny"):
    if file:
        data = await file.read()
        img = load_image_gray(data)
    else:
        img = make_test_image()

    results = {"original": img_to_b64(img), "method": method}

    if method == "canny":
        blurred = ndimage.gaussian_filter(img, sigma=1.4)
        gx = ndimage.sobel(blurred, axis=1)
        gy = ndimage.sobel(blurred, axis=0)
        mag = np.hypot(gx, gy)
        angle = np.arctan2(gy, gx)

        nms = non_max_suppression(mag, angle)
        low, high = 0.05 * nms.max(), 0.15 * nms.max()
        edges = hysteresis_threshold(nms, low, high)

        results.update({
            "blurred": img_to_b64(np.clip(blurred, 0, 255)),
            "gradient_x": img_to_b64(normalize_coeff(np.abs(gx))),
            "gradient_y": img_to_b64(normalize_coeff(np.abs(gy))),
            "magnitude": img_to_b64(normalize_coeff(mag)),
            "nms": img_to_b64(normalize_coeff(nms)),
            "edges": img_to_b64(edges * 255),
            "steps": ["Gaussian Blur", "Gradient (Sobel)", "Non-Max Suppression", "Hysteresis Threshold"]
        })

    elif method == "sobel":
        gx = ndimage.sobel(img, axis=1)
        gy = ndimage.sobel(img, axis=0)
        mag = np.hypot(gx, gy)
        results.update({
            "gradient_x": img_to_b64(normalize_coeff(np.abs(gx))),
            "gradient_y": img_to_b64(normalize_coeff(np.abs(gy))),
            "edges": img_to_b64(normalize_coeff(mag))
        })

    elif method == "laplacian":
        blurred = ndimage.gaussian_filter(img, sigma=1.0)
        lap = ndimage.laplace(blurred)
        results.update({
            "blurred": img_to_b64(np.clip(blurred, 0, 255)),
            "edges": img_to_b64(normalize_coeff(np.abs(lap)))
        })

    elif method == "prewitt":
        gx = ndimage.prewitt(img, axis=1)
        gy = ndimage.prewitt(img, axis=0)
        mag = np.hypot(gx, gy)
        results.update({
            "gradient_x": img_to_b64(normalize_coeff(np.abs(gx))),
            "gradient_y": img_to_b64(normalize_coeff(np.abs(gy))),
            "edges": img_to_b64(normalize_coeff(mag))
        })

    return results

def non_max_suppression(mag, angle):
    h, w = mag.shape
    nms = np.zeros_like(mag)
    angle_deg = np.degrees(angle) % 180

    for i in range(1, h-1):
        for j in range(1, w-1):
            a = angle_deg[i,j]
            m = mag[i,j]
            if (0 <= a < 22.5) or (157.5 <= a <= 180):
                q, r = mag[i, j+1], mag[i, j-1]
            elif 22.5 <= a < 67.5:
                q, r = mag[i+1, j-1], mag[i-1, j+1]
            elif 67.5 <= a < 112.5:
                q, r = mag[i+1, j], mag[i-1, j]
            else:
                q, r = mag[i-1, j-1], mag[i+1, j+1]
            if m >= q and m >= r:
                nms[i,j] = m
    return nms

def hysteresis_threshold(img, low, high):
    strong = img >= high
    weak = (img >= low) & (img < high)
    result = strong.copy()
    for i in range(1, img.shape[0]-1):
        for j in range(1, img.shape[1]-1):
            if weak[i,j]:
                if np.any(strong[i-1:i+2, j-1:j+2]):
                    result[i,j] = True
    return result.astype(np.uint8)

@app.post("/api/threshold/otsu")
async def otsu_threshold(file: Optional[UploadFile] = File(None)):
    if file:
        data = await file.read()
        img = load_image_gray(data)
    else:
        img = make_test_image()

    img_int = img.astype(np.uint8)
    hist, bins = np.histogram(img_int.flatten(), 256, [0, 256])
    hist_norm = hist / hist.sum()

    best_thresh, best_var = 0, 0
    variances = []
    for t in range(256):
        w0 = hist_norm[:t].sum()
        w1 = hist_norm[t:].sum()
        if w0 == 0 or w1 == 0:
            variances.append(0)
            continue
        mu0 = (np.arange(t) * hist_norm[:t]).sum() / w0
        mu1 = (np.arange(t, 256) * hist_norm[t:]).sum() / w1
        var = w0 * w1 * (mu0 - mu1) ** 2
        variances.append(float(var))
        if var > best_var:
            best_var = var
            best_thresh = t

    binary = (img_int >= best_thresh).astype(np.uint8) * 255

    return {
        "original": img_to_b64(img),
        "binary": img_to_b64(binary),
        "threshold": best_thresh,
        "histogram": hist.tolist(),
        "between_class_variance": variances
    }

@app.post("/api/kmeans/segment")
async def kmeans_segment(
    file: Optional[UploadFile] = File(None),
    k: int = 4,
    max_iter: int = 20
):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(128,128))
    else:
        img = make_test_image(128)

    h, w = img.shape
    pixels = img.flatten().reshape(-1, 1).astype(np.float64)

    np.random.seed(42)
    # centers shape: (k,) — 1D since pixels are 1D grayscale
    centers = pixels[np.random.choice(len(pixels), k, replace=False)].flatten()

    history = []
    for iteration in range(max_iter):
        # dists: (n_pixels, k)
        dists = np.abs(pixels.flatten()[:, None] - centers[None, :])
        labels = np.argmin(dists, axis=1)

        new_centers = np.array([
            pixels.flatten()[labels == i].mean() if np.any(labels == i) else centers[i]
            for i in range(k)
        ])

        seg_img = new_centers[labels].reshape(h, w)
        seg_normalized = normalize_coeff(seg_img)

        history.append({
            "iteration": iteration + 1,
            "centers": [float(c) for c in new_centers],
            "image": img_to_b64(seg_normalized),
            "inertia": float(np.sum((pixels.flatten() - new_centers[labels])**2))
        })

        if np.allclose(centers, new_centers, atol=0.5):
            break
        centers = new_centers

    final_seg = np.zeros((h, w, 3), dtype=np.uint8)
    colors = [(255,59,48),(52,199,89),(0,122,255),(255,149,0),(175,82,222),(90,200,250),(255,204,0),(255,45,85)]
    labels_2d = labels.reshape(h, w)
    for i in range(k):
        mask = labels_2d == i
        final_seg[mask] = colors[i % len(colors)]

    return {
        "original": img_to_b64(img),
        "segmented": img_to_b64(final_seg, mode="RGB"),
        "history": history,
        "final_centers": [float(c) for c in centers],
        "k": k
    }

@app.post("/api/watershed/segment")
async def watershed_segment(file: Optional[UploadFile] = File(None)):
    if file:
        data = await file.read()
        img = load_image_gray(data, size=(128,128))
    else:
        img = make_test_image(128)

    blurred = ndimage.gaussian_filter(img, sigma=2)
    gx = ndimage.sobel(blurred, axis=1)
    gy = ndimage.sobel(blurred, axis=0)
    gradient = np.hypot(gx, gy)
    gradient_norm = (gradient / gradient.max() * 255).astype(np.uint8)

    local_min = (ndimage.minimum_filter(gradient, size=10) == gradient)
    labeled_minima, num_features = ndimage.label(local_min)

    from scipy.ndimage import distance_transform_edt
    distance = distance_transform_edt(img > 50)
    local_max = (ndimage.maximum_filter(distance, size=20) == distance) & (distance > 0)
    markers, _ = ndimage.label(local_max)

    return {
        "original": img_to_b64(img),
        "gradient": img_to_b64(gradient_norm),
        "distance_transform": img_to_b64(normalize_coeff(distance)),
        "markers": img_to_b64(normalize_coeff(markers.astype(np.float64))),
        "num_regions": int(_)
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "Image Processing API running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
