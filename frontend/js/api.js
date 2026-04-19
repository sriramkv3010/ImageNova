// ═══════════════════════════════════════════════
// api.js — Global state, API, Background Canvas
// ═══════════════════════════════════════════════

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : window.location.origin; // for deployed envs where backend is same origin

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
    if (dot) { dot.className = 'status-dot ok'; }
    if (txt) txt.textContent = 'API Ready';
    return true;
  } catch (e) {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('api-status-text');
    if (dot) { dot.className = 'status-dot err'; }
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
  // Re-run current view
  if (window._currentView) switchView(window._currentView, true);
});

// Drag and drop
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragging'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragging'));
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
  if (el && b64) el.src = 'data:image/png;base64,' + b64;
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
  _toastTimeout = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ── Error display ─────────────────────────────
function showError(containerId, msg) {
  hideLoading(containerId);
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<div class="error-msg">⚠ ${msg}<br><small>Check that the backend is running on port 8000</small></div>`;
  }
  showToast('Error: ' + msg, true);
}

// ── Chart helpers ─────────────────────────────
function destroyChart(id) {
  const c = Chart.getChart(id);
  if (c) c.destroy();
}

// ── Background Canvas Animation ───────────────
(function initBackground() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], grid = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Create particles (simulating wavelet coefficients)
  const COLS = 25, ROWS = 18;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid.push({
        x: (c / COLS) * W,
        y: (r / ROWS) * H,
        phase: Math.random() * Math.PI * 2,
        speed: 0.003 + Math.random() * 0.005,
        amp: 0.3 + Math.random() * 0.7,
        size: Math.random() > 0.92 ? 2 : 1,
        col: Math.random() > 0.8 ? '#ff6b35' : '#00f5ff'
      });
    }
  }

  // Floating scan line
  let scanY = 0;

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.025)';
    ctx.lineWidth = 1;
    const gsx = W / COLS, gsy = H / ROWS;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * gsx, 0);
      ctx.lineTo(c * gsx, H);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * gsy);
      ctx.lineTo(W, r * gsy);
      ctx.stroke();
    }

    // Grid dots (pulsing)
    grid.forEach(p => {
      const gx = p.x + Math.sin(t * p.speed + p.phase) * 3;
      const gy = p.y + Math.cos(t * p.speed * 0.7 + p.phase) * 3;
      const alpha = 0.08 + p.amp * 0.12 * Math.abs(Math.sin(t * p.speed + p.phase));
      ctx.fillStyle = p.col.replace(')', `, ${alpha})`).replace('rgb', 'rgba').replace('#00f5ff', `rgba(0,245,255,${alpha})`).replace('#ff6b35', `rgba(255,107,53,${alpha})`);

      // simpler:
      if (p.col === '#ff6b35') {
        ctx.fillStyle = `rgba(255, 107, 53, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(0, 245, 255, ${alpha})`;
      }
      ctx.beginPath();
      ctx.arc(gx, gy, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Horizontal scan line
    scanY = (scanY + 0.4) % H;
    const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
    grad.addColorStop(0, 'rgba(0,245,255,0)');
    grad.addColorStop(0.5, 'rgba(0,245,255,0.03)');
    grad.addColorStop(1, 'rgba(0,245,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 60, W, 120);

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
