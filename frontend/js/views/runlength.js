// views/runlength.js
window.views.runlength = {
  render() {
    return `
      ${makeViewHeader('Chapter 8 — Image Compression', 'RUN-LENGTH ENCODING',
        'RLE replaces consecutive identical values with (value, count) pairs. Highly effective for binary images with long runs of 0s or 1s. Each row shows the compression visually.'
      )}
      <div class="controls-bar">
        <button class="btn btn-primary" onclick="rleRun()">▶ Encode</button>
      </div>
      <div id="rle-wrap" style="position:relative">
        <div class="stats-row" id="rle-stats"></div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Binary Input Image</div>
            <div class="img-box" style="min-height:140px"><img id="rle-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Compression Efficiency</div>
            <canvas id="rle-chart" height="150"></canvas>
          </div>
        </div>
        <div class="section-label">Row-by-Row RLE Visualization</div>
        <div class="card">
          <div id="rle-rows-out"></div>
        </div>
      </div>
    `;
  },
  init() { rleRun(); }
};

async function rleRun() {
  showLoading('rle-wrap');
  try {
    const data = await apiCall('/api/runlength/encode', window._uploadedFile);
    setImage('rle-original', data.original);
    document.getElementById('rle-stats').innerHTML = `
      <div class="stat-chip">Original Bits: <strong>${data.stats.original_bits.toLocaleString()}</strong></div>
      <div class="stat-chip">Encoded Pairs×2: <strong>${data.stats.encoded_pairs.toLocaleString()}</strong></div>
      <div class="stat-chip">Ratio: <strong>${fmtNum(data.stats.ratio)}×</strong></div>
    `;

    // Per-row comparison chart
    destroyChart('rle-chart');
    new Chart(document.getElementById('rle-chart'), {
      type: 'bar',
      data: {
        labels: data.rows.map(r => `Row ${r.row}`),
        datasets: [
          { label: 'Original Bits', data: data.rows.map(r => r.original_bits), backgroundColor: 'rgba(255,107,53,0.6)' },
          { label: 'RLE Pairs×2', data: data.rows.map(r => r.encoded_pairs * 2), backgroundColor: 'rgba(0,245,255,0.6)' }
        ]
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

    // Row visualization
    const rowsOut = document.getElementById('rle-rows-out');
    rowsOut.innerHTML = '';
    data.rows.forEach(row => {
      const rowDiv = document.createElement('div');
      rowDiv.style.marginBottom = '10px';
      rowDiv.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-dim);margin-bottom:4px">Row ${row.row} — ${row.encoded_pairs} pairs</div>`;
      const segsDiv = document.createElement('div');
      segsDiv.className = 'rle-row';
      row.rle.forEach(seg => {
        const s = document.createElement('div');
        s.className = 'rle-seg';
        const ratio = seg.count / 64;
        s.style.width = Math.max(24, ratio * 120) + 'px';
        s.style.background = seg.value ? 'rgba(0,245,255,0.5)' : 'rgba(30,40,60,0.8)';
        s.style.border = `1px solid ${seg.value ? 'rgba(0,245,255,0.4)' : 'rgba(50,70,100,0.5)'}`;
        s.style.color = seg.value ? 'var(--cyan)' : 'var(--text-dim)';
        s.textContent = seg.count;
        s.title = `value=${seg.value}, count=${seg.count}`;
        segsDiv.appendChild(s);
      });
      rowDiv.appendChild(segsDiv);
      rowsOut.appendChild(rowDiv);
    });

  } catch (e) { showError('rle-wrap', e.message); }
  hideLoading('rle-wrap');
}

// ════════════════════════════════════════════════════════
// views/wavelet-coding.js
// ════════════════════════════════════════════════════════
window.views['wavelet-coding'] = {
  render() {
    return `
      ${makeViewHeader('Chapter 8 — Image Compression', 'WAVELET COMPRESSION',
        'Threshold wavelet coefficients to zero to compress. Only non-zero coefficients need to be stored. Higher threshold = more zeros = higher compression but lower quality.'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Threshold: <span class="ctrl-val" id="wc-thresh-val">0.50</span></div>
          <input type="range" class="ctrl-range" id="wc-thresh" min="0" max="0.99" step="0.01" value="0.5"
            oninput="document.getElementById('wc-thresh-val').textContent=parseFloat(this.value).toFixed(2);wcRun()"/>
        </div>
        <button class="btn btn-primary" onclick="wcRun()">▶ Compress</button>
      </div>
      <div id="wc-wrap" style="position:relative">
        <div class="stats-row" id="wc-stats"></div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original</div>
            <div class="img-box" style="min-height:180px"><img id="wc-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Reconstructed</div>
            <div class="img-box" style="min-height:180px">
              <img id="wc-recon" src="" alt=""/>
              <div class="img-badge" id="wc-badge">—</div>
            </div>
          </div>
        </div>
        <div class="section-label">Quality vs Compression Tradeoff</div>
        <div class="card">
          <canvas id="wc-chart" height="100"></canvas>
        </div>
      </div>
    `;
  },
  init() { _wcCurve = []; wcRun(); }
};

let _wcCurve = [];

async function wcRun() {
  const threshold_pct = document.getElementById('wc-thresh').value;
  showLoading('wc-wrap');
  try {
    const data = await apiCall('/api/wavelet/coding', window._uploadedFile, { threshold_pct });
    setImage('wc-original', data.original);
    setImage('wc-recon', data.reconstructed);
    document.getElementById('wc-badge').textContent = `PSNR: ${fmtNum(data.psnr)} dB | ${fmtNum(100 - data.nonzero_percent)}% zeros`;
    document.getElementById('wc-stats').innerHTML = `
      <div class="stat-chip">PSNR: <strong>${fmtNum(data.psnr)} dB</strong></div>
      <div class="stat-chip">Nonzero Coeffs: <strong>${fmtNum(data.nonzero_percent)}%</strong></div>
      <div class="stat-chip">Compression Ratio: <strong>${fmtNum(data.compression_ratio)}×</strong></div>
      <div class="stat-chip">Threshold Value: <strong>${fmtNum(data.threshold_value)}</strong></div>
    `;

    const t = parseFloat(threshold_pct);
    const idx = _wcCurve.findIndex(d => Math.abs(d.t - t) < 0.005);
    const entry = { t, psnr: data.psnr, cr: data.compression_ratio };
    if (idx >= 0) _wcCurve[idx] = entry;
    else _wcCurve.push(entry);
    _wcCurve.sort((a, b) => a.t - b.t);

    destroyChart('wc-chart');
    if (_wcCurve.length >= 2) {
      new Chart(document.getElementById('wc-chart'), {
        type: 'line',
        data: {
          labels: _wcCurve.map(d => d.t.toFixed(2)),
          datasets: [
            { label: 'PSNR (dB)', data: _wcCurve.map(d => d.psnr.toFixed(2)), borderColor: '#00f5ff', yAxisID: 'y', tension: 0.3 },
            { label: 'Compression Ratio', data: _wcCurve.map(d => d.cr.toFixed(2)), borderColor: '#ff6b35', yAxisID: 'y1', tension: 0.3 }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#e8f4f8', font: { family: 'JetBrains Mono', size: 11 } } } },
          scales: {
            x: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } },
            y: { position: 'left', ticks: { color: '#00f5ff' }, grid: { color: 'rgba(0,245,255,0.06)' } },
            y1: { position: 'right', ticks: { color: '#ff6b35' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    }
  } catch (e) { showError('wc-wrap', e.message); }
  hideLoading('wc-wrap');
}
