// views/huffman.js

window.views.huffman = {
  render() {
    return `
      ${makeViewHeader(
        'Chapter 8 — Image Compression',
        'HUFFMAN CODING',
        'Lossless compression using frequency-based coding'
      )}

      <div class="controls-bar">
        <button class="btn btn-primary" onclick="huffmanRun()">▶ Run</button>
      </div>

      <div id="huff-wrap">
        <div id="huff-stats"></div>

        <div class="grid-2">
          <div>
            <h3>Input</h3>
            <img id="huff-original"/>
          </div>

          <div>
            <h3>Frequency</h3>
            <canvas id="huff-freq-chart"></canvas>
          </div>
        </div>

        <div id="huff-code-table"></div>
        <canvas id="huff-stats-chart"></canvas>
      </div>
    `;
  },

  // ❌ NO AUTO CALL
  init() {}
};

async function huffmanRun() {

  // ✅ prevent empty call
  if (!window._uploadedFile) {
    showToast("Upload image first", true);
    return;
  }

  showLoading('huff-wrap');

  try {
    const data = await apiCall('/api/huffman/encode', window._uploadedFile);

    setImage('huff-original', data.original);

    const s = data.stats;

    document.getElementById('huff-stats').innerHTML = `
      Unique: ${s.unique_symbols} |
      Ratio: ${fmtNum(s.compression_ratio)}×
    `;

  } catch (e) {
    showError('huff-wrap', e.message);
  }

  hideLoading('huff-wrap');
}