// views/huffman.js

window.views.huffman = {
  render() {
    return `
      ${makeViewHeader(
        'Chapter 8 — Image Compression',
        'HUFFMAN CODING',
        'Huffman coding assigns shorter codes to more frequent pixel values.'
      )}

      <div class="controls-bar">
        <button class="btn btn-primary" onclick="huffmanRun()">▶ Build Tree</button>
      </div>

      <div id="huff-wrap" style="position:relative">
        <div class="stats-row" id="huff-stats"></div>

        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Input Image</div>
            <div class="img-box" style="min-height:150px">
              <img id="huff-original" src="" alt=""/>
            </div>
          </div>

          <div class="card card-accent-cyan">
            <div class="card-title">Symbol Frequencies</div>
            <canvas id="huff-freq-chart" height="200"></canvas>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Code Table</div>
          <div id="huff-code-table" style="display:flex;flex-wrap:wrap;gap:8px"></div>
        </div>

        <div class="section-label">Compression Stats</div>
        <div class="card">
          <canvas id="huff-stats-chart" height="80"></canvas>
        </div>
      </div>
    `;
  },

  // ✅ DO NOT AUTO RUN
  init() {}
};


async function huffmanRun() {

  // ✅ prevent empty API call
  if (!window._uploadedFile) {
    showToast("Upload image first", true);
    return;
  }

  showLoading('huff-wrap');

  try {
    const data = await apiCall('/api/huffman/encode', window._uploadedFile);

    if (!data) throw new Error("No data from API");

    // image
    if (data.original) {
      setImage('huff-original', data.original);
    }

    // stats
    const s = data.stats || {};
    document.getElementById('huff-stats').innerHTML = `
      <div class="stat-chip">Unique: <strong>${s.unique_symbols || 0}</strong></div>
      <div class="stat-chip">Avg Len: <strong>${fmtNum(s.avg_code_length || 0)} bits</strong></div>
      <div class="stat-chip">Ratio: <strong>${fmtNum(s.compression_ratio || 0)}×</strong></div>
    `;

    // ✅ Chart.js safety check
    if (typeof Chart === 'undefined') {
      console.warn("Chart.js not loaded");
      hideLoading('huff-wrap');
      return;
    }

    // ===== Frequency Chart =====
    destroyChart('huff-freq-chart');

    const freqEntries = Object.entries(data.frequencies || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    if (freqEntries.length > 0) {
      new Chart(document.getElementById('huff-freq-chart'), {
        type: 'bar',
        data: {
          labels: freqEntries.map(([k]) => k),
          datasets: [{
            label: 'Frequency',
            data: freqEntries.map(([, v]) => v),
            backgroundColor: 'rgba(0,245,255,0.6)'
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    }

    // ===== Code Table =====
    const codeTable = document.getElementById('huff-code-table');
    codeTable.innerHTML = '';

    const codeEntries = Object.entries(data.codes || {}).slice(0, 20);

    codeEntries.forEach(([sym, code]) => {
      const chip = document.createElement('div');
      chip.style.cssText =
        'padding:4px 10px;background:#111;border-radius:6px;font-size:11px;';
      chip.textContent = `${sym} → ${code}`;
      codeTable.appendChild(chip);
    });

    // ===== Stats Chart =====
    destroyChart('huff-stats-chart');

    if (s.original_bits && s.encoded_bits) {
      new Chart(document.getElementById('huff-stats-chart'), {
        type: 'bar',
        data: {
          labels: ['Original', 'Encoded'],
          datasets: [{
            data: [s.original_bits, s.encoded_bits],
            backgroundColor: ['orange', 'cyan']
          }]
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } }
        }
      });
    }

  } catch (e) {
    showError('huff-wrap', e.message);
  }

  hideLoading('huff-wrap');
}
