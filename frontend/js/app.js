// ═══════════════════════════════════════════════
// app.js — Router & Shell
// ═══════════════════════════════════════════════

window._currentView = null;
let _sidebarOpen = true;

const VIEW_META = {
  haar: { chapter: 'Wavelet Transforms', title: 'Haar Decomposition', kbdHints: '← → to change level' },
  wavelet: { chapter: 'Wavelet Transforms', title: 'Wavelet Families', kbdHints: '' },
  'wavelet-reconstruct': { chapter: 'Wavelet Transforms', title: 'Reconstruction & PSNR', kbdHints: '' },
  dct: { chapter: 'Image Compression', title: 'DCT Block Coding', kbdHints: '← → to change quality' },
  huffman: { chapter: 'Image Compression', title: 'Huffman Coding', kbdHints: '' },
  bitplane: { chapter: 'Image Compression', title: 'Bit-Plane Decomposition', kbdHints: 'Click planes to toggle' },
  runlength: { chapter: 'Image Compression', title: 'Run-Length Encoding', kbdHints: '' },
  'wavelet-coding': { chapter: 'Image Compression', title: 'Wavelet Compression', kbdHints: '' },
  padding: { chapter: 'Segmentation', title: 'Padding & Convolution', kbdHints: '← → to step through kernel' },
  pooling: { chapter: 'Segmentation', title: 'Pooling Operations', kbdHints: '' },
  edge: { chapter: 'Segmentation', title: 'Edge Detection', kbdHints: '1-4 to switch pipeline step' },
  otsu: { chapter: 'Segmentation', title: 'Otsu Thresholding', kbdHints: '' },
  kmeans: { chapter: 'Segmentation', title: 'K-Means Segmentation', kbdHints: '← → to step iterations' },
  watershed: { chapter: 'Segmentation', title: 'Watershed Segmentation', kbdHints: '' },
};

function switchView(name, forceReload = false) {
  if (window._currentView === name && !forceReload) return;
  window._currentView = name;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === name);
  });

  // Update breadcrumb
  const meta = VIEW_META[name] || {};
  document.getElementById('bc-chapter').textContent = meta.chapter || '';
  document.getElementById('bc-algo').textContent = meta.title || name;
  document.getElementById('kbd-hints').textContent = meta.kbdHints || '';

  // Hide splash
  const splash = document.getElementById('welcome-splash');
  if (splash) splash.style.display = 'none';

  // Get or create view container
  const vc = document.getElementById('views-container');
  
  // Remove old active view
  const old = vc.querySelector('.view-panel');
  if (old) old.remove();

  // Create new view
  const viewDef = window.views[name];
  if (!viewDef) {
    vc.innerHTML = '<div class="error-msg">View not found: ' + name + '</div>';
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'view-panel';
  wrapper.innerHTML = viewDef.render();
  vc.appendChild(wrapper);

  // Scroll to top
  vc.scrollTop = 0;

  // Init view
  requestAnimationFrame(() => {
    if (viewDef.init) viewDef.init();
  });
}

function toggleSidebar() {
  _sidebarOpen = !_sidebarOpen;
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  if (_sidebarOpen) {
    sidebar.classList.remove('sidebar-hidden');
    main.classList.remove('full-width');
  } else {
    sidebar.classList.add('sidebar-hidden');
    main.classList.add('full-width');
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') toggleSidebar();
  if (e.key === 'ArrowRight') {
    if (window._currentView === 'kmeans' && typeof kmeansNext === 'function') kmeansNext();
    if (window._currentView === 'padding' && typeof padStepNext === 'function') padStepNext();
    if (window._currentView === 'haar' && typeof haarNextLevel === 'function') haarNextLevel();
    if (window._currentView === 'dct' && typeof dctQualityUp === 'function') dctQualityUp();
  }
  if (e.key === 'ArrowLeft') {
    if (window._currentView === 'kmeans' && typeof kmeansPrev === 'function') kmeansPrev();
    if (window._currentView === 'padding' && typeof padStepPrev === 'function') padStepPrev();
    if (window._currentView === 'haar' && typeof haarPrevLevel === 'function') haarPrevLevel();
    if (window._currentView === 'dct' && typeof dctQualityDown === 'function') dctQualityDown();
  }
  if (e.key === 'u' || e.key === 'U') {
    document.getElementById('file-input').click();
  }
});

// ── Helper: make header HTML ──────────────────
function makeViewHeader(chapterTag, title, desc) {
  return `
    <div class="view-header">
      <div class="view-chapter-tag">${chapterTag}</div>
      <div class="view-title">${title}</div>
      ${desc ? `<div class="view-desc">${desc}</div>` : ''}
    </div>`;
}
