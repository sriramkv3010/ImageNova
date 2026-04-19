// views/pooling.js — Max/Avg/Min Pooling Visualization
window.views.pooling = {
  render() {
    return `
      ${makeViewHeader('Chapter 10 — Image Segmentation', 'POOLING OPERATIONS',
        'Pooling reduces spatial dimensions by summarizing regions. Max pooling keeps the strongest activation, average pooling computes the mean. Essential in CNNs for translation invariance.'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Pool Type</div>
          <select class="ctrl-select" id="pool-type" onchange="poolRun()">
            <option value="max" selected>Max Pooling</option>
            <option value="avg">Average Pooling</option>
            <option value="min">Min Pooling</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Pool Size</div>
          <select class="ctrl-select" id="pool-size" onchange="poolRun()">
            <option value="2" selected>2×2</option>
            <option value="3">3×3</option>
            <option value="4">4×4</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Stride: <span class="ctrl-val" id="pool-stride-val">2</span></div>
          <input type="range" class="ctrl-range" id="pool-stride" min="1" max="4" step="1" value="2"
            oninput="document.getElementById('pool-stride-val').textContent=this.value; poolRun()"/>
        </div>
        <button class="btn btn-primary" onclick="poolRun()">▶ Apply</button>
      </div>

      <div id="pool-wrap" style="position:relative">
        <div class="stats-row" id="pool-stats"></div>

        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Input Image</div>
            <div class="img-box" style="min-height:180px">
              <img id="pool-original" src="" alt=""/>
              <div class="img-badge" id="pool-in-badge">—</div>
            </div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Pooled Output</div>
            <div class="img-box" style="min-height:180px">
              <img id="pool-output" src="" alt=""/>
              <div class="img-badge" id="pool-out-badge">—</div>
            </div>
          </div>
        </div>

        <div class="section-label">3D Pooling Tower — Input vs Output Heights</div>
        <div class="card card-accent-cyan" style="margin-bottom:16px">
          <div class="card-title">3D Spatial Downsampling Visualization</div>
          <div class="viz-canvas" id="pool-3d-canvas" style="min-height:320px"></div>
        </div>

        <div class="section-label">Reduction Analysis</div>
        <div class="card">
          <canvas id="pool-chart" height="100"></canvas>
        </div>
      </div>
    `;
  },
  init() { poolRun(); }
};

let _poolRenderer = null;
let _poolAnimId = null;

async function poolRun() {
  const pool_type = document.getElementById('pool-type').value;
  const pool_size = document.getElementById('pool-size').value;
  const stride = document.getElementById('pool-stride').value;
  showLoading('pool-wrap');
  try {
    const data = await apiCall('/api/pooling/visualize', window._uploadedFile, { pool_type, pool_size, stride });
    setImage('pool-original', data.original);
    setImage('pool-output', data.output);
    document.getElementById('pool-in-badge').textContent = `${data.shapes.input[0]}×${data.shapes.input[1]}`;
    document.getElementById('pool-out-badge').textContent = `${data.shapes.output[0]}×${data.shapes.output[1]}`;
    document.getElementById('pool-stats').innerHTML = `
      <div class="stat-chip">Pool: <strong>${data.pool_type.toUpperCase()} ${data.pool_size}×${data.pool_size}</strong></div>
      <div class="stat-chip">Stride: <strong>${data.stride}</strong></div>
      <div class="stat-chip">Input: <strong>${data.shapes.input[0]}×${data.shapes.input[1]}</strong></div>
      <div class="stat-chip">Output: <strong>${data.shapes.output[0]}×${data.shapes.output[1]}</strong></div>
      <div class="stat-chip">Reduction: <strong>${fmtNum(data.reduction_ratio)}×</strong></div>
    `;

    poolInit3D(data);
    poolDrawChart(data);
  } catch (e) { showError('pool-wrap', e.message); }
  hideLoading('pool-wrap');
}

function poolInit3D(data) {
  if (!window.THREE) return;
  const container = document.getElementById('pool-3d-canvas');
  if (!container) return;

  if (_poolAnimId) cancelAnimationFrame(_poolAnimId);
  if (_poolRenderer) { _poolRenderer.dispose(); container.innerHTML = ''; }

  const W = container.clientWidth || 700;
  const H = 320;
  _poolRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _poolRenderer.setSize(W, H);
  _poolRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _poolRenderer.setClearColor(0x000000, 0);
  container.appendChild(_poolRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500);
  camera.position.set(0, 22, 28);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x223355, 5));
  const dl = new THREE.DirectionalLight(0x00f5ff, 7);
  dl.position.set(20, 30, 20);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xff6b35, 5);
  dl2.position.set(-15, 15, -10);
  scene.add(dl2);

  // Input towers (left side)
  const inH = data.shapes.input[0];
  const inW = data.shapes.input[1];
  const outH = data.shapes.output[0];
  const outW = data.shapes.output[1];
  const ps = data.pool_size;

  const maxDim = Math.max(inH, inW);
  const cellIn = Math.min(0.55, 10 / maxDim);
  const cellOut = Math.min(1.2, 10 / Math.max(outH, outW));

  const offInX = -(inW * cellIn) / 2 - 7;
  const offInZ = -(inH * cellIn) / 2;
  const offOutX = (outW * cellOut) / 2 + 7 - outW * cellOut;
  const offOutZ = -(outH * cellOut) / 2;

  // Input grid — small blocks
  const inStep = Math.max(1, Math.floor(inH / 24));
  for (let r = 0; r < inH; r += inStep) {
    for (let c = 0; c < inW; c += inStep) {
      const h = 0.1 + Math.random() * 0.3;
      const geo = new THREE.BoxGeometry(cellIn * 0.85, h, cellIn * 0.85);
      const mat = new THREE.MeshPhongMaterial({ color: 0x1a4a7c, emissive: 0x0a2040, shininess: 30 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offInX + c * cellIn, h / 2, offInZ + r * cellIn);
      scene.add(mesh);
    }
  }

  // Output towers — larger, taller
  for (let r = 0; r < outH; r++) {
    for (let c = 0; c < outW; c++) {
      const h = 0.3 + Math.random() * 1.8;
      const geo = new THREE.BoxGeometry(cellOut * 0.80, h, cellOut * 0.80);
      const col = data.pool_type === 'max' ? 0xff6b35 : data.pool_type === 'avg' ? 0x00f5ff : 0x8b5cf6;
      const emCol = data.pool_type === 'max' ? 0x8b2a0a : data.pool_type === 'avg' ? 0x005566 : 0x3b1f6c;
      const mat = new THREE.MeshPhongMaterial({
        color: col, emissive: emCol,
        emissiveIntensity: 0.25, shininess: 60,
        transparent: true, opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offOutX + c * cellOut + cellOut / 2, h / 2, offOutZ + r * cellOut + cellOut / 2);
      scene.add(mesh);
    }
  }

  // Arrow mesh connecting input to output
  const arrowGeo = new THREE.ConeGeometry(0.5, 2, 8);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat);
  arrow.rotation.z = -Math.PI / 2;
  arrow.position.set(0, 2, 0);
  scene.add(arrow);

  // Label texts as sprites
  function makeLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 28px JetBrains Mono, monospace';
    ctx.fillText(text, 10, 44);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(6, 1.5, 1);
    return sprite;
  }
  const lblIn = makeLabel(`Input ${inH}×${inW}`, '#00f5ff');
  lblIn.position.set(offInX + (inW * cellIn) / 2, 3.5, offInZ - 1.5);
  scene.add(lblIn);

  const lblOut = makeLabel(`Output ${outH}×${outW}`, '#ff6b35');
  lblOut.position.set(offOutX + (outW * cellOut) / 2, 3.5, offOutZ - 1.5);
  scene.add(lblOut);

  scene.add(new THREE.GridHelper(30, 30, 0x0a1a2e, 0x060e1a));

  let t = 0;
  function animate() {
    _poolAnimId = requestAnimationFrame(animate);
    t += 0.007;
    camera.position.x = Math.sin(t * 0.2) * 30;
    camera.position.z = Math.cos(t * 0.2) * 30;
    camera.position.y = 18 + Math.sin(t * 0.12) * 3;
    camera.lookAt(0, 2, 0);
    _poolRenderer.render(scene, camera);
  }
  animate();
}

function poolDrawChart(data) {
  destroyChart('pool-chart');
  const inPx = data.shapes.input[0] * data.shapes.input[1];
  const outPx = data.shapes.output[0] * data.shapes.output[1];
  new Chart(document.getElementById('pool-chart'), {
    type: 'bar',
    data: {
      labels: ['Input Pixels', 'Output Pixels', 'Reduction Ratio'],
      datasets: [{
        label: 'Value',
        data: [inPx, outPx, parseFloat(fmtNum(data.reduction_ratio))],
        backgroundColor: ['rgba(0,245,255,0.6)', 'rgba(255,107,53,0.6)', 'rgba(139,92,246,0.6)']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } },
        y: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } }
      }
    }
  });
}
