// views/otsu.js — Otsu Thresholding
window.views.otsu = {
  render() {
    return `
      ${makeViewHeader('Chapter 10 — Image Segmentation', 'OTSU THRESHOLDING',
        'Otsu\'s method finds the optimal global threshold by maximizing between-class variance. The peak of the variance curve is the ideal threshold — it best separates foreground from background.'
      )}
      <div class="controls-bar">
        <button class="btn btn-primary" onclick="otsuRun()">▶ Compute Threshold</button>
      </div>
      <div id="otsu-wrap" style="position:relative">
        <div class="stats-row" id="otsu-stats"></div>
        <div class="grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Original Grayscale</div>
            <div class="img-box" style="min-height:180px"><img id="otsu-original" src="" alt=""/></div>
          </div>
          <div class="card card-accent-cyan">
            <div class="card-title">Binary (Otsu Threshold)</div>
            <div class="img-box" style="min-height:180px">
              <img id="otsu-binary" src="" alt=""/>
              <div class="img-badge" id="otsu-thresh-badge">T = —</div>
            </div>
          </div>
        </div>
        <div class="section-label">Histogram & Between-Class Variance</div>
        <div class="card card-accent-cyan">
          <div class="card-title">Gray level histogram with optimal threshold marker</div>
          <canvas id="otsu-chart" height="160"></canvas>
        </div>
      </div>
    `;
  },
  init() { otsuRun(); }
};

async function otsuRun() {
  showLoading('otsu-wrap');
  try {
    const data = await apiCall('/api/threshold/otsu', window._uploadedFile);
    setImage('otsu-original', data.original);
    setImage('otsu-binary', data.binary);
    document.getElementById('otsu-thresh-badge').textContent = `T* = ${data.threshold}`;
    document.getElementById('otsu-stats').innerHTML = `
      <div class="stat-chip">Optimal Threshold: <strong>${data.threshold}</strong></div>
      <div class="stat-chip">Background: <strong>0 – ${data.threshold - 1}</strong></div>
      <div class="stat-chip">Foreground: <strong>${data.threshold} – 255</strong></div>
    `;

    destroyChart('otsu-chart');
    const labels = Array.from({ length: 256 }, (_, i) => i);
    const maxVar = Math.max(...data.between_class_variance);

    new Chart(document.getElementById('otsu-chart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Histogram',
            data: data.histogram,
            backgroundColor: labels.map(i => i < data.threshold ? 'rgba(139,92,246,0.5)' : 'rgba(0,245,255,0.5)'),
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Between-class Variance',
            data: data.between_class_variance,
            borderColor: '#ff6b35',
            backgroundColor: 'transparent',
            type: 'line',
            yAxisID: 'y1',
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.4,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e8f4f8', font: { family: 'JetBrains Mono', size: 11 } } },
          annotation: {}
        },
        scales: {
          x: {
            ticks: { color: '#7ab3c8', maxTicksLimit: 32, font: { size: 9 } },
            grid: { color: 'rgba(0,245,255,0.04)' }
          },
          y: {
            position: 'left',
            ticks: { color: '#8b5cf6' },
            grid: { color: 'rgba(0,245,255,0.04)' }
          },
          y1: {
            position: 'right',
            ticks: { color: '#ff6b35' },
            grid: { drawOnChartArea: false }
          }
        }
      },
      plugins: [{
        // Draw threshold line
        afterDraw(chart) {
          const { ctx, scales } = chart;
          const xScale = scales.x;
          const yScale = scales.y;
          const x = xScale.getPixelForValue(data.threshold);
          ctx.save();
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(x, chart.chartArea.top);
          ctx.lineTo(x, chart.chartArea.bottom);
          ctx.stroke();
          ctx.fillStyle = '#ff6b35';
          ctx.font = '11px JetBrains Mono';
          ctx.fillText(`T*=${data.threshold}`, x + 4, chart.chartArea.top + 16);
          ctx.restore();
        }
      }]
    });
  } catch (e) { showError('otsu-wrap', e.message); }
  hideLoading('otsu-wrap');
}
