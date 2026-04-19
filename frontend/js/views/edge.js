// views/edge.js — Edge Detection (Canny, Sobel, Prewitt, Laplacian)
window.views.edge = {
  render() {
    return `
      ${makeViewHeader('Chapter 10 — Image Segmentation', 'EDGE DETECTION',
        'Edges mark boundaries between regions. Canny (multi-step pipeline), Sobel, Prewitt, and Laplacian each take a different mathematical approach to finding sharp intensity changes.'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Method</div>
          <select class="ctrl-select" id="edge-method" onchange="edgeRun()">
            <option value="canny" selected>Canny (Full Pipeline)</option>
            <option value="sobel">Sobel</option>
            <option value="prewitt">Prewitt</option>
            <option value="laplacian">Laplacian of Gaussian</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="edgeRun()">▶ Detect</button>
      </div>

      <div id="edge-wrap" style="position:relative">
        <div id="edge-pipeline-wrap" style="display:none;margin-bottom:16px">
          <div class="section-label">Canny Pipeline Steps</div>
          <div class="pipeline" id="edge-pipe-steps"></div>
          <div class="grid-2" style="margin-top:12px">
            <div class="card">
              <div class="card-title" id="edge-step-title">—</div>
              <div class="img-box" style="min-height:200px"><img id="edge-step-img" src="" alt=""/></div>
            </div>
            <div class="card">
              <div class="card-title">Final Edges</div>
              <div class="img-box" style="min-height:200px"><img id="edge-final" src="" alt=""/></div>
            </div>
          </div>
        </div>

        <div id="edge-simple-wrap" style="display:none">
          <div class="grid-3" style="margin-bottom:16px">
            <div class="card">
              <div class="card-title">Original</div>
              <div class="img-box" style="min-height:180px"><img id="edge-original" src="" alt=""/></div>
            </div>
            <div class="card">
              <div class="card-title" id="edge-gx-title">Gradient X</div>
              <div class="img-box" style="min-height:180px"><img id="edge-gx" src="" alt=""/></div>
            </div>
            <div class="card card-accent-cyan">
              <div class="card-title">Edge Map</div>
              <div class="img-box" style="min-height:180px"><img id="edge-map" src="" alt=""/></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  init() { edgeRun(); }
};

let _edgeData = null;
let _edgePipeStep = 0;

const CANNY_STEPS = [
  { key: 'blurred', title: '① Gaussian Blur' },
  { key: 'gradient_x', title: '② Gradient X (Sobel)' },
  { key: 'gradient_y', title: '③ Gradient Y (Sobel)' },
  { key: 'magnitude', title: '④ Gradient Magnitude' },
  { key: 'nms', title: '⑤ Non-Max Suppression' },
  { key: 'edges', title: '⑥ Hysteresis Threshold (Final)' }
];

async function edgeRun() {
  const method = document.getElementById('edge-method').value;
  showLoading('edge-wrap');
  try {
    const data = await apiCall('/api/edge/detect', window._uploadedFile, { method });
    _edgeData = data;
    _edgePipeStep = 0;

    const isCanny = method === 'canny';
    document.getElementById('edge-pipeline-wrap').style.display = isCanny ? 'block' : 'none';
    document.getElementById('edge-simple-wrap').style.display = isCanny ? 'none' : 'block';

    if (isCanny) {
      // Build pipeline buttons
      const pipe = document.getElementById('edge-pipe-steps');
      pipe.innerHTML = '';
      CANNY_STEPS.forEach((step, i) => {
        const btn = document.createElement('div');
        btn.className = 'pipe-step' + (i === 0 ? ' active' : '');
        btn.id = `pipe-step-${i}`;
        btn.innerHTML = `<span class="pipe-num">${i + 1}</span>${step.title.replace(/^[①②③④⑤⑥]\s*/, '')}`;
        btn.onclick = () => edgeSetStep(i);
        pipe.appendChild(btn);
      });
      setImage('edge-final', data.edges);
      edgeSetStep(0);
    } else {
      setImage('edge-original', data.original);
      if (data.gradient_x) setImage('edge-gx', data.gradient_x);
      else if (data.blurred) setImage('edge-gx', data.blurred);
      setImage('edge-map', data.edges);
      const gxTitle = document.getElementById('edge-gx-title');
      if (gxTitle) gxTitle.textContent = method === 'laplacian' ? 'Gaussian Blurred' : 'Gradient X';
    }
  } catch (e) { showError('edge-wrap', e.message); }
  hideLoading('edge-wrap');
}

function edgeSetStep(idx) {
  _edgePipeStep = idx;
  document.querySelectorAll('.pipe-step').forEach((el, i) => el.classList.toggle('active', i === idx));
  const step = CANNY_STEPS[idx];
  const titleEl = document.getElementById('edge-step-title');
  const imgEl = document.getElementById('edge-step-img');
  if (titleEl) titleEl.textContent = step.title;
  if (imgEl && _edgeData && _edgeData[step.key]) {
    imgEl.src = 'data:image/png;base64,' + _edgeData[step.key];
  }
}
