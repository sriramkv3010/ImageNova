// ═══════════════════════════════════════════════
// api.js — Global state, API, Background Canvas
// ═══════════════════════════════════════════════

// ✅ Always use deployed backend
const API_BASE = "https://imagenova.onrender.com";

window._uploadedFile = null;
window.views = {};

// ── API Call ──────────────────────────────────
async function apiCall(endpoint, file = null, params = {}) {

  // 🚨 Prevent bad requests
  if (!file) {
    showToast("Upload image first", true);
    throw new Error("No image uploaded");
  }

  const form = new FormData();
  form.append('file', file);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      form.append(k, String(v));
    }
  });

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

  } catch (e) {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('api-status-text');

    if (dot) dot.className = 'status-dot err';
    if (txt) txt.textContent = 'API Offline';
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

// Drag-drop
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

// ── Helpers ───────────────────────────────────
function showLoading(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const ov = document.createElement('div');
  ov.className = 'loading-overlay';
  ov.innerHTML = '<div class="spinner"></div>';
  ov.id = 'lov-' + id;

  el.appendChild(ov);
}

function hideLoading(id) {
  const ov = document.getElementById('lov-' + id);
  if (ov) ov.remove();
}

function setImage(id, b64) {
  const el = document.getElementById(id);
  if (el && b64) el.src = 'data:image/png;base64,' + b64;
}

function fmtNum(n, d = 2) {
  return typeof n === 'number' ? n.toFixed(d) : n;
}

// Toast
let _toastTimeout;
function showToast(msg, err = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '') + ' show';

  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => t.className = 'toast', 3000);
}

// Error display
function showError(id, msg) {
  hideLoading(id);
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = `
      <div class="error-msg">
        ⚠ ${msg}<br>
        <small>Upload image before running</small>
      </div>`;
  }
}