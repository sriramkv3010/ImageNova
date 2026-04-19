// views/huffman.js
window.views.huffman = {
  render() {
    return `
      ${makeViewHeader('Chapter 8 — Image Compression', 'HUFFMAN CODING',
        'Huffman coding assigns shorter codes to more frequent pixel values. Built using a greedy priority-queue algorithm, it achieves lossless compression close to the entropy lower bound.'
      )}
      <div class="controls-bar">
        <button class="btn btn-primary" onclick="huffmanRun()">▶ Build Tree</button>
      </div>
      <div id="huff-wrap" style="position:relative">
        <div class="stats-row" id="huff-stats"></div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Input Image</div>
            <div class="img-box" style="min-height:150px"><img id="huff-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Symbol Frequencies (top 20)</div>
            <canvas id="huff-freq-chart" height="200"></canvas>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Code Table (top 20 symbols)</div>
          <div id="huff-code-table" style="display:flex;flex-wrap:wrap;gap:8px"></div>
        </div>
        <div class="section-label">Compression Stats</div>
        <div class="card">
          <canvas id="huff-stats-chart" height="80"></canvas>
        </div>
      </div>
    `;
  },
  init() { huffmanRun(); }
};

async function huffmanRun() {
  showLoading('huff-wrap');
  try {
    const data = await apiCall('/api/huffman/encode', window._uploadedFile);
    setImage('huff-original', data.original);

    const s = data.stats;
    document.getElementById('huff-stats').innerHTML = `
      <div class="stat-chip">Unique Symbols: <strong>${s.unique_symbols}</strong></div>
      <div class="stat-chip">Avg Code Length: <strong>${fmtNum(s.avg_code_length)} bits</strong></div>
      <div class="stat-chip">Compression Ratio: <strong>${fmtNum(s.compression_ratio)}×</strong></div>
      <div class="stat-chip">Original: <strong>${s.original_bits.toLocaleString()} bits</strong></div>
      <div class="stat-chip">Encoded: <strong>${s.encoded_bits.toLocaleString()} bits</strong></div>
    `;

    // Frequency chart
    destroyChart('huff-freq-chart');
    const freqEntries = Object.entries(data.frequencies).sort((a, b) => b[1] - a[1]);
    new Chart(document.getElementById('huff-freq-chart'), {
      type: 'bar',
      data: {
        labels: freqEntries.map(([k]) => k),
        datasets: [{
          label: 'Frequency',
          data: freqEntries.map(([, v]) => v),
          backgroundColor: 'rgba(0,245,255,0.6)',
          borderColor: '#00f5ff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7ab3c8', font: { size: 9 } }, grid: { color: 'rgba(0,245,255,0.06)' } },
          y: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } }
        }
      }
    });

    // Code table
    const codeTable = document.getElementById('huff-code-table');
    codeTable.innerHTML = '';
    const codeEntries = Object.entries(data.codes);
    codeEntries.forEach(([sym, code]) => {
      const chip = document.createElement('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--bg-card2);border:1px solid var(--border);border-radius:6px;';
      chip.innerHTML = `<span style="font-family:var(--font-mono);font-size:11px;color:var(--orange)">val:${sym}</span>
        <span style="color:var(--text-dim);font-size:10px">→</span>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--cyan);letter-spacing:1px">${code}</span>
        <span style="color:var(--text-dim);font-size:9px">(${code.length}b)</span>`;
      codeTable.appendChild(chip);
    });

    // Stats comparison chart
    destroyChart('huff-stats-chart');
    new Chart(document.getElementById('huff-stats-chart'), {
      type: 'bar',
      data: {
        labels: ['Original (8 bits/pixel)', 'Huffman Encoded'],
        datasets: [{
          label: 'Total Bits',
          data: [s.original_bits, s.encoded_bits],
          backgroundColor: ['rgba(255,107,53,0.7)', 'rgba(0,245,255,0.7)']
        }]
      },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } },
          y: { ticks: { color: '#7ab3c8' } }
        }
      }
    });

  } catch (e) { showError('huff-wrap', e.message); }
  hideLoading('huff-wrap');
}
