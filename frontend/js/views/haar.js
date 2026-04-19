// ═══════════════════════════════════════════════
// views/haar.js — Haar Wavelet Decomposition
// ═══════════════════════════════════════════════

window.views.haar = {
  render() {
    return `
      ${makeViewHeader('Chapter 7 — Wavelet Transforms', 'HAAR DECOMPOSITION',
        'The Haar wavelet is the simplest wavelet. Each decomposition level splits the image into four subbands: Approximation (LL), Horizontal detail (LH), Vertical detail (HL), and Diagonal detail (HH).'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Decomposition Levels</div>
          <select class="ctrl-select" id="haar-levels" onchange="haarRun()">
            <option value="1">1 Level</option>
            <option value="2" selected>2 Levels</option>
            <option value="3">3 Levels</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="haarRun()">▶ Decompose</button>
      </div>

      <div id="haar-loading-wrap" style="position:relative">
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Image</div>
            <div class="img-box" style="min-height:180px">
              <img id="haar-original" src="" alt=""/>
            </div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Full Subband Layout</div>
            <div class="img-box" style="min-height:180px">
              <img id="haar-layout" src="" alt=""/>
              <div class="img-badge" id="haar-layout-badge">—</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-label">Level-by-Level Subbands</div>
      <div id="haar-levels-out"></div>

      <div class="section-label">Energy Distribution</div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Subband Energy (per level)</div>
        <canvas id="haar-energy-chart" height="100"></canvas>
      </div>

      <div class="section-label">3D Frequency Representation</div>
      <div class="card card-accent-cyan">
        <div class="card-title">3D Wavelet Coefficient Landscape</div>
        <div class="viz-canvas" id="haar-3d-canvas" style="min-height:280px"></div>
      </div>
    `;
  },
  init() {
    haarRun();
  }
};

let _haarData = null;
let _haarRenderer = null;
let _haarScene = null;
let _haarCamera = null;
let _haarBars = [];
let _haarAnimId = null;

function haarNextLevel() {
  const sel = document.getElementById('haar-levels');
  if (!sel) return;
  const v = parseInt(sel.value);
  if (v < 3) { sel.value = v + 1; haarRun(); }
}
function haarPrevLevel() {
  const sel = document.getElementById('haar-levels');
  if (!sel) return;
  const v = parseInt(sel.value);
  if (v > 1) { sel.value = v - 1; haarRun(); }
}

async function haarRun() {
  const levels = document.getElementById('haar-levels').value;
  showLoading('haar-loading-wrap');
  try {
    const data = await apiCall('/api/haar/decompose', window._uploadedFile, { levels });
    _haarData = data;
    setImage('haar-original', data.original);
    setImage('haar-layout', data.full_layout);
    document.getElementById('haar-layout-badge').textContent = `${data.original_shape[0]}×${data.original_shape[1]}`;

    // Render level subbands
    const container = document.getElementById('haar-levels-out');
    container.innerHTML = '';
    data.levels.forEach(lvl => {
      const div = document.createElement('div');
      div.style.marginBottom = '16px';
      div.innerHTML = `
        <div class="section-label" style="margin-top:0">Level ${lvl.level} — ${lvl.shapes.approx[0]}×${lvl.shapes.approx[1]}</div>
        <div class="grid-4">
          <div class="card">
            <div class="card-title">LL — Approximation</div>
            <div class="img-box"><img src="data:image/png;base64,${lvl.approximation}"/></div>
          </div>
          <div class="card">
            <div class="card-title">LH — Horizontal Detail</div>
            <div class="img-box"><img src="data:image/png;base64,${lvl.horizontal}"/></div>
          </div>
          <div class="card">
            <div class="card-title">HL — Vertical Detail</div>
            <div class="img-box"><img src="data:image/png;base64,${lvl.vertical}"/></div>
          </div>
          <div class="card">
            <div class="card-title">HH — Diagonal Detail</div>
            <div class="img-box"><img src="data:image/png;base64,${lvl.diagonal}"/></div>
          </div>
        </div>
      `;
      container.appendChild(div);
    });

    // Energy chart
    haarDrawEnergyChart(data.levels);

    // 3D visualization
    haarInit3D(data.levels);

  } catch (e) {
    showError('haar-loading-wrap', e.message);
  }
  hideLoading('haar-loading-wrap');
}

function haarDrawEnergyChart(levels) {
  destroyChart('haar-energy-chart');
  const labels = [];
  const approxData = [], hData = [], vData = [], dData = [];
  levels.forEach(l => {
    labels.push(`L${l.level}`);
    const tot = l.energy.approx + l.energy.horizontal + l.energy.vertical + l.energy.diagonal;
    approxData.push((l.energy.approx / tot * 100).toFixed(1));
    hData.push((l.energy.horizontal / tot * 100).toFixed(1));
    vData.push((l.energy.vertical / tot * 100).toFixed(1));
    dData.push((l.energy.diagonal / tot * 100).toFixed(1));
  });

  new Chart(document.getElementById('haar-energy-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'LL (Approx)', data: approxData, backgroundColor: 'rgba(0,245,255,0.7)' },
        { label: 'LH (Horiz)', data: hData, backgroundColor: 'rgba(255,107,53,0.7)' },
        { label: 'HL (Vert)', data: vData, backgroundColor: 'rgba(139,92,246,0.7)' },
        { label: 'HH (Diag)', data: dData, backgroundColor: 'rgba(245,158,11,0.7)' },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#e8f4f8', font: { family: 'JetBrains Mono', size: 11 } } } },
      scales: {
        x: { stacked: true, ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } },
        y: { stacked: true, ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' }, max: 100 }
      }
    }
  });
}

function haarInit3D(levels) {
  if (!window.THREE) return;
  const container = document.getElementById('haar-3d-canvas');
  if (!container) return;

  // Cleanup old
  if (_haarAnimId) cancelAnimationFrame(_haarAnimId);
  if (_haarRenderer) { _haarRenderer.dispose(); container.innerHTML = ''; }

  const W = container.clientWidth || 600;
  const H = 280;
  _haarRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _haarRenderer.setSize(W, H);
  _haarRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _haarRenderer.setClearColor(0x000000, 0);
  container.appendChild(_haarRenderer.domElement);

  _haarScene = new THREE.Scene();
  _haarCamera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500);
  _haarCamera.position.set(18, 20, 18);
  _haarCamera.lookAt(0, 0, 0);

  _haarScene.add(new THREE.AmbientLight(0x334455, 4));
  const dl = new THREE.DirectionalLight(0x00f5ff, 5);
  dl.position.set(15, 30, 15);
  _haarScene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xff6b35, 3);
  dl2.position.set(-15, 10, -10);
  _haarScene.add(dl2);

  _haarBars = [];

  // Build bars for each subband at each level
  const level = levels[0]; // Use first level data as sample
  const energies = [
    { name: 'LL', val: level.energy.approx, col: 0x00f5ff, x: -4 },
    { name: 'LH', val: level.energy.horizontal, col: 0xff6b35, x: -1.3 },
    { name: 'HL', val: level.energy.vertical, col: 0x8b5cf6, x: 1.3 },
    { name: 'HH', val: level.energy.diagonal, col: 0xf59e0b, x: 4 },
  ];

  const maxE = Math.max(...energies.map(e => e.val));
  energies.forEach((e, i) => {
    const h = Math.max(0.2, (e.val / maxE) * 10);
    const geo = new THREE.BoxGeometry(1.8, h, 1.8);
    const mat = new THREE.MeshPhongMaterial({
      color: e.col,
      emissive: e.col,
      emissiveIntensity: 0.2,
      shininess: 60,
    });
    const bar = new THREE.Mesh(geo, mat);
    bar.position.set(e.x, h / 2, 0);
    bar.userData = { targetH: h, label: e.name };
    _haarScene.add(bar);
    _haarBars.push(bar);

    // Label plane
    const wireGeo = new THREE.BoxGeometry(1.82, h, 1.82);
    const wireMat = new THREE.MeshBasicMaterial({ color: e.col, wireframe: true, transparent: true, opacity: 0.3 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.copy(bar.position);
    _haarScene.add(wire);
  });

  // Ground grid
  const gridHelper = new THREE.GridHelper(24, 24, 0x112233, 0x0a1a2a);
  _haarScene.add(gridHelper);

  let t = 0;
  function animate() {
    _haarAnimId = requestAnimationFrame(animate);
    t += 0.008;
    // Orbit camera
    _haarCamera.position.x = Math.cos(t * 0.4) * 22;
    _haarCamera.position.z = Math.sin(t * 0.4) * 22;
    _haarCamera.position.y = 16 + Math.sin(t * 0.2) * 3;
    _haarCamera.lookAt(0, 3, 0);

    // Pulse bars
    _haarBars.forEach((bar, i) => {
      const pulse = 1 + 0.04 * Math.sin(t * 2 + i * 1.5);
      bar.scale.x = pulse;
      bar.scale.z = pulse;
    });

    _haarRenderer.render(_haarScene, _haarCamera);
  }
  animate();
}
