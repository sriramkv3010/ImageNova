# ImageNova — Digital Image Processing Visualiser

A stunning, one-stop visualisation platform for image processing algorithms from Gonzalez & Woods *Digital Image Processing* (4th Edition), Chapters 7, 8, and 10.

## Quick Start (Local — No Docker)

```bash
cd imgnova
chmod +x start.sh
./start.sh
```

Open **http://localhost:3000** in your browser.

---

## Deploy with Docker (Recommended)

```bash
cd imgnova
docker-compose up --build
```

Open **http://localhost:3000**

To run in background:
```bash
docker-compose up --build -d
docker-compose logs -f   # view logs
docker-compose down      # stop
```

---

## 🔧 Manual Setup

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (any static server)
```bash
cd frontend
python3 -m http.server 3000
# OR: npx serve . -p 3000
# OR: open index.html directly (some API calls may need CORS)
```

---

## Covered Algorithms from Digital Image Processing Book by Gonzales and Wood

### Chapter 7 — Wavelet Transforms
| Algorithm | Features |
|-----------|----------|
| Haar Decomposition | Multi-level subbands, 3D energy bars, energy distribution chart |
| Wavelet Families | Haar, db2/4/8, Symlet, Coiflet, Biorthogonal — filter visualization |
| Reconstruction & PSNR | Threshold coefficients, PSNR vs threshold curve builder |

### Chapter 8 — Image Compression
| Algorithm | Features |
|-----------|----------|
| DCT Block Coding | 8×8 block steps, quantization matrix, 3D coefficient landscape, PSNR curve |
| Huffman Coding | Frequency chart, code table, compression stats |
| Bit-Plane Decomposition | 8 clickable planes, progressive reconstruction, PSNR by bits |
| Run-Length Encoding | Visual row segments, per-row compression comparison |
| Wavelet Compression | Threshold slider, dual-axis quality/compression chart |

### Chapter 10 — Image Segmentation
| Algorithm | Features |
|-----------|----------|
| Padding & Convolution | 3D kernel stepper (auto/manual), all 4 padding types, formula display |
| Pooling Operations | Max/Avg/Min, 3D input→output tower comparison, reduction stats |
| Edge Detection | Canny (6-step pipeline), Sobel, Prewitt, Laplacian |
| Otsu Thresholding | Histogram overlay with between-class variance curve, threshold marker |
| K-Means Segmentation | Iteration stepper with auto-play, inertia convergence, cluster centers |
| Watershed | Distance transform pipeline, animated 3D terrain with rising water |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Step through iterations (K-Means, Padding, Haar levels, DCT quality) |
| `Esc` | Toggle sidebar |
| `U` | Open file upload dialog |

---

## 🛠 Tech Stack

- **Frontend**: Vanilla JS + Three.js (r128) + Chart.js 4 + Orbitron/JetBrains Mono fonts
- **Backend**: FastAPI + NumPy + Pillow + PyWavelets + SciPy
- **Deployment**: Docker + Nginx (frontend) + Uvicorn (backend)

---

## 🌐 Deploy to Cloud

### Render.com (free tier)
1. Push to GitHub
2. Create two services: Web Service (backend) + Static Site (frontend)
3. Set backend URL in `frontend/js/api.js` → `API_BASE`

### Railway / Fly.io
Use the provided `docker-compose.yml` — both platforms support compose-based deploys.

### VPS (DigitalOcean, Linode, etc.)
```bash
git clone <your-repo>
cd imgviz
docker-compose up -d
# Configure your domain to point to port 3000
```
