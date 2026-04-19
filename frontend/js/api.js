// ═══════════════════════════════════════════════
// api.js — Global state, API, Background Canvas
// ═══════════════════════════════════════════════

// ✅ FIXED: Always point to Render backend
const API_BASE = "https://imagenova.onrender.com";

window._uploadedFile = null;
window.views = {};

// ── API Call ──────────────────────────────────
async function apiCall(endpoint, file = null, params = {}) {
  const form = new FormData();
  if (file) form.append('file', file);
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt.slice(0, 100)}`);
  }

  return res.json();
}

// ── Health check ──────────────────────────────
async function checkHealth() {
  try {
    const r = await fetch(`${API_BASE}/api/health`);
    if (!r.ok) throw new Error();

    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('api-status-text');

    if (dot) dot.className = 'status-dot ok';
    if (txt) txt.textContent = 'API Ready';

    return true;
  } catch (e) {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('api-status-text');

    if (dot) dot.className = 'status-dot err';
    if (txt) txt.textContent = 'API Offline';

    return false;
  }
}
checkHealth();
setInterval(checkHealth, 15000);

// ── Upload handling ───────────────────────────
const fileInput = document.getElementById('file-input');
const uploadTrigger = document.getElementById('upload-trigger');
const uploadZone = document.getElementById('upload-zone');

uploadTrigger.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;

  window._uploadedFile = f;

  document.getElementById('upload-label').textContent = f.name.slice(0, 22);

  const thumb = document.getElementById('thumb-preview');
  thumb.src = URL.createObjectURL(f);
  thumb.style.display = 'block';

  const clearBtn = document.getElementById('upload-clear');
  if (clearBtn) clearBtn.style.display = 'block';

  uploadTrigger.style.display = 'none';

  if (window._currentView) switchView(window._currentView, true);
});

// Drag and drop
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('dragging');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragging');
});

uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragging');

  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) {
    fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

function clearUpload() {
  window._uploadedFile = null;
  fileInput.value = '';

  document.getElementById('upload-label').textContent = 'Drop image or click';
  document.getElementById('thumb-preview').style.display = 'none';
  document.getElementById('upload-clear').style.display = 'none';
  document.getElementById('upload-trigger').style.display = 'flex';

  if (window._currentView) switchView(window._currentView, true);
}

// ── Loading helpers ───────────────────────────
function showLoading(elId) {
  const el = document.getElementById(elId);
  if (!el) return;

  el.style.position = 'relative';

  const ov = document.createElement('div');
  ov.className = 'loading-overlay';
  ov.id = 'lov-' + elId;
  ov.innerHTML = '<div class="spinner"></div>';

  el.appendChild(ov);
}

function hideLoading(elId) {
  const ov = document.getElementById('lov-' + elId);
  if (ov) ov.remove();
}

// ── Image setter ──────────────────────────────
function setImage(id, b64) {
  const el = document.getElementById(id);
  if (el && b64) {
    el.src = 'data:image/png;base64,' + b64;
  }
}

// ── Formatters ────────────────────────────────
function fmtNum(n, dec = 2) {
  if (typeof n !== 'number') return String(n);
  return n.toFixed(dec);
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ── Toast ─────────────────────────────────────
let _toastTimeout;

function showToast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '') + ' show';

  clearTimeout(_toastTimeout);

  _toastTimeout = setTimeout(() => {
    t.className = 'toast';
  }, 3500);
}

// ── Error display ─────────────────────────────
function showError(containerId, msg) {
  hideLoading(containerId);

  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `
      <div class="error-msg">
        ⚠ ${msg}<br>
        <small>Backend not reachable</small>
      </div>`;
  }

  showToast('Error: ' + msg, true);
}

// ── Chart helpers ─────────────────────────────
function destroyChart(id) {
  const c = Chart.getChart(id);
  if (c) c.destroy();
}