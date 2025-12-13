/**
 * ASPPIBRA DAO - Dashboard Logic
 * Handles Theme, Real-time Pricing (DexScreener), and System Metrics.
 */

// --- THEME LOGIC ---
const toggleButton = document.getElementById('theme-toggle');
const body = document.body;

function applyTheme(theme) { 
  body.className = ''; 
  body.classList.add('theme-' + theme); 
  if(toggleButton) toggleButton.innerText = theme === 'dark' ? '☀️' : '🌙'; 
  localStorage.setItem('theme', theme); 
}

function toggleTheme() { 
  const currentTheme = body.classList.contains('theme-dark') ? 'dark' : 'light'; 
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); 
}

function initTheme() { 
  const savedTheme = localStorage.getItem('theme'); 
  if (savedTheme) applyTheme(savedTheme); 
  else applyTheme('dark'); 
}

if(toggleButton) toggleButton.addEventListener('click', toggleTheme);
initTheme();

// --- LATENCY SIMULATOR (FOOTER) ---
setInterval(() => {
  const latency = Math.floor(Math.random() * (45 - 15 + 1) + 15);
  const latElem = document.getElementById('footer-latency');
  if(latElem) latElem.innerText = latency + 'ms';
}, 3000);

// --- MARKET BANNER LOGIC ---
const sparklinePath = document.getElementById('sparkline-path');
const sparklineFill = document.getElementById('sparkline-fill');
const priceDisplay = document.getElementById('price-display');
const changeDisplay = document.getElementById('price-change');
const liqDisplay = document.getElementById('liquidity-display');
const mcapDisplay = document.getElementById('mcap-display');
const chartFillGradient = document.getElementById('chartFill');

let chartData = []; 
const MAX_POINTS = 20;

function formatCompact(num) {
  return Intl.NumberFormat('en-US', {
      notation: "compact",
      maximumFractionDigits: 1
  }).format(num);
}

async function fetchLivePrice() {
  try {
      const res = await fetch('/api/rwa/price');
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      return data; 
  } catch (e) {
      console.error("Price fetch error:", e);
      return null; 
  }
}

async function updateSparkline() {
  if(!sparklinePath) return;

  const data = await fetchLivePrice();
  
  const currentPrice = (data && data.price) ? data.price : (chartData.length > 0 ? chartData[chartData.length-1] : 0.45);
  const change24h = (data && data.change24h) ? data.change24h : 0;
  const liquidity = (data && data.liquidity) ? data.liquidity : 0;
  const mcap = (data && data.marketCap) ? data.marketCap : 0;

  chartData.push(currentPrice);
  if(chartData.length > MAX_POINTS) chartData.shift(); 
  if(chartData.length === 1) chartData = Array(MAX_POINTS).fill(currentPrice);

  const isPositive = change24h >= 0;
  const color = isPositive ? '#00ff9d' : '#ef4444'; 
  
  // Update DOM Elements
  if(priceDisplay) priceDisplay.innerText = '$' + currentPrice.toFixed(4);
  
  if(changeDisplay) {
      const sign = isPositive ? '▲ +' : '▼ ';
      changeDisplay.innerText = sign + Math.abs(change24h).toFixed(2) + '% (24h)';
      changeDisplay.style.color = color;
      changeDisplay.style.background = isPositive ? 'rgba(0, 255, 157, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  }

  if(liqDisplay) {
     liqDisplay.innerHTML = 'Liq: <span class="stat-val">$' + formatCompact(liquidity) + '</span>';
  }
  if(mcapDisplay) {
     mcapDisplay.innerHTML = 'MCap: <span class="stat-val">$' + formatCompact(mcap) + '</span>';
  }

  // Update Chart Colors
  sparklinePath.setAttribute('stroke', color);
  if(chartFillGradient) {
      const stops = chartFillGradient.getElementsByTagName('stop');
      if(stops.length >= 2) {
          stops[0].setAttribute('stop-color', color);
          stops[1].setAttribute('stop-color', color);
      }
  }

  // Draw SVG
  const min = Math.min(...chartData);
  const max = Math.max(...chartData);
  const range = (max - min) === 0 ? 0.0001 : (max - min); 
  const points = chartData.map((val, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 80 - 10; 
    return x + ',' + y;
  });
  
  const lineD = 'M' + points.join(' L');
  sparklinePath.setAttribute('d', lineD);
  if(sparklineFill) {
      sparklineFill.setAttribute('d', lineD + ' L100,120 L0,120 Z');
  }
}

// Start Market Updates (10s)
setInterval(updateSparkline, 10000); 
updateSparkline(); 

// --- SYSTEM METRICS LOGIC ---
async function fetchMetrics() {
  const lblTotalRequests = document.getElementById('lbl-total-requests');
  const lblTotalBytes = document.getElementById('lbl-total-bytes');
  const lblSummaryWrites = document.getElementById('lbl-summary-writes');
  const lblReads = document.getElementById('lbl-reads');
  const lblWrites = document.getElementById('lbl-writes');
  const lblCacheRatio = document.getElementById('lbl-cache-ratio');
  const listCountries = document.getElementById('list-countries');
  const lblWorkload = document.getElementById('lbl-workload');
  const barWorkload = document.getElementById('bar-workload');

  try {
    const response = await fetch('/monitoring');
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    if(lblTotalRequests) lblTotalRequests.innerText = data.requests.toLocaleString();
    
    const bytes = data.bytes;
    let byteStr = "0 B";
    if (bytes > 1073741824) byteStr = (bytes / 1073741824).toFixed(2) + " GB";
    else if (bytes > 1048576) byteStr = (bytes / 1048576).toFixed(2) + " MB";
    else byteStr = (bytes / 1024).toFixed(0) + " KB";
    if(lblTotalBytes) lblTotalBytes.innerText = byteStr;
    
    if(data.cacheRatio && lblCacheRatio) lblCacheRatio.innerText = data.cacheRatio + "%";
    if(lblSummaryWrites) lblSummaryWrites.innerText = data.dbWrites.toLocaleString();
    if(lblReads) lblReads.innerText = data.dbReads.toLocaleString();
    if(lblWrites) lblWrites.innerText = data.dbWrites.toLocaleString();

    const maxVal = Math.max(data.dbReads, data.dbWrites, 100);
    const elBarReads = document.getElementById('bar-reads');
    const elBarWrites = document.getElementById('bar-writes');
    
    if(elBarReads) elBarReads.style.width = Math.min(100, (data.dbReads / maxVal) * 100) + "%";
    if(elBarWrites) elBarWrites.style.width = Math.min(100, (data.dbWrites / maxVal) * 100) + "%";
    
    if(barWorkload) barWorkload.style.width = Math.min(100, (data.dbWrites / maxVal) * 100) + "%";
    if(lblWorkload) lblWorkload.innerText = "Low"; 

    if(listCountries) {
        listCountries.innerHTML = ''; 
        if(data.countries && data.countries.length > 0) {
            data.countries.forEach(c => {
                const li = document.createElement('li');
                li.className = 'country-item';
                const code = c.code || 'UNK';
                const flagUrl = 'https://flagsapi.com/' + code + '/flat/32.png';
                
                // Usando concatenação simples para evitar erro no template literal do HTML
                const htmlContent = 
                  '<div class="flag-wrapper">' +
                    '<img src="' + flagUrl + '" style="width:24px; height:24px; object-fit:contain;" onerror="this.style.display=\'none\'">' +
                    '<span class="country-code">' + code + '</span>' +
                  '</div>' +
                  '<span style="font-family:\'JetBrains Mono\', monospace; font-weight:700; color: var(--text-highlight);">' +
                    c.count.toLocaleString() +
                  '</span>';
                li.innerHTML = htmlContent;
                listCountries.appendChild(li);
            });
        } else {
            listCountries.innerHTML = '<li class="country-item">No traffic data</li>';
        }
    }
  } catch (e) {
    console.error(e);
  }
}

// Start System Metrics (30s)
fetchMetrics();
setInterval(fetchMetrics, 30000);