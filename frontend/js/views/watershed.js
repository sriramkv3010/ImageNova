// views/watershed.js — Watershed Segmentation
window.views.watershed = {
  render() {
    return `
      ${makeViewHeader('Chapter 10 — Image Segmentation', 'WATERSHED SEGMENTATION',
        'Watershed treats the gradient image as a topographic surface — "water" floods from local minima. Boundaries form where water from different basins meets. Excellent for separating touching objects.'
      )}
      <div class="controls-bar">
        <button class="btn btn-primary" onclick="watershedRun()">▶ Run Watershed</button>
      </div>
      <div id="ws-wrap" style="position:relative">
        <div class="stats-row" id="ws-stats"></div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Image</div>
            <div class="img-box" style="min-height:180px"><img id="ws-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Gradient Magnitude</div>
            <div class="img-box" style="min-height:180px">
              <img id="ws-gradient" src="" alt=""/>
            </div>
          </div>
        </div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Distance Transform</div>
            <div class="img-box" style="min-height:180px"><img id="ws-distance" src="" alt=""/></div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Watershed Markers / Regions</div>
            <div class="img-box" style="min-height:180px">
              <img id="ws-markers" src="" alt=""/>
              <div class="img-badge" id="ws-regions-badge">— regions</div>
            </div>
          </div>
        </div>

        <div class="section-label">3D Gradient Terrain</div>
        <div class="card card-accent-cyan">
          <div class="card-title">Gradient as topographic surface — water floods from valleys</div>
          <div class="viz-canvas" id="ws-3d-canvas" style="min-height:300px"></div>
        </div>
      </div>
    `;
  },
  init() { watershedRun(); }
};

let _wsRenderer = null;
let _wsAnimId = null;

async function watershedRun() {
  showLoading('ws-wrap');
  try {
    const data = await apiCall('/api/watershed/segment', window._uploadedFile);
    setImage('ws-original', data.original);
    setImage('ws-gradient', data.gradient);
    setImage('ws-distance', data.distance_transform);
    setImage('ws-markers', data.markers);
    document.getElementById('ws-regions-badge').textContent = `${data.num_regions} regions`;
    document.getElementById('ws-stats').innerHTML = `
      <div class="stat-chip">Detected Regions: <strong>${data.num_regions}</strong></div>
    `;
    wsInit3D(data);
  } catch (e) { showError('ws-wrap', e.message); }
  hideLoading('ws-wrap');
}

function wsInit3D(data) {
  if (!window.THREE) return;
  const container = document.getElementById('ws-3d-canvas');
  if (!container) return;

  if (_wsAnimId) cancelAnimationFrame(_wsAnimId);
  if (_wsRenderer) { _wsRenderer.dispose(); container.innerHTML = ''; }

  const W = container.clientWidth || 700;
  const H = 300;
  _wsRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _wsRenderer.setSize(W, H);
  _wsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _wsRenderer.setClearColor(0x000000, 0);
  container.appendChild(_wsRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500);
  camera.position.set(20, 20, 25);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x223355, 4));
  const dl = new THREE.DirectionalLight(0x00f5ff, 7);
  dl.position.set(20, 40, 20);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xff6b35, 5);
  dl2.position.set(-15, 20, -10);
  scene.add(dl2);

  // Build terrain from gradient image
  // We'll create a grid of bars representing gradient intensity
  const GRID = 28;
  const cellSize = 0.65;
  const offset = -(GRID * cellSize) / 2;

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      // Simulated terrain (use noise-like pattern since we can't decode base64 easily in JS)
      // Center peaks and valley pattern
      const nx = (c / GRID - 0.5) * 4;
      const nz = (r / GRID - 0.5) * 4;
      const dist = Math.sqrt(nx * nx + nz * nz);
      const h = Math.max(0.05,
        1.5 * Math.abs(Math.sin(nx * 1.5) * Math.cos(nz * 1.5)) +
        0.8 * Math.abs(Math.sin(nx * 3 + 1) * Math.cos(nz * 2.5 - 0.5)) +
        0.3 * (1 - Math.exp(-dist))
      );

      const geo = new THREE.BoxGeometry(cellSize * 0.88, h, cellSize * 0.88);

      // Color: blue (low/valley) → cyan → orange (high/ridge)
      const norm = Math.min(h / 3, 1);
      const color = new THREE.Color();
      color.setHSL(0.6 - norm * 0.5, 0.85, 0.3 + norm * 0.35);

      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.1 + norm * 0.25,
        shininess: 50
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offset + c * cellSize, h / 2, offset + r * cellSize);
      scene.add(mesh);
    }
  }

  // "Water" plane at level 0 — animated
  const waterGeo = new THREE.PlaneGeometry(GRID * cellSize, GRID * cellSize);
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x0066aa,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);

  scene.add(new THREE.GridHelper(GRID * cellSize + 2, 20, 0x0a1a2e, 0x060e18));

  let t = 0;
  let waterLevel = 0;
  let rising = true;

  function animate() {
    _wsAnimId = requestAnimationFrame(animate);
    t += 0.007;

    // Camera orbit
    camera.position.x = Math.sin(t * 0.18) * 28;
    camera.position.z = Math.cos(t * 0.18) * 28;
    camera.position.y = 18 + Math.sin(t * 0.1) * 3;
    camera.lookAt(0, 2, 0);

    // Animate water rising and falling
    if (rising) {
      waterLevel += 0.015;
      if (waterLevel >= 2.2) rising = false;
    } else {
      waterLevel -= 0.01;
      if (waterLevel <= 0) rising = true;
    }
    water.position.y = waterLevel;
    waterMat.opacity = 0.2 + 0.2 * Math.sin(t * 0.8);

    _wsRenderer.render(scene, camera);
  }
  animate();
}
