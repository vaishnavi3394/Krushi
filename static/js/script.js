/* ============================================
   KrishiMool · script.js
   Frontend logic — calls Flask /api/predict
   ============================================ */
'use strict';

const API = '';   // same origin — Flask serves everything

// ── Language ──────────────────────────────────────────────────────────────────
let lang = 'en';

function t(en, mr) { return lang === 'mr' ? mr : en; }

function applyLang(l) {
  lang = l;
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = el.getAttribute(`data-${l}`) || el.getAttribute('data-en');
    if (el.tagName === 'OPTION') {
      el.textContent = val;
    } else if (!el.children.length || el.classList.contains('brand-name')) {
      el.textContent = val;
    }
  });
  document.getElementById('langLabel').textContent = l === 'en' ? 'मराठी' : 'English';
}

document.getElementById('langToggle').addEventListener('click', () => {
  applyLang(lang === 'en' ? 'mr' : 'en');
});

// ── Dark Mode ──────────────────────────────────────────────────────────────────
let dark = false;
document.getElementById('darkToggle').addEventListener('click', () => {
  dark = !dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('darkIcon').textContent = dark ? '☀️' : '🌙';
  if (lastChart) rebuildChart();
});

// ── Tooltips ───────────────────────────────────────────────────────────────────
const tipEl = document.getElementById('tooltipPopup');
document.querySelectorAll('.tooltip').forEach(tip => {
  tip.addEventListener('mouseenter', e => {
    tipEl.textContent = e.target.getAttribute(`data-tip-${lang}`) || e.target.getAttribute('data-tip-en');
    tipEl.classList.add('visible');
  });
  tip.addEventListener('mousemove', e => {
    tipEl.style.left = (e.clientX + 14) + 'px';
    tipEl.style.top  = (e.clientY - 10) + 'px';
  });
  tip.addEventListener('mouseleave', () => tipEl.classList.remove('visible'));
});

// ── Chart ──────────────────────────────────────────────────────────────────────
let chartInst = null;
let lastChart = null;

function renderChart(labels, prices, cropLabel) {
  document.getElementById('chartCropLabel').textContent = cropLabel;
  lastChart = { labels, prices, cropLabel };

  const ctx  = document.getElementById('priceChart').getContext('2d');
  if (chartInst) chartInst.destroy();

  const isDark    = dark;
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const tickColor = isDark ? '#6a8e62' : '#7a9170';

  chartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Modal Price (₹/qtl)',
        data: prices,
        fill: true,
        borderColor: '#2d7a22',
        backgroundColor: isDark ? 'rgba(91,186,76,0.10)' : 'rgba(45,122,34,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: '#2d7a22',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.42,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#182112' : '#ffffff',
          borderColor: '#2d7a22',
          borderWidth: 1,
          titleColor: isDark ? '#a8c89e' : '#4a5e42',
          bodyColor:  isDark ? '#e8f4e2' : '#1a2412',
          padding: 12,
          callbacks: {
            label: ctx => `  ₹ ${ctx.parsed.y.toLocaleString('en-IN')} / qtl`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { family: 'DM Sans', size: 12 } },
          border: { dash: [4, 4] }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { family: 'DM Sans', size: 12 },
            callback: v => '₹' + v.toLocaleString('en-IN')
          },
          border: { dash: [4, 4] }
        }
      }
    }
  });
}

function rebuildChart() {
  if (lastChart) renderChart(lastChart.labels, lastChart.prices, lastChart.cropLabel);
}

// ── Show Results ───────────────────────────────────────────────────────────────
function showResults(d) {
  // Predicted price
  document.getElementById('priceVal').textContent   = d.predicted.toLocaleString('en-IN');
  document.getElementById('priceRange').textContent =
    `${t('Range','श्रेणी')}: ₹${d.low.toLocaleString('en-IN')} – ₹${d.high.toLocaleString('en-IN')} / qtl`;

  // Sell advice
  document.getElementById('sellAdvice').textContent = d.trend === 'up'
    ? t('📅 Best time to sell: Next 2 weeks', '📅 सर्वोत्तम विक्री वेळ: पुढील 2 आठवडे')
    : t('📅 Best time to sell: Sell now (prices may soften)', '📅 सर्वोत्तम विक्री वेळ: आत्ताच विकणे उत्तम');

  // Trend badge
  const badge = document.getElementById('trendBadge');
  if (d.trend === 'up') {
    badge.textContent = t('📈 Price trending upward', '📈 किंमत वाढत आहे');
    badge.className   = 'trend-badge up';
  } else {
    badge.textContent = t('📉 Price may soften', '📉 किंमत कमी होऊ शकते');
    badge.className   = 'trend-badge down';
  }

  // Data source note
  document.getElementById('dataSrcNote').textContent = d.records_used > 0
    ? t(`📊 Based on ${d.records_used} Agmarknet records`, `📊 ${d.records_used} अ‍ॅग्रोमार्केट नोंदींवर आधारित`)
    : t('📊 Based on seasonal model (no local data)', '📊 हंगामी मॉडेलवर आधारित');

  // Mini cards
  const arr = parseFloat(document.getElementById('arrival').value);
  document.getElementById('demandVal').textContent =
    arr < 100 ? t('🔥 Very High','🔥 खूप जास्त')
    : arr < 500 ? t('⬆️ High','⬆️ जास्त')
    : arr < 2000 ? t('➡️ Moderate','➡️ मध्यम')
    : t('⬇️ Low','⬇️ कमी');

  document.getElementById('supplyVal').textContent =
    arr < 100 ? t('⬇️ Low','⬇️ कमी')
    : arr < 500 ? t('➡️ Moderate','➡️ मध्यम')
    : t('⬆️ Ample','⬆️ पुरेसा');

  document.getElementById('mspVal').textContent = d.msp
    ? `₹${d.msp.toLocaleString('en-IN')} / qtl`
    : t('No MSP Fixed','MSP निश्चित नाही');

  document.getElementById('bestTimeVal').textContent = d.trend === 'up'
    ? t('Next 2 weeks','पुढील 2 आठवडे')
    : t('Sell immediately','आत्ताच विकणे उत्तम');

  // Nearby markets
  const marketsCard = document.getElementById('marketsCard');
  const marketsList = document.getElementById('marketsList');
  if (d.nearby_markets && d.nearby_markets.length > 0) {
    marketsList.innerHTML = d.nearby_markets
      .map(m => `<span class="market-chip">🏪 ${m}</span>`).join('');
    marketsCard.style.display = 'block';
  } else {
    marketsCard.style.display = 'none';
  }

  // Chart
  renderChart(d.history_labels, d.history_prices, d.crop_name);
}

// ── Weather Fetch (Open-Meteo) ───────────────────────────────────────────────
const STATE_COORDS = {
  'MH': { lat: 19.75, lon: 75.71 },
  'UP': { lat: 26.84, lon: 80.94 },
  'MP': { lat: 22.97, lon: 78.65 },
  'PB': { lat: 31.14, lon: 75.34 },
  'HR': { lat: 29.05, lon: 76.08 },
  'GJ': { lat: 22.25, lon: 71.19 },
  'RJ': { lat: 27.02, lon: 74.21 },
  'AP': { lat: 15.91, lon: 79.74 },
  'KA': { lat: 15.31, lon: 75.71 },
  'TN': { lat: 11.12, lon: 78.65 },
  'WB': { lat: 22.98, lon: 87.85 },
  'BR': { lat: 25.09, lon: 85.31 }
};

document.getElementById('state').addEventListener('change', async (e) => {
  const code = e.target.value;
  const tempInput = document.getElementById('temp');
  const rainInput = document.getElementById('rainfall');
  
  if (!code || !STATE_COORDS[code]) {
    tempInput.placeholder = 'e.g. 28';
    rainInput.placeholder = 'e.g. 50';
    return;
  }
  
  // Show loading state
  tempInput.placeholder = 'Fetching...';
  rainInput.placeholder = 'Fetching...';
  tempInput.value = '';
  rainInput.value = '';

  try {
    const { lat, lon } = STATE_COORDS[code];
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation`);
    const data = await res.json();
    
    if (data.current) {
      tempInput.value = data.current.temperature_2m || '';
      rainInput.value = data.current.precipitation || 0;
    }
  } catch (err) {
    console.error("Weather Fetch Error:", err);
    tempInput.placeholder = 'e.g. 28 (Error)';
    rainInput.placeholder = 'e.g. 50 (Error)';
  }
});

// ── Form Submit ───────────────────────────────────────────────────────────────
const form           = document.getElementById('predictForm');
const loadingWrap    = document.getElementById('loadingWrap');
const resultSection  = document.getElementById('resultSection');
const predictSection = document.getElementById('predictSection');
const errorBanner    = document.getElementById('errorBanner');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    crop:        document.getElementById('crop').value,
    state:       document.getElementById('state').value,
    month:       document.getElementById('month').value,
    arrival:     document.getElementById('arrival').value,
    rainfall:    document.getElementById('rainfall').value || null,
    temperature: document.getElementById('temp').value    || null,
  };

  if (!payload.crop || !payload.state || !payload.month || !payload.arrival) return;

  // Show loader
  predictSection.style.display = 'none';
  resultSection.style.display  = 'none';
  loadingWrap.style.display    = 'flex';
  errorBanner.style.display    = 'none';

  try {
    const res  = await fetch(`${API}/api/predict`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok || !json.success) throw new Error(json.error || 'Prediction failed');

    showResults(json.data);

    loadingWrap.style.display   = 'none';
    resultSection.style.display = 'block';
    resultSection.classList.remove('slide-up');
    void resultSection.offsetWidth; // reflow
    resultSection.classList.add('slide-up');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    loadingWrap.style.display    = 'none';
    predictSection.style.display = 'block';
    errorBanner.style.display    = 'block';
    errorBanner.innerHTML = `
      <strong>⚠️ Server Error:</strong> ${err.message}<br/>
      <small>Make sure Flask is running: <code>python app.py</code> → then open <code>http://localhost:5000</code></small>
    `;
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

// ── Reset ─────────────────────────────────────────────────────────────────────
document.getElementById('resetBtn').addEventListener('click', () => {
  resultSection.style.display  = 'none';
  predictSection.style.display = 'block';
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  lastChart = null;
  form.reset();
  setCurrentMonth();
  predictSection.scrollIntoView({ behavior: 'smooth' });
});

// ── Navbar shadow on scroll ───────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.querySelector('.navbar').style.boxShadow =
    window.scrollY > 10 ? '0 4px 24px rgba(45,122,34,0.13)' : 'none';
});

// ── Auto-set current month ────────────────────────────────────────────────────
function setCurrentMonth() {
  const sel = document.getElementById('month');
  if (sel) sel.value = new Date().getMonth() + 1;
}

// ── Init ──────────────────────────────────────────────────────────────────────
applyLang('en');
setCurrentMonth();

// ── Tabs Switching ────────────────────────────────────────────────────────────
const tabPredict = document.getElementById('tabPredict');
const tabTrends = document.getElementById('tabTrends');
const tabDisease = document.getElementById('tabDisease');

const predictionTab = document.getElementById('predictionTab');
const trendsTab = document.getElementById('trendsTab');
const diseaseTab = document.getElementById('diseaseTab');

tabPredict.addEventListener('click', () => {
  tabPredict.classList.add('active');
  tabTrends.classList.remove('active');
  if(tabDisease) tabDisease.classList.remove('active');
  
  predictionTab.style.display = 'block';
  trendsTab.style.display = 'none';
  if(diseaseTab) diseaseTab.style.display = 'none';
});

tabTrends.addEventListener('click', () => {
  tabTrends.classList.add('active');
  tabPredict.classList.remove('active');
  if(tabDisease) tabDisease.classList.remove('active');
  
  trendsTab.style.display = 'block';
  predictionTab.style.display = 'none';
  if(diseaseTab) diseaseTab.style.display = 'none';
});

if(tabDisease) {
  tabDisease.addEventListener('click', () => {
    tabDisease.classList.add('active');
    tabPredict.classList.remove('active');
    tabTrends.classList.remove('active');
    
    diseaseTab.style.display = 'block';
    predictionTab.style.display = 'none';
    trendsTab.style.display = 'none';
  });
}

// ── Historical Trends Logic ───────────────────────────────────────────────────
const trendCropSelect = document.getElementById('trendCrop');
const trendsChartCard = document.getElementById('trendsChartCard');
let historicalChartInst = null;

trendCropSelect.addEventListener('change', async (e) => {
  const crop = e.target.value;
  if (!crop) {
    trendsChartCard.style.display = 'none';
    if (historicalChartInst) { historicalChartInst.destroy(); historicalChartInst = null; }
    return;
  }
  
  try {
    const res = await fetch(`${API}/api/historical-trends?crop=${crop}`);
    const json = await res.json();
    
    if (!res.ok) throw new Error(json.error || 'Failed to fetch trends');
    
    renderHistoricalChart(json.chartData);
    trendsChartCard.style.display = 'block';
    
  } catch (err) {
    console.error("Trends Fetch Error:", err);
    alert(t("Could not load trends data.", "ट्रेंड डेटा लोड करू शकलो नाही."));
  }
});

function renderHistoricalChart(chartData) {
  const ctx = document.getElementById('historicalTrendChart').getContext('2d');
  if (historicalChartInst) historicalChartInst.destroy();
  
  const isDark = dark;
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const tickColor = isDark ? '#6a8e62' : '#7a9170';
  
  historicalChartInst = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: tickColor, font: { family: 'DM Sans', size: 13 } }
        },
        tooltip: {
          backgroundColor: isDark ? '#182112' : '#ffffff',
          borderColor: '#2d7a22',
          borderWidth: 1,
          titleColor: isDark ? '#a8c89e' : '#4a5e42',
          bodyColor:  isDark ? '#e8f4e2' : '#1a2412',
          padding: 12,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ₹${context.parsed.y.toLocaleString('en-IN')}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { family: 'DM Sans', size: 12 } },
          border: { dash: [4, 4] }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { family: 'DM Sans', size: 12 },
            callback: v => '₹' + v.toLocaleString('en-IN')
          },
          border: { dash: [4, 4] }
        }
      }
    }
  });
}

// ── Disease Detection Logic ───────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
const leafImageInput = document.getElementById('leafImageInput');
const imagePreview = document.getElementById('imagePreview');
const uploadContent = document.querySelector('.upload-content');
const detectBtn = document.getElementById('detectBtn');
const detectLoader = document.getElementById('detectLoader');
const diseaseResultCard = document.getElementById('diseaseResultCard');

let selectedImageFile = null;

if(uploadZone) {
  uploadZone.addEventListener('click', () => leafImageInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if(e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageSelection(e.dataTransfer.files[0]);
    }
  });

  leafImageInput.addEventListener('change', (e) => {
    if(e.target.files && e.target.files.length > 0) {
      handleImageSelection(e.target.files[0]);
    }
  });

  function handleImageSelection(file) {
    if(!file.type.startsWith('image/')) {
      alert(t("Please upload a valid image file.", "कृपया वैध फोटो अपलोड करा."));
      return;
    }
    
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'block';
      uploadContent.style.display = 'none';
      detectBtn.style.display = 'block';
      diseaseResultCard.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  detectBtn.addEventListener('click', async () => {
    if(!selectedImageFile) return;

    // UI Loading state
    detectBtn.disabled = true;
    detectLoader.style.display = 'block';
    detectBtn.querySelector('.btn-text').style.display = 'none';
    diseaseResultCard.style.display = 'none';

    const formData = new FormData();
    formData.append('image', selectedImageFile);

    try {
      const res = await fetch(`${API}/api/detect-disease`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if(!res.ok) throw new Error(data.error || 'API Error');

      // Update Result UI
      document.getElementById('resDiseaseName').innerText = lang === 'mr' ? data.disease_mr : data.disease;
      
      const confColor = data.confidence > 90 ? 'var(--color-primary)' : (data.confidence > 70 ? '#f59e0b' : '#ef4444');
      document.getElementById('resConfidence').innerHTML = `<span style="color:${confColor}">Confidence: ${data.confidence}%</span>`;
      
      document.getElementById('resTreatment').innerText = lang === 'mr' ? data.treatment_mr : data.treatment;
      
      diseaseResultCard.style.display = 'block';
      
      // Scroll to result
      setTimeout(() => diseaseResultCard.scrollIntoView({behavior: 'smooth', block: 'nearest'}), 100);

    } catch (err) {
      console.error(err);
      alert(t("Failed to analyze image.", "फोटोचे विश्लेषण करण्यात अयशस्वी."));
    } finally {
      // Restore UI
      detectBtn.disabled = false;
      detectLoader.style.display = 'none';
      detectBtn.querySelector('.btn-text').style.display = 'inline-block';
    }
  });
}
