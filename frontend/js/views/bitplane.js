// views/bitplane.js
window.views.bitplane = {
  render() {
    return `
      ${makeViewHeader('Chapter 8 — Image Compression', 'BIT-PLANE DECOMPOSITION',
        'Each pixel value (0–255) can be decomposed into 8 binary bit-planes. MSB (bit 7) carries most visual information. Click planes to toggle them in the reconstruction.'
      )}
      <div class="controls-bar">
        <button class="btn btn-primary" onclick="bitplaneRun()">▶ Decompose</button>
        <button class="btn btn-secondary" onclick="bpSelectAll()">Select All</button>
        <button class="btn btn-secondary" onclick="bpSelectMSB()">Top 4 Bits</button>
      </div>
      <div id="bp-wrap" style="position:relative">
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Image</div>
            <div class="img-box" style="min-height:160px"><img id="bp-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Reconstruction (selected planes)</div>
            <div class="img-box" style="min-height:160px">
              <img id="bp-recon" src="" alt=""/>
              <div class="img-badge" id="bp-psnr-badge">PSNR: —</div>
            </div>
          </div>
        </div>
        <div class="section-label">8 Bit Planes (click to select/deselect)</div>
        <div class="bitplane-grid" id="bp-grid"></div>
        <div class="section-label">Reconstruction Quality by Bits Kept</div>
        <div class="card">
          <canvas id="bp-psnr-chart" height="100"></canvas>
        </div>
      </div>
    `;
  },
  init() { bitplaneRun(); }
};

let _bpData = null;
let _bpSelected = new Set([7,6,5,4,3,2,1,0]);

async function bitplaneRun() {
  showLoading('bp-wrap');
  try {
    const data = await apiCall('/api/bitplane/decompose', window._uploadedFile);
    _bpData = data;
    setImage('bp-original', data.original);

    // Render plane grid
    const grid = document.getElementById('bp-grid');
    grid.innerHTML = '';
    data.planes.forEach(plane => {
      const item = document.createElement('div');
      item.className = 'bitplane-item' + (_bpSelected.has(plane.bit) ? ' selected' : '');
      item.id = `bp-item-${plane.bit}`;
      item.onclick = () => bpToggle(plane.bit);
      item.innerHTML = `
        <img src="data:image/png;base64,${plane.image}" style="width:100%;display:block;image-rendering:pixelated"/>
        <div class="bitplane-label">${plane.label} — ${fmtNum(plane.ones_percent)}% ones</div>
      `;
      grid.appendChild(item);
    });

    // PSNR chart
    destroyChart('bp-psnr-chart');
    const recons = data.reconstructions;
    new Chart(document.getElementById('bp-psnr-chart'), {
      type: 'line',
      data: {
        labels: recons.map(r => `${r.bits_kept} bits`).reverse(),
        datasets: [{
          label: 'PSNR (dB)',
          data: recons.map(r => r.psnr.toFixed(2)).reverse(),
          borderColor: '#ff6b35',
          backgroundColor: 'rgba(255,107,53,0.1)',
          pointBackgroundColor: '#ff6b35',
          fill: true, tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#e8f4f8', font: { family: 'JetBrains Mono', size: 11 } } } },
        scales: {
          x: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } },
          y: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } }
        }
      }
    });

    bpUpdateRecon();
  } catch (e) { showError('bp-wrap', e.message); }
  hideLoading('bp-wrap');
}

function bpToggle(bit) {
  if (_bpSelected.has(bit)) _bpSelected.delete(bit);
  else _bpSelected.add(bit);

  document.querySelectorAll('.bitplane-item').forEach(el => el.classList.remove('selected'));
  _bpSelected.forEach(b => {
    const el = document.getElementById(`bp-item-${b}`);
    if (el) el.classList.add('selected');
  });
  bpUpdateRecon();
}

function bpSelectAll() {
  _bpSelected = new Set([7,6,5,4,3,2,1,0]);
  document.querySelectorAll('.bitplane-item').forEach(el => el.classList.add('selected'));
  bpUpdateRecon();
}

function bpSelectMSB() {
  _bpSelected = new Set([7,6,5,4]);
  document.querySelectorAll('.bitplane-item').forEach(el => {
    const bit = parseInt(el.id.replace('bp-item-', ''));
    el.classList.toggle('selected', _bpSelected.has(bit));
  });
  bpUpdateRecon();
}

function bpUpdateRecon() {
  if (!_bpData) return;
  // Find reconstruction closest to selected bits count
  const bitsKept = _bpSelected.size;
  const recon = _bpData.reconstructions.find(r => r.bits_kept === bitsKept)
    || _bpData.reconstructions[0];
  if (recon) {
    setImage('bp-recon', recon.image);
    document.getElementById('bp-psnr-badge').textContent = `PSNR: ${fmtNum(recon.psnr)} dB | ${bitsKept} planes`;
  }
}
