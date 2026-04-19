// views/kmeans.js — K-Means Segmentation
window.views.kmeans = {
  render() {
    return `
      ${makeViewHeader('Chapter 10 — Image Segmentation', 'K-MEANS SEGMENTATION',
        'K-Means iteratively assigns pixels to the nearest cluster center and recomputes centers until convergence. Step through each iteration to watch clusters form and sharpen.'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">K Clusters</div>
          <select class="ctrl-select" id="km-k" onchange="kmeansRun()">
            <option value="2">K = 2</option>
            <option value="3">K = 3</option>
            <option value="4" selected>K = 4</option>
            <option value="5">K = 5</option>
            <option value="6">K = 6</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Max Iterations</div>
          <select class="ctrl-select" id="km-iter">
            <option value="10" selected>10</option>
            <option value="20">20</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="kmeansRun()">▶ Run K-Means</button>
      </div>

      <div id="km-wrap" style="position:relative">
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Image</div>
            <div class="img-box" style="min-height:180px"><img id="km-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-orange">
            <div class="card-title">Final Segmentation</div>
            <div class="img-box" style="min-height:180px"><img id="km-segmented" src="" alt=""/></div>
          </div>
        </div>

        <div class="section-label">Iteration Stepper</div>
        <div class="card card-accent-cyan" style="margin-bottom:16px">
          <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div class="card-title">Segmentation at Iteration</div>
              <div class="img-box" style="min-height:160px"><img id="km-iter-img" src="" alt=""/></div>
            </div>
            <div style="flex:1;min-width:200px">
              <div class="card-title">Inertia Convergence</div>
              <canvas id="km-inertia-chart" height="160"></canvas>
            </div>
          </div>
          <div class="iter-controls" style="margin-top:12px">
            <button class="iter-btn" onclick="kmeansPrev()">◀</button>
            <div class="iter-display" id="km-iter-label">Iteration 0 / 0</div>
            <button class="iter-btn" onclick="kmeansNext()">▶</button>
            <button class="btn btn-secondary" id="km-auto-btn" onclick="kmeansToggleAuto()">▶ Auto Play</button>
          </div>
        </div>

        <div class="section-label">Cluster Centers</div>
        <div class="card" id="km-centers-out"></div>
      </div>
    `;
  },
  init() { kmeansRun(); }
};

let _kmData = null;
let _kmStep = 0;
let _kmAutoInt = null;
let _kmRenderer = null;
let _kmAnimId = null;

function kmeansNext() {
  if (!_kmData) return;
  _kmStep = Math.min(_kmStep + 1, _kmData.history.length - 1);
  kmeansUpdateStep();
}
function kmeansPrev() {
  if (!_kmData) return;
  _kmStep = Math.max(_kmStep - 1, 0);
  kmeansUpdateStep();
}
function kmeansToggleAuto() {
  const btn = document.getElementById('km-auto-btn');
  if (!btn) return;
  if (_kmAutoInt) {
    clearInterval(_kmAutoInt);
    _kmAutoInt = null;
    btn.textContent = '▶ Auto Play';
  } else {
    _kmAutoInt = setInterval(() => {
      if (_kmStep >= (_kmData ? _kmData.history.length - 1 : 0)) {
        clearInterval(_kmAutoInt);
        _kmAutoInt = null;
        if (btn) btn.textContent = '▶ Auto Play';
        return;
      }
      kmeansNext();
    }, 600);
    btn.textContent = '⏸ Pause';
  }
}

function kmeansUpdateStep() {
  if (!_kmData || !_kmData.history.length) return;
  const hist = _kmData.history[_kmStep];
  setImage('km-iter-img', hist.image);
  const lbl = document.getElementById('km-iter-label');
  if (lbl) lbl.textContent = `Iteration ${hist.iteration} / ${_kmData.history.length}`;
}

async function kmeansRun() {
  const k = document.getElementById('km-k').value;
  const max_iter = document.getElementById('km-iter').value;
  showLoading('km-wrap');
  _kmStep = 0;
  if (_kmAutoInt) { clearInterval(_kmAutoInt); _kmAutoInt = null; }
  try {
    const data = await apiCall('/api/kmeans/segment', window._uploadedFile, { k, max_iter });
    _kmData = data;

    setImage('km-original', data.original);
    setImage('km-segmented', data.segmented);

    // Inertia chart
    destroyChart('km-inertia-chart');
    new Chart(document.getElementById('km-inertia-chart'), {
      type: 'line',
      data: {
        labels: data.history.map(h => h.iteration),
        datasets: [{
          label: 'Inertia',
          data: data.history.map(h => h.inertia.toFixed(0)),
          borderColor: '#ff6b35',
          backgroundColor: 'rgba(255,107,53,0.1)',
          pointBackgroundColor: '#ff6b35',
          fill: true, tension: 0.35
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#e8f4f8', font: { family: 'JetBrains Mono', size: 11 } } } },
        scales: {
          x: { title: { display: true, text: 'Iteration', color: '#7ab3c8' }, ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } },
          y: { ticks: { color: '#7ab3c8' }, grid: { color: 'rgba(0,245,255,0.06)' } }
        }
      }
    });

    // Cluster centers
    const COLORS = ['#ff6b35','#00f5ff','#8b5cf6','#22c55e','#f59e0b','#ec4899','#14b8a6','#f97316'];
    const centersOut = document.getElementById('km-centers-out');
    centersOut.innerHTML = '<div class="card-title">Final Cluster Centers (pixel intensity)</div><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">' +
      data.final_centers.map((c, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-card2);border:1px solid ${COLORS[i % COLORS.length]}44;border-radius:8px">
          <div style="width:16px;height:16px;border-radius:50%;background:${COLORS[i % COLORS.length]}"></div>
          <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary)">Cluster ${i + 1}: <strong style="color:${COLORS[i % COLORS.length]}">${Math.round(c)}</strong></span>
        </div>`).join('') + '</div>';

    kmeansUpdateStep();
  } catch (e) { showError('km-wrap', e.message); }
  hideLoading('km-wrap');
}
