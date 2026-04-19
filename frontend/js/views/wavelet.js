// views/wavelet.js
window.views.wavelet = {
  render() {
    return `
      ${makeViewHeader('Chapter 7 — Wavelet Transforms', 'WAVELET FAMILIES',
        'Different wavelet families (Haar, Daubechies, Symlets, Coiflets) have different properties — smoothness, support length, and vanishing moments — affecting the quality of image decomposition.'
      )}
      <div class="controls-bar">
        <div class="ctrl-group">
          <div class="ctrl-label">Wavelet Family</div>
          <select class="ctrl-select" id="wv-family" onchange="waveletRun()">
            <option value="haar">Haar</option>
            <option value="db2">Daubechies-2</option>
            <option value="db4" selected>Daubechies-4</option>
            <option value="db8">Daubechies-8</option>
            <option value="sym4">Symlet-4</option>
            <option value="coif2">Coiflet-2</option>
            <option value="bior2.2">Biorthogonal-2.2</option>
          </select>
        </div>
        <div class="ctrl-group">
          <div class="ctrl-label">Levels</div>
          <select class="ctrl-select" id="wv-levels" onchange="waveletRun()">
            <option value="2" selected>2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="waveletRun()">▶ Analyze</button>
      </div>

      <div id="wv-wrap" style="position:relative">
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Image</div>
            <div class="img-box" style="min-height:180px"><img id="wv-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Wavelet Decomposition Layout</div>
            <div class="img-box" style="min-height:180px"><img id="wv-layout" src="" alt=""/></div>
          </div>
        </div>

        <div class="section-label">Filter Bank Info</div>
        <div class="card" style="margin-bottom:16px" id="wv-filter-card">
          <div class="card-title">Decomposition Filters</div>
          <div id="wv-filter-info" style="display:flex;gap:24px;flex-wrap:wrap"></div>
        </div>

        <div class="section-label">Level Subbands</div>
        <div id="wv-levels-out"></div>
      </div>
    `;
  },
  init() { waveletRun(); }
};

async function waveletRun() {
  const wavelet = document.getElementById('wv-family').value;
  const levels = document.getElementById('wv-levels').value;
  showLoading('wv-wrap');
  try {
    const data = await apiCall('/api/wavelet/decompose', window._uploadedFile, { wavelet, levels });
    setImage('wv-original', data.original);
    setImage('wv-layout', data.full_layout);

    // Filter info
    const fi = document.getElementById('wv-filter-info');
    const info = data.wavelet_info;
    fi.innerHTML = `
      <div class="stat-chip">Wavelet: <strong>${info.name}</strong></div>
      <div class="stat-chip">Filter Length: <strong>${info.filter_length}</strong></div>
      <div>
        <div class="ctrl-label" style="margin-bottom:6px">Low-pass filters (dec_lo)</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${info.dec_lo.map(v => `<span style="font-family:var(--font-mono);font-size:10px;padding:3px 7px;background:var(--cyan-glow);border:1px solid var(--border);border-radius:4px;color:var(--cyan)">${v.toFixed(4)}</span>`).join('')}
        </div>
      </div>
      <div>
        <div class="ctrl-label" style="margin-bottom:6px">High-pass filters (dec_hi)</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${info.dec_hi.map(v => `<span style="font-family:var(--font-mono);font-size:10px;padding:3px 7px;background:var(--orange-glow);border:1px solid rgba(255,107,53,0.2);border-radius:4px;color:var(--orange)">${v.toFixed(4)}</span>`).join('')}
        </div>
      </div>
    `;

    // Level subbands
    const container = document.getElementById('wv-levels-out');
    container.innerHTML = '';
    data.levels.forEach(lvl => {
      const div = document.createElement('div');
      div.style.marginBottom = '16px';
      div.innerHTML = `
        <div class="section-label" style="margin-top:0">Level ${lvl.level}</div>
        <div class="grid-4">
          <div class="card"><div class="card-title">LL Approximation</div><div class="img-box"><img src="data:image/png;base64,${lvl.approximation}"/></div></div>
          <div class="card"><div class="card-title">LH Horizontal</div><div class="img-box"><img src="data:image/png;base64,${lvl.horizontal}"/></div></div>
          <div class="card"><div class="card-title">HL Vertical</div><div class="img-box"><img src="data:image/png;base64,${lvl.vertical}"/></div></div>
          <div class="card"><div class="card-title">HH Diagonal</div><div class="img-box"><img src="data:image/png;base64,${lvl.diagonal}"/></div></div>
        </div>
      `;
      container.appendChild(div);
    });

  } catch (e) { showError('wv-wrap', e.message); }
  hideLoading('wv-wrap');
}
