// views/dct.js — DCT Block Coding (JPEG-like)
window.views.dct = {
  render() {
    return `
      ${makeViewHeader('Chapter 8 — Image Compression', 'DCT BLOCK CODING',
        'JPEG-like compression using the Discrete Cosine Transform. Each 8×8 block is transformed, quantized (lossy step), and reconstructed. Lower quality = higher quantization = more compression.'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Quality: <span class="ctrl-val" id="dct-q-val">50</span></div>
          <input type="range" class="ctrl-range" id="dct-quality" min="1" max="100" step="1" value="50"
            oninput="document.getElementById('dct-q-val').textContent=this.value;dctRun()"/>
        </div>
        <button class="btn btn-primary" onclick="dctRun()">▶ Compress</button>
      </div>

      <div id="dct-wrap" style="position:relative">
        <div class="stats-row" id="dct-stats"></div>
        <div class="grid-3" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original</div>
            <div class="img-box" style="min-height:160px"><img id="dct-original" src="" alt=""/></div>
          </div>
          <div class="card">
            <div class="card-title">DCT Spectrum (log scale)</div>
            <div class="img-box" style="min-height:160px"><img id="dct-spectrum" src="" alt=""/></div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Reconstructed</div>
            <div class="img-box" style="min-height:160px">
              <img id="dct-reconstructed" src="" alt=""/>
              <div class="img-badge" id="dct-psnr-badge">PSNR: —</div>
            </div>
          </div>
        </div>

        <div class="section-label">First 8×8 Block Breakdown</div>
        <div class="grid-3" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Block</div>
            <div id="dct-block-orig" class="matrix-container"></div>
          </div>
          <div class="card">
            <div class="card-title">DCT Coefficients</div>
            <div id="dct-block-dct" class="matrix-container"></div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Quantized</div>
            <div id="dct-block-quant" class="matrix-container"></div>
          </div>
        </div>

        <div class="section-label">3D DCT Coefficient Landscape</div>
        <div class="card card-accent-cyan">
          <div class="card-title">First 8×8 Block — 3D DCT Bars</div>
          <div class="viz-canvas" id="dct-3d-canvas" style="min-height:280px"></div>
        </div>

        <div class="section-label">PSNR vs Quality</div>
        <div class="card">
          <canvas id="dct-psnr-chart" height="100"></canvas>
        </div>
      </div>
    `;
  },
  init() {
    _dctPsnrCurve = [];
    dctRun();
  }
};

let _dctData = null;
let _dctPsnrCurve = [];
let _dctRenderer = null;
let _dctAnimId = null;

function dctQualityUp() {
  const el = document.getElementById('dct-quality');
  if (!el) return;
  el.value = Math.min(100, parseInt(el.value) + 5);
  document.getElementById('dct-q-val').textContent = el.value;
  dctRun();
}
function dctQualityDown() {
  const el = document.getElementById('dct-quality');
  if (!el) return;
  el.value = Math.max(1, parseInt(el.value) - 5);
  document.getElementById('dct-q-val').textContent = el.value;
  dctRun();
}

async function dctRun() {
  const quality = document.getElementById('dct-quality').value;
  showLoading('dct-wrap');
  try {
    const data = await apiCall('/api/dct/block', window._uploadedFile, { quality });
    _dctData = data;
    setImage('dct-original', data.original);
    setImage('dct-spectrum', data.dct_spectrum);
    setImage('dct-reconstructed', data.reconstructed);
    document.getElementById('dct-psnr-badge').textContent = `PSNR: ${fmtNum(data.psnr)} dB`;
    document.getElementById('dct-stats').innerHTML = `
      <div class="stat-chip">PSNR: <strong>${fmtNum(data.psnr)} dB</strong></div>
      <div class="stat-chip">Zeros: <strong>${fmtNum(data.zeros_percent)}%</strong></div>
      <div class="stat-chip">Quality: <strong>${data.quality}</strong></div>
    `;

    // Render block matrices
    if (data.first_block) {
      renderMatrix('dct-block-orig', data.first_block.original_block, 'gray');
      renderMatrix('dct-block-dct', data.first_block.dct_block, 'diverging');
      renderMatrix('dct-block-quant', data.first_block.quantized_block, 'diverging');
    }

    // 3D bars
    if (data.first_block) dctInit3D(data.first_block.dct_block);

    // PSNR curve
    const q = parseInt(quality);
    const existing = _dctPsnrCurve.findIndex(d => d.q === q);
    if (existing >= 0) _dctPsnrCurve[existing].psnr = data.psnr;
    else _dctPsnrCurve.push({ q, psnr: data.psnr });
    _dctPsnrCurve.sort((a, b) => a.q - b.q);
    dctDrawPsnrChart();

  } catch (e) { showError('dct-wrap', e.message); }
  hideLoading('dct-wrap');
}

function renderMatrix(containerId, matrix, colorMode) {
  const container = document.getElementById(containerId);
  if (!container || !matrix) return;
  const N = matrix.length;
  const maxVal = Math.max(...matrix.flat().map(Math.abs)) || 1;

  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  container.style.gap = '1px';
  container.innerHTML = '';

  matrix.forEach(row => {
    row.forEach(val => {
      const cell = document.createElement('div');
      cell.style.cssText = `
        display:flex;align-items:center;justify-content:center;
        font-family:var(--font-mono);font-size:7px;padding:4px 1px;
        border-radius:1px;color:rgba(255,255,255,0.85);
      `;
      cell.textContent = Math.round(val);
      let r = 0, g = 0, b = 0, a = 0.8;
      if (colorMode === 'gray') {
        const v = Math.round(val);
        const lum = Math.round(v * 0.8);
        cell.style.background = `rgb(${lum},${lum},${lum})`;
        cell.style.color = v > 128 ? '#000' : '#fff';
      } else {
        const norm = val / maxVal;
        if (norm > 0) cell.style.background = `rgba(0,245,255,${Math.min(0.9, norm * 0.8)})`;
        else cell.style.background = `rgba(255,107,53,${Math.min(0.9, -norm * 0.8)})`;
      }
      container.appendChild(cell);
    });
  });
}

function dctInit3D(dctBlock) {
  if (!window.THREE) return;
  const container = document.getElementById('dct-3d-canvas');
  if (!container) return;

  if (_dctAnimId) cancelAnimationFrame(_dctAnimId);
  if (_dctRenderer) { _dctRenderer.dispose(); container.innerHTML = ''; }

  const W = container.clientWidth || 600;
  const H = 280;
  _dctRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _dctRenderer.setSize(W, H);
  _dctRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _dctRenderer.setClearColor(0x000000, 0);
  container.appendChild(_dctRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500);
  camera.position.set(14, 16, 14);
  camera.lookAt(3, 0, 3);

  scene.add(new THREE.AmbientLight(0x223344, 4));
  const dl = new THREE.DirectionalLight(0x00f5ff, 6);
  dl.position.set(20, 30, 20);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xff6b35, 4);
  dl2.position.set(-15, 15, -10);
  scene.add(dl2);

  const N = dctBlock.length;
  const maxVal = Math.max(...dctBlock.flat().map(Math.abs)) || 1;
  const bars = [];

  dctBlock.forEach((row, r) => {
    row.forEach((val, c) => {
      const normVal = Math.abs(val) / maxVal;
      const h = Math.max(0.05, normVal * 8);
      const geo = new THREE.BoxGeometry(0.7, h, 0.7);
      const hue = val > 0 ? 0x00f5ff : 0xff6b35;
      const mat = new THREE.MeshPhongMaterial({
        color: hue,
        emissive: hue,
        emissiveIntensity: 0.15 + normVal * 0.3,
        shininess: 80,
        transparent: true,
        opacity: 0.3 + normVal * 0.7
      });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(c * 0.85, h / 2, r * 0.85);
      scene.add(bar);
      bars.push({ bar, targetH: h, r, c });
    });
  });

  scene.add(new THREE.GridHelper(8, 8, 0x112233, 0x0a1829));

  let t = 0;
  function animate() {
    _dctAnimId = requestAnimationFrame(animate);
    t += 0.006;
    camera.position.x = 3 + Math.cos(t * 0.35) * 13;
    camera.position.z = 3 + Math.sin(t * 0.35) * 13;
    camera.position.y = 12 + Math.sin(t * 0.2) * 3;
    camera.lookAt(3, 2, 3);

    bars.forEach(({ bar }, i) => {
      const pulse = 1 + 0.03 * Math.sin(t * 1.5 + i * 0.4);
      bar.scale.x = pulse;
      bar.scale.z = pulse;
    });

    _dctRenderer.render(scene, camera);
  }
  animate();
}

function dctDrawPsnrChart() {
  destroyChart('dct-psnr-chart');
  if (_dctPsnrCurve.length < 2) return;
  new Chart(document.getElementById('dct-psnr-chart'), {
    type: 'line',
    data: {
      labels: _dctPsnrCurve.map(d => d.q),
      datasets: [{
        label: 'PSNR (dB)',
        data: _dctPsnrCurve.map(d => d.psnr.toFixed(2)),
        borderColor: '#ff6b35',
        backgroundColor: 'rgba(255,107,53,0.1)',
        pointBackgroundColor: '#ff6b35',
        fill: true, tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#e8f4f8', font: { family: 'JetBrains Mono', size: 11 } } } },
      scales: {
        x: { title: { display: true, text: 'Quality', color: '#7ab3c8' }, ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } },
        y: { title: { display: true, text: 'PSNR (dB)', color: '#7ab3c8' }, ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } }
      }
    }
  });
}
