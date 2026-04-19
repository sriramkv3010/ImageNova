// views/padding.js — Padding & Convolution Visualization
window.views.padding = {
  render() {
    return `
      ${makeViewHeader('Chapter 10 — Image Segmentation', 'PADDING & CONVOLUTION',
        'Padding adds border pixels before convolution to control output size. Zero/Reflect/Replicate/Circular modes fill borders differently. Stride controls how the kernel steps — larger strides produce smaller outputs.'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Padding Type</div>
          <select class="ctrl-select" id="pad-type" onchange="paddingRun()">
            <option value="zero">Zero Padding</option>
            <option value="reflect">Reflect Padding</option>
            <option value="replicate">Replicate (Edge)</option>
            <option value="circular">Circular Wrap</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Kernel Size</div>
          <select class="ctrl-select" id="pad-kernel" onchange="paddingRun()">
            <option value="3" selected>3×3</option>
            <option value="5">5×5</option>
            <option value="7">7×7</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Stride: <span class="ctrl-val" id="pad-stride-val">1</span></div>
          <input type="range" class="ctrl-range" id="pad-stride" min="1" max="4" step="1" value="1"
            oninput="document.getElementById('pad-stride-val').textContent=this.value; paddingRun()"/>
        </div>
        <button class="btn btn-primary" onclick="paddingRun()">▶ Apply</button>
      </div>

      <div id="pad-wrap" style="position:relative">
        <div class="stats-row" id="pad-stats"></div>

        <div class="grid-3" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Input</div>
            <div class="img-box" style="min-height:160px">
              <img id="pad-original" src="" alt=""/>
              <div class="img-badge" id="pad-in-badge">—</div>
            </div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Padded Image</div>
            <div class="img-box" style="min-height:160px">
              <img id="pad-padded" src="" alt=""/>
              <div class="img-badge" id="pad-pad-badge">—</div>
            </div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Output (after conv)</div>
            <div class="img-box" style="min-height:160px">
              <img id="pad-output" src="" alt=""/>
              <div class="img-badge" id="pad-out-badge">—</div>
            </div>
          </div>
        </div>

        <div class="section-label">3D Convolution Kernel Stepper</div>
        <div class="card card-accent-cyan" style="margin-bottom:16px">
          <div class="card-title">Interactive — Watch the Kernel Slide Across the Padded Image</div>
          <div class="viz-canvas" id="pad-3d-canvas" style="min-height:300px"></div>
          <div class="iter-controls" style="margin-top:12px">
            <button class="iter-btn" onclick="padStepPrev()">◀</button>
            <div class="iter-display" id="pad-step-label">Step 0 / 0</div>
            <button class="iter-btn" onclick="padStepNext()">▶</button>
            <button class="btn btn-secondary" id="pad-auto-btn" onclick="padToggleAuto()">▶ Auto Play</button>
            <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim)">← → keys also work</span>
          </div>
        </div>

        <div class="section-label">Output Size Formula</div>
        <div class="card">
          <div id="pad-formula" style="font-family:var(--font-mono);font-size:13px;color:var(--cyan);text-align:center;padding:12px"></div>
        </div>
      </div>
    `;
  },
  init() {
    paddingRun();
  }
};

let _padData = null;
let _padStep = 0;
let _padAutoInterval = null;
let _padRenderer = null;
let _padAnimId = null;
let _padKernelBox = null;
let _padScene = null;
let _padCamera = null;

function padStepNext() {
  if (!_padData) return;
  const total = _padData.shapes.output[0] * _padData.shapes.output[1];
  _padStep = (_padStep + 1) % Math.max(1, total);
  padUpdateStep();
}
function padStepPrev() {
  if (!_padData) return;
  const total = _padData.shapes.output[0] * _padData.shapes.output[1];
  _padStep = (_padStep - 1 + total) % Math.max(1, total);
  padUpdateStep();
}
function padToggleAuto() {
  const btn = document.getElementById('pad-auto-btn');
  if (!btn) return;
  if (_padAutoInterval) {
    clearInterval(_padAutoInterval);
    _padAutoInterval = null;
    btn.textContent = '▶ Auto Play';
  } else {
    _padAutoInterval = setInterval(padStepNext, 80);
    btn.textContent = '⏸ Pause';
  }
}

function padUpdateStep() {
  if (!_padData) return;
  const outH = _padData.shapes.output[0];
  const outW = _padData.shapes.output[1];
  const total = outH * outW;
  const row = Math.floor(_padStep / outW);
  const col = _padStep % outW;
  const lbl = document.getElementById('pad-step-label');
  if (lbl) lbl.textContent = `Step ${_padStep + 1} / ${total} — (row ${row}, col ${col})`;

  // Move kernel box in 3D
  if (_padKernelBox && _padData) {
    const stride = _padData.stride;
    const ks = _padData.kernel_size;
    const padN = _padData.shapes.padded[0];
    const kx = (col * stride) - padN / 2 + ks / 2;
    const kz = (row * stride) - padN / 2 + ks / 2;
    _padKernelBox.userData.targetX = kx;
    _padKernelBox.userData.targetZ = kz;
  }
}

async function paddingRun() {
  const padding_type = document.getElementById('pad-type').value;
  const kernel_size = document.getElementById('pad-kernel').value;
  const stride = document.getElementById('pad-stride').value;
  showLoading('pad-wrap');
  try {
    const data = await apiCall('/api/padding/visualize', window._uploadedFile, { padding_type, kernel_size, stride });
    _padData = data;
    _padStep = 0;

    setImage('pad-original', data.original);
    setImage('pad-padded', data.padded);
    setImage('pad-output', data.output);

    document.getElementById('pad-in-badge').textContent = `${data.shapes.input[0]}×${data.shapes.input[1]}`;
    document.getElementById('pad-pad-badge').textContent = `${data.shapes.padded[0]}×${data.shapes.padded[1]}`;
    document.getElementById('pad-out-badge').textContent = `${data.shapes.output[0]}×${data.shapes.output[1]}`;

    document.getElementById('pad-stats').innerHTML = `
      <div class="stat-chip">Input: <strong>${data.shapes.input[0]}×${data.shapes.input[1]}</strong></div>
      <div class="stat-chip">Pad: <strong>${data.padding_type}</strong></div>
      <div class="stat-chip">Kernel: <strong>${data.kernel_size}×${data.kernel_size}</strong></div>
      <div class="stat-chip">Stride: <strong>${data.stride}</strong></div>
      <div class="stat-chip">Output: <strong>${data.shapes.output[0]}×${data.shapes.output[1]}</strong></div>
    `;

    const ks = data.kernel_size;
    const p = Math.floor(ks / 2);
    const H = data.shapes.input[0], W = data.shapes.input[1];
    const s = data.stride;
    document.getElementById('pad-formula').textContent =
      `Output H = ⌊(${H} − ${ks} + 2×${p}) / ${s}⌋ + 1 = ${data.shapes.output[0]}   |   Output W = ⌊(${W} − ${ks} + 2×${p}) / ${s}⌋ + 1 = ${data.shapes.output[1]}`;

    padInit3D(data);
    padUpdateStep();
  } catch (e) { showError('pad-wrap', e.message); }
  hideLoading('pad-wrap');
}

function padInit3D(data) {
  if (!window.THREE) return;
  const container = document.getElementById('pad-3d-canvas');
  if (!container) return;

  if (_padAnimId) cancelAnimationFrame(_padAnimId);
  if (_padRenderer) { _padRenderer.dispose(); container.innerHTML = ''; }

  const W = container.clientWidth || 700;
  const H = 300;
  _padRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _padRenderer.setSize(W, H);
  _padRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _padRenderer.setClearColor(0x000000, 0);
  container.appendChild(_padRenderer.domElement);

  _padScene = new THREE.Scene();
  _padCamera = new THREE.PerspectiveCamera(48, W / H, 0.1, 500);
  _padCamera.position.set(0, 18, 22);
  _padCamera.lookAt(0, 0, 0);

  _padScene.add(new THREE.AmbientLight(0x223355, 5));
  const dl = new THREE.DirectionalLight(0x00f5ff, 6);
  dl.position.set(15, 25, 15);
  _padScene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xff6b35, 4);
  dl2.position.set(-10, 10, -10);
  _padScene.add(dl2);

  const inH = data.shapes.input[0], inW = data.shapes.input[1];
  const padH = data.shapes.padded[0], padW = data.shapes.padded[1];
  const pad = data.kernel_size >> 1;

  // Draw padded image as grid of voxels
  const cellSize = Math.min(0.8, 14 / padH);
  const offX = -(padW * cellSize) / 2;
  const offZ = -(padH * cellSize) / 2;

  for (let r = 0; r < padH; r++) {
    for (let c = 0; c < padW; c++) {
      const isPad = r < pad || r >= padH - pad || c < pad || c >= padW - pad;
      const geo = new THREE.BoxGeometry(cellSize * 0.88, isPad ? 0.15 : 0.25, cellSize * 0.88);
      const mat = new THREE.MeshPhongMaterial({
        color: isPad ? 0x8b5cf6 : 0x1a3a5c,
        emissive: isPad ? 0x3b1f8c : 0x0a1829,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: isPad ? 0.7 : 0.85,
        shininess: 40
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offX + c * cellSize + cellSize / 2, 0, offZ + r * cellSize + cellSize / 2);
      _padScene.add(mesh);
    }
  }

  // Kernel highlight box
  const ks = data.kernel_size;
  const kernelGeo = new THREE.BoxGeometry(ks * cellSize + 0.15, 0.6, ks * cellSize + 0.15);
  const kernelMat = new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.5, wireframe: false });
  _padKernelBox = new THREE.Mesh(kernelGeo, kernelMat);
  _padKernelBox.position.set(offX + pad * cellSize, 0.25, offZ + pad * cellSize);
  _padKernelBox.userData.targetX = offX + pad * cellSize;
  _padKernelBox.userData.targetZ = offZ + pad * cellSize;
  _padScene.add(_padKernelBox);

  // Kernel wireframe outline
  const kernelEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(kernelGeo),
    new THREE.LineBasicMaterial({ color: 0xff6b35 })
  );
  kernelEdge.position.copy(_padKernelBox.position);
  _padScene.add(kernelEdge);
  _padKernelBox.userData.edgeMesh = kernelEdge;

  // Grid floor
  const grid = new THREE.GridHelper(Math.max(padH, padW) * cellSize + 2, 20, 0x0a1a2e, 0x071020);
  _padScene.add(grid);

  let t = 0;
  function animate() {
    _padAnimId = requestAnimationFrame(animate);
    t += 0.007;

    // Smooth kernel movement
    if (_padKernelBox) {
      const tx = _padKernelBox.userData.targetX || _padKernelBox.position.x;
      const tz = _padKernelBox.userData.targetZ || _padKernelBox.position.z;
      _padKernelBox.position.x += (tx - _padKernelBox.position.x) * 0.18;
      _padKernelBox.position.z += (tz - _padKernelBox.position.z) * 0.18;

      if (_padKernelBox.userData.edgeMesh) {
        _padKernelBox.userData.edgeMesh.position.copy(_padKernelBox.position);
      }
      // Pulse opacity
      _padKernelBox.material.opacity = 0.4 + 0.15 * Math.sin(t * 3);
    }

    // Gentle camera orbit
    _padCamera.position.x = Math.sin(t * 0.15) * 22;
    _padCamera.position.z = Math.cos(t * 0.15) * 22;
    _padCamera.position.y = 16 + Math.sin(t * 0.1) * 2;
    _padCamera.lookAt(0, 0, 0);

    _padRenderer.render(_padScene, _padCamera);
  }
  animate();
}
