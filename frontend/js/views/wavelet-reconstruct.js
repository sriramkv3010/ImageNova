// views/wavelet-reconstruct.js
window.views['wavelet-reconstruct'] = {
  render() {
    return `
      ${makeViewHeader('Chapter 7 — Wavelet Transforms', 'RECONSTRUCTION & PSNR',
        'Threshold wavelet coefficients and reconstruct the image. Higher thresholds remove more coefficients — increasing compression but reducing quality (lower PSNR).'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Wavelet</div>
          <select class="ctrl-select" id="wr-wavelet" onchange="wReconRun()">
            <option value="haar">Haar</option>
            <option value="db4" selected>Daubechies-4</option>
            <option value="sym4">Symlet-4</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Threshold: <span class="ctrl-val" id="wr-thresh-val">0.0</span></div>
          <input type="range" class="ctrl-range" id="wr-thresh" min="0" max="0.95" step="0.05" value="0"
            oninput="document.getElementById('wr-thresh-val').textContent=parseFloat(this.value).toFixed(2);wReconRun()"/>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Levels to Keep</div>
          <select class="ctrl-select" id="wr-keep" onchange="wReconRun()">
            <option value="1,2,3" selected>All (1,2,3)</option>
            <option value="1,2">Levels 1,2</option>
            <option value="1">Level 1 only</option>
            <option value="2,3">Levels 2,3</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="wReconRun()">▶ Reconstruct</button>
      </div>

      <div id="wr-wrap" style="position:relative">
        <div class="stats-row" id="wr-stats"></div>
        <div class="grid-2">
          <div class="card">
            <div class="card-title">Original</div>
            <div class="img-box" style="min-height:200px"><img id="wr-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Reconstructed</div>
            <div class="img-box" style="min-height:200px">
              <img id="wr-recon" src="" alt=""/>
              <div class="img-badge" id="wr-psnr-badge">PSNR: —</div>
            </div>
          </div>
        </div>

        <div class="section-label">PSNR vs Threshold</div>
        <div class="card">
          <div class="card-title">Quality Curve (run multiple thresholds to build curve)</div>
          <canvas id="wr-curve-chart" height="100"></canvas>
        </div>
      </div>
    `;
  },
  init() {
    _wrCurveData = [];
    wReconRun();
  }
};

let _wrCurveData = [];

async function wReconRun() {
  const wavelet = document.getElementById('wr-wavelet').value;
  const threshold = document.getElementById('wr-thresh').value;
  const keep_levels = document.getElementById('wr-keep').value;
  showLoading('wr-wrap');
  try {
    const data = await apiCall('/api/wavelet/reconstruct', window._uploadedFile, { wavelet, threshold, keep_levels });
    setImage('wr-original', data.original);
    setImage('wr-recon', data.reconstructed);
    document.getElementById('wr-psnr-badge').textContent = `PSNR: ${fmtNum(data.psnr)} dB`;
    document.getElementById('wr-stats').innerHTML = `
      <div class="stat-chip">PSNR: <strong>${fmtNum(data.psnr)} dB</strong></div>
      <div class="stat-chip">MSE: <strong>${fmtNum(data.mse)}</strong></div>
      <div class="stat-chip">Threshold: <strong>${fmtNum(parseFloat(threshold), 2)}</strong></div>
    `;
    // Track curve
    const t = parseFloat(threshold);
    const existing = _wrCurveData.findIndex(d => Math.abs(d.t - t) < 0.001);
    if (existing >= 0) _wrCurveData[existing] = { t, psnr: data.psnr };
    else _wrCurveData.push({ t, psnr: data.psnr });
    _wrCurveData.sort((a, b) => a.t - b.t);
    wrDrawCurve();
  } catch (e) { showError('wr-wrap', e.message); }
  hideLoading('wr-wrap');
}

function wrDrawCurve() {
  destroyChart('wr-curve-chart');
  if (_wrCurveData.length < 2) return;
  new Chart(document.getElementById('wr-curve-chart'), {
    type: 'line',
    data: {
      labels: _wrCurveData.map(d => d.t.toFixed(2)),
      datasets: [{
        label: 'PSNR (dB)',
        data: _wrCurveData.map(d => d.psnr.toFixed(2)),
        borderColor: '#00f5ff',
        backgroundColor: 'rgba(0,245,255,0.1)',
        pointBackgroundColor: '#00f5ff',
        fill: true,
        tension: 0.3
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
}
