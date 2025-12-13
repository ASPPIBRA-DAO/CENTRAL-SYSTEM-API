import { html } from 'hono/html';

interface DashboardProps {
  version: string;
  service: string;
  cacheRatio: string;
  domain: string;
  imageUrl: string;
}

export const DashboardTemplate = (props: DashboardProps) => html`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <title>ASPPIBRA | Network Status</title>
    <meta name="description" content="Real-time telemetry and observability of ASPPIBRA DAO.">
    
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
    
    <style>
      /* Estilo do Botão de Compra */
      .buy-btn {
        background: var(--text-highlight);
        color: var(--bg-main);
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        margin-top: 1rem;
        z-index: 10;
        position: relative;
      }
      .buy-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        filter: brightness(1.1);
      }

      /* NOVO: Estilo para os dados secundários do banner (Liquidez + MCap) */
      .market-stats {
        font-size: 0.85rem; 
        color: var(--text-muted); 
        font-family: 'Inter', sans-serif;
        display: flex;
        gap: 10px;
        align-items: center;
        margin-top: 4px;
      }
      .stat-val {
        color: var(--text-highlight);
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
      }
      .stat-sep {
        opacity: 0.3;
        font-size: 0.8rem;
      }
    </style>
  </head>
  <body class="theme-dark"> 
    <div class="bg-grid"></div>
    
    <header>
      <div class="header-container">
        <div class="header-brand">
          <div class="logo-wrapper">
            <div class="logo-glow"></div>
            <img src="/android-chrome-192x192.png" alt="ASPPIBRA" class="header-logo" onerror="this.style.display='none'">
          </div>
          <div class="header-text-col">
            <h1 class="header-title">ASPPIBRA DAO</h1>            
          </div>
        </div>

        <div class="header-tools">
          <div class="network-pill" title="Network Status: Operational">
            <div class="pulse-dot"></div>
            <span class="network-text">API Stats</span>
          </div>
          <div class="divider"></div>
          <button class="wallet-btn" title="Connected: 0x71...F4">
            <div class="identicon"></div>
            <span class="wallet-addr">0x71...F4</span>
          </button>
          <button id="theme-toggle" title="Switch Theme">☀️</button>
        </div>
      </div>
    </header>

    <main>
      <div class="main-container">
        
        <div class="welcome-card glass-panel" style="padding: 0; display: flex; flex-direction: column; overflow: hidden; min-height: 280px; position: relative;">
          
          <div style="padding: 2rem 2.5rem 0; z-index: 5; display: flex; justify-content: space-between; align-items: flex-start; width: 100%; box-sizing: border-box;">
            
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
              <div style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 0.5rem;">
                 <span class="live-dot" style="background: var(--success-color); box-shadow: 0 0 10px var(--success-color);"></span>
                 <span style="font-family: 'JetBrains Mono'; font-size: 0.75rem; color: var(--success-color); letter-spacing: 1px; font-weight: 700;">LIVE MARKET</span>
              </div>
              
              <h2 style="font-size: 2rem; margin: 0; line-height: 1.1;">ASPPIBRA <span style="color: var(--text-highlight);">($ASPPBR)</span></h2>
              <p style="color: var(--text-muted); margin-top: 0.5rem; font-size: 0.95rem;">Official Governance & Utility Token.</p>

              <a href="https://app.uniswap.org/swap?chain=bnb&outputCurrency=0x0697AB2B003FD2Cbaea2dF1ef9b404E45bE59d4C" target="_blank" class="buy-btn">
                <span>BUY TOKEN</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
              </a>
            </div>

            <div style="text-align: right; z-index: 5;">
               <div id="price-display" style="font-family: 'JetBrains Mono'; font-size: 2.8rem; font-weight: 700; color: var(--text-highlight); letter-spacing: -1px;">
                 <span class="loading">...</span>
               </div>
               
               <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                 <div id="price-change" style="font-family: 'JetBrains Mono'; font-size: 0.9rem; padding: 4px 10px; border-radius: 6px; display: inline-block;">
                   --% (24h)
                 </div>
                 
                 <div class="market-stats">
                   <span id="liquidity-display">Liq: <span class="loading">--</span></span>
                   <span class="stat-sep">|</span>
                   <span id="mcap-display">MCap: <span class="loading">--</span></span>
                 </div>
               </div>
            </div>
          </div>

          <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 140px; width: 100%; pointer-events: none;">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow: visible;">
               <defs>
                 <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                   <stop offset="0%" stop-color="var(--success-color)" stop-opacity="0.3"/>
                   <stop offset="100%" stop-color="var(--success-color)" stop-opacity="0"/>
                 </linearGradient>
                 <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                 </filter>
               </defs>
               <path id="sparkline-fill" d="" fill="url(#chartFill)" stroke="none" />
               <path id="sparkline-path" d="" fill="none" stroke="var(--success-color)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" filter="url(#glow)" />
            </svg>            
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card glass-panel">
            <h3>Total Requests (24h)</h3>
            <p class="value" id="lbl-total-requests"><span class="loading">0000</span></p>
            <div class="label-badge">Monitoring</div>
          </div>
          <div class="summary-card glass-panel">
            <h3>Data Transfer</h3>
            <p class="value" id="lbl-total-bytes"><span class="loading">-- GB</span></p>
            <div class="label-badge">Bandwidth</div>
          </div>
          <div class="summary-card glass-panel">
            <h3>DB Workload</h3>
            <p class="value" id="lbl-summary-writes"><span class="loading">0</span></p>
            <div class="label-badge">Writes/Sec</div>
          </div>
        </div>

        <div class="tech-dashboard">
          <div class="col-system">
            <div class="governance-card glass-panel">
              <div class="logo-container">
                  <div class="logo-ring"></div>
                  <img src="/android-chrome-192x192.png" alt="Logo" class="logo-img" onerror="this.style.display='none'">
              </div>
              <h2 style="margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--text-highlight);">Governance System</h2>
              <p style="color: var(--text-muted); margin-top: 0.5rem; font-size: 0.9rem;">API Backend & DAO Services</p>
              <div class="status-badge"><span class="dot"></span> Operational</div>
              <div class="sys-details">
                <div class="sys-row"><span>Version</span> <span class="sys-val">${props.version}</span></div>
                <div class="sys-row"><span>Service</span> <span class="sys-val">${props.service}</span></div>
                <div class="sys-row"><span>Region</span> <span class="sys-val">Global</span></div>
                <div class="sys-row"><span>Cache Ratio</span> <span class="sys-val" id="lbl-cache-ratio">${props.cacheRatio}</span></div>
              </div>
            </div>
          </div>
          <div class="col-infra">
            <div class="db-metrics-row">
              <div class="metric-card glass-panel">
                <div class="metric-title">DB Reads (24h)</div>
                <div class="metric-value" id="lbl-reads"><span class="loading">--</span></div>
                <div class="metric-bar"><div class="bar-fill cyan" id="bar-reads" style="width: 0%;"></div></div>
              </div>
              <div class="metric-card glass-panel">
                <div class="metric-title">DB Writes (24h)</div>
                <div class="metric-value" id="lbl-writes"><span class="loading">--</span></div>
                <div class="metric-bar"><div class="bar-fill purple" id="bar-writes" style="width: 0%;"></div></div>
              </div>
              <div class="metric-card glass-panel">
                <div class="metric-title">DB Workload (24h)</div>
                <div class="metric-value" id="lbl-workload"><span class="loading">--</span></div>
                <div class="metric-bar"><div class="bar-fill purple" id="bar-workload" style="width: 0%;"></div></div>
              </div>
            </div>
            <div class="countries-card glass-panel">
              <div class="card-header">
                <h4 style="margin:0; font-weight:600; color: var(--text-highlight); display:flex; align-items:center; gap:8px;">
                  🌍 Traffic Origin
                </h4>
                <div class="live-indicator"><div class="live-dot"></div> Live </div>
              </div>
              <div class="country-list-container">
                <ul class="country-list" id="list-countries">
                   <li class="country-item"><span class="loading">Scanning global nodes...</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer>
      <div class="footer-container">
        <div class="footer-brand">
          <strong>ASPPIBRA DAO Foundation</strong>
          <span>© 2025 All rights reserved. Decentralized Protocol.</span>
        </div>
        <div class="footer-links">
          <a href="#" title="Documentation">Docs</a>
          <a href="#" title="Suporte">Suporte</a>
        </div>
        <div class="footer-tech">
          <div class="tech-item">
            SYSTEM ONLINE <div class="status-dot-small"></div>
          </div>
          <div class="tech-item">
            <span style="color: var(--text-muted)">v</span>${props.version} • GLOBAL_NODE
          </div>
          <div class="tech-item" style="opacity: 0.5;">
            Latency: <span id="footer-latency">--ms</span>
          </div>
        </div>
      </div>
    </footer>

    <script>
      const toggleButton = document.getElementById('theme-toggle');
      const body = document.body;
      function applyTheme(theme) { 
        body.className = ''; body.classList.add('theme-' + theme); 
        toggleButton.innerText = theme === 'dark' ? '☀️' : '🌙'; 
        localStorage.setItem('theme', theme); 
      }
      function toggleTheme() { 
        const currentTheme = body.classList.contains('theme-dark') ? 'dark' : 'light'; 
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark'); 
      }
      function initTheme() { 
        const savedTheme = localStorage.getItem('theme'); 
        if (savedTheme) applyTheme(savedTheme); else applyTheme('dark'); 
      }
      if(toggleButton) toggleButton.addEventListener('click', toggleTheme);
      initTheme();

      setInterval(() => {
        const latency = Math.floor(Math.random() * (45 - 15 + 1) + 15);
        const latElem = document.getElementById('footer-latency');
        if(latElem) latElem.innerText = latency + 'ms';
      }, 3000);

      // --- LOGIC: MARKET BANNER ---
      const sparklinePath = document.getElementById('sparkline-path');
      const sparklineFill = document.getElementById('sparkline-fill');
      const priceDisplay = document.getElementById('price-display');
      const changeDisplay = document.getElementById('price-change');
      const liqDisplay = document.getElementById('liquidity-display');
      const mcapDisplay = document.getElementById('mcap-display');
      const chartFillGradient = document.getElementById('chartFill');
      
      let chartData = []; 
      const MAX_POINTS = 20;

      // NOVO: Função para formatar números grandes (ex: $9.5M, $1.2k)
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
        
        // 1. Preço
        if(priceDisplay) priceDisplay.innerText = '$' + currentPrice.toFixed(4);
        
        // 2. Variação
        if(changeDisplay) {
            const sign = isPositive ? '▲ +' : '▼ ';
            changeDisplay.innerText = sign + Math.abs(change24h).toFixed(2) + '% (24h)';
            changeDisplay.style.color = color;
            changeDisplay.style.background = isPositive ? 'rgba(0, 255, 157, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        }

        // 3. Liquidez e Market Cap (Atualizado)
        if(liqDisplay) {
           liqDisplay.innerHTML = 'Liq: <span class="stat-val">$' + formatCompact(liquidity) + '</span>';
        }
        if(mcapDisplay) {
           mcapDisplay.innerHTML = 'MCap: <span class="stat-val">$' + formatCompact(mcap) + '</span>';
        }

        // 4. Gráfico e Cores
        sparklinePath.setAttribute('stroke', color);
        if(chartFillGradient) {
            const stops = chartFillGradient.getElementsByTagName('stop');
            if(stops.length >= 2) {
                stops[0].setAttribute('stop-color', color);
                stops[1].setAttribute('stop-color', color);
            }
        }

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

      setInterval(updateSparkline, 10000); 
      updateSparkline(); 

      // --- METRICS ---
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

          lblTotalRequests.innerText = data.requests.toLocaleString();
          
          const bytes = data.bytes;
          let byteStr = "0 B";
          if (bytes > 1073741824) byteStr = (bytes / 1073741824).toFixed(2) + " GB";
          else if (bytes > 1048576) byteStr = (bytes / 1048576).toFixed(2) + " MB";
          else byteStr = (bytes / 1024).toFixed(0) + " KB";
          lblTotalBytes.innerText = byteStr;
          
          if(data.cacheRatio) lblCacheRatio.innerText = data.cacheRatio + "%";
          lblSummaryWrites.innerText = data.dbWrites.toLocaleString();
          lblReads.innerText = data.dbReads.toLocaleString();
          lblWrites.innerText = data.dbWrites.toLocaleString();

          const maxVal = Math.max(data.dbReads, data.dbWrites, 100);
          document.getElementById('bar-reads').style.width = Math.min(100, (data.dbReads / maxVal) * 100) + "%";
          document.getElementById('bar-writes').style.width = Math.min(100, (data.dbWrites / maxVal) * 100) + "%";
          if(barWorkload) barWorkload.style.width = Math.min(100, (data.dbWrites / maxVal) * 100) + "%";
          if(lblWorkload) lblWorkload.innerText = "Low"; 

          listCountries.innerHTML = ''; 
          if(data.countries && data.countries.length > 0) {
              data.countries.forEach(c => {
                  const li = document.createElement('li');
                  li.className = 'country-item';
                  const code = c.code || 'UNK';
                  const flagUrl = 'https://flagsapi.com/' + code + '/flat/32.png';
                  const htmlContent = 
                    '<div class="flag-wrapper">' +
                      '<img src="' + flagUrl + '" style="width:24px; height:24px; object-fit:contain;" onerror="this.style.display=\\'none\\'">' +
                      '<span class="country-code">' + code + '</span>' +
                    '</div>' +
                    '<span style="font-family:\\'JetBrains Mono\\', monospace; font-weight:700; color: var(--text-highlight);">' +
                      c.count.toLocaleString() +
                    '</span>';
                  li.innerHTML = htmlContent;
                  listCountries.appendChild(li);
              });
          } else {
              listCountries.innerHTML = '<li class="country-item">No traffic data</li>';
          }
        } catch (e) {
          console.error(e);
        }
      }
      fetchMetrics();
      setInterval(fetchMetrics, 30000); 
    </script>
  </body>
  </html>
`;