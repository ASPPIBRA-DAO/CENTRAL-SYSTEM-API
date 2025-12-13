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
    <meta name="description" content="Real-time telemetry and observability of ASPPIBRA DAO's decentralized infrastructure.">
    
    <meta property="og:type" content="website">
    <meta property="og:url" content="${props.domain}">
    <meta property="og:title" content="ASPPIBRA Protocol | Network Health & Nodes">
    <meta property="og:description" content="⚡ Decentralized Infrastructure Operational. Real-time telemetry of global edge nodes, protocol latency, and Ledger integrity.">
    <meta property="og:image" content="${props.imageUrl}">

    <meta name="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${props.domain}">
    <meta name="twitter:title" content="ASPPIBRA Protocol Status">
    <meta name="twitter:description" content="⚡ Real-time Telemetry: Global Nodes, Latency & D1 Ledger.">
    <meta name="twitter:image" content="${props.imageUrl}">

    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="manifest" href="/site.webmanifest">

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="/css/style.css">
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
        
        <div class="welcome-card glass-panel" style="padding: 0; display: flex; flex-direction: column; overflow: hidden; min-height: 260px; justify-content: space-between;">
          
          <div style="padding: 2rem 2.5rem 0; z-index: 2; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: 0.8rem;">
                 <span class="live-dot" style="background: var(--success-color); box-shadow: 0 0 10px var(--success-color);"></span>
                 <span style="font-family: 'JetBrains Mono'; font-size: 0.75rem; color: var(--success-color); letter-spacing: 1px; font-weight: 700;">LIVE MARKET</span>
              </div>
              <h2 style="font-size: 2rem; margin: 0; line-height: 1.1;">ASPPIBRA <span style="color: var(--text-highlight);">Token ($ASPPBR)</span></h2>
              <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 400px;">
                Official Governance & Utility Token.
              </p>
            </div>

            <div style="text-align: right;">
               <div id="price-display" style="font-family: 'JetBrains Mono'; font-size: 2.5rem; font-weight: 700; color: var(--text-highlight);">$0.452</div>
               <div id="price-change" style="font-family: 'JetBrains Mono'; font-size: 0.9rem; color: var(--success-color); background: rgba(0,255,157,0.1); padding: 4px 10px; border-radius: 6px; display: inline-block; margin-top: 6px;">
                 ▲ +2.4% (24h)
               </div>
            </div>
          </div>

          <div style="position: relative; height: 120px; width: 100%; margin-top: 20px; display: flex; align-items: flex-end;">
            
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="position: absolute; bottom: 0; left: 0; right: 0; overflow: visible;">
               <defs>
                 <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                   <stop offset="0%" stop-color="var(--success-color)" stop-opacity="0.25"/>
                   <stop offset="100%" stop-color="var(--success-color)" stop-opacity="0"/>
                 </linearGradient>
                 
                 <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
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
      // Theme Logic
      const toggleButton = document.getElementById('theme-toggle');
      const body = document.body;
      
      function applyTheme(theme) { 
        body.className = ''; 
        body.classList.add('theme-' + theme); 
        toggleButton.innerText = theme === 'dark' ? '☀️' : '🌙'; 
        localStorage.setItem('theme', theme); 
      }
      
      function toggleTheme() { 
        const currentTheme = body.classList.contains('theme-dark') ? 'dark' : 'light'; 
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark'; 
        applyTheme(newTheme); 
      }
      
      function initTheme() { 
        const savedTheme = localStorage.getItem('theme'); 
        if (savedTheme) applyTheme(savedTheme); 
        else applyTheme('dark'); 
      }
      
      if(toggleButton) toggleButton.addEventListener('click', toggleTheme);
      initTheme();

      // Latency Simulator
      setInterval(() => {
        const latency = Math.floor(Math.random() * (45 - 15 + 1) + 15);
        const latElem = document.getElementById('footer-latency');
        if(latElem) latElem.innerText = latency + 'ms';
      }, 3000);

      // --- LÓGICA DO SPARKLINE (CONECTADO AO BACKEND REAL) ---
      const sparklinePath = document.getElementById('sparkline-path');
      const sparklineFill = document.getElementById('sparkline-fill');
      const priceDisplay = document.getElementById('price-display');
      const changeDisplay = document.getElementById('price-change');
      const chartFillGradient = document.getElementById('chartFill');
      
      // Armazena histórico localmente para desenhar o gráfico
      let chartData = []; 
      const MAX_POINTS = 20;

      // Função que busca o preço real no seu Worker
      async function fetchLivePrice() {
        try {
            // Chama a rota que criamos no rwa.ts
            const res = await fetch('/api/rwa/price');
            const data = await res.json();
            
            if(data.error) throw new Error(data.error);
            
            // Retorna o preço numérico
            return parseFloat(data.price);
        } catch (e) {
            console.error("Price fetch error:", e);
            return null; 
        }
      }

      async function updateSparkline() {
        if(!sparklinePath) return;

        // 1. Busca Preço Real
        const newPrice = await fetchLivePrice();
        
        // Se a API falhar (null), usa o último preço conhecido ou um fallback (0.45)
        const currentPrice = newPrice !== null ? newPrice : (chartData.length > 0 ? chartData[chartData.length-1] : 0.45);

        // Adiciona ao histórico
        chartData.push(currentPrice);
        if(chartData.length > MAX_POINTS) chartData.shift(); 

        // Hack visual: Se for o primeiro dado, enche o array
        if(chartData.length === 1) {
            chartData = Array(MAX_POINTS).fill(currentPrice);
        }

        // 2. Calcula Tendência
        const start = chartData[0];
        const end = chartData[chartData.length - 1];
        const isPositive = end >= start;
        
        // Cores
        const color = isPositive ? '#00ff9d' : '#ef4444'; 
        
        // 3. Atualiza DOM
        if(priceDisplay) priceDisplay.innerText = '$' + end.toFixed(4);
        sparklinePath.setAttribute('stroke', color);
        
        // Atualiza cores do gradiente também
        if(chartFillGradient) {
            const stops = chartFillGradient.getElementsByTagName('stop');
            if(stops.length >= 2) {
                stops[0].setAttribute('stop-color', color);
                stops[1].setAttribute('stop-color', color);
            }
        }
        
        if(changeDisplay) {
            const pctChange = start > 0 ? ((end - start) / start) * 100 : 0;
            const sign = isPositive ? '▲ +' : '▼ ';
            
            changeDisplay.innerText = sign + Math.abs(pctChange).toFixed(2) + '% (Session)';
            changeDisplay.style.color = color;
            changeDisplay.style.background = isPositive ? 'rgba(0, 255, 157, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        }

        // 4. Desenha o SVG
        const min = Math.min(...chartData);
        const max = Math.max(...chartData);
        const range = (max - min) === 0 ? 0.0001 : (max - min); 

        const points = chartData.map((val, i) => {
          const x = (i / (chartData.length - 1)) * 100;
          const y = 100 - ((val - min) / range) * 80 - 10; 
          return x + ',' + y;
        });

        // Caminho da linha
        const lineD = 'M' + points.join(' L');
        sparklinePath.setAttribute('d', lineD);
        
        // Caminho do preenchimento (Fecha o loop embaixo)
        if(sparklineFill) {
            const fillD = lineD + ' L100,120 L0,120 Z';
            sparklineFill.setAttribute('d', fillD);
        }
      }

      setInterval(updateSparkline, 5000); 
      updateSparkline(); 

      // --- LÓGICA DE MÉTRICAS ---
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
                  
                  // FIXED: Syntax errors resolved by using standard string concatenation
                  const htmlContent = 
                    '<div class="flag-wrapper">' +
                      '<img src="' + flagUrl + '" style="width:24px; height:24px; object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" onerror="this.style.display=\\'none\\'">' +
                      '<span class="country-code">' + code + '</span>' +
                    '</div>' +
                    '<span style="font-family:\\'JetBrains Mono\\', monospace; font-weight:700; color: var(--text-highlight);">' +
                      c.count.toLocaleString() +
                    '</span>';

                  li.innerHTML = htmlContent;
                  listCountries.appendChild(li);
              });
          } else {
              listCountries.innerHTML = '<li class="country-item" style="justify-content:center; color: var(--text-muted); border:none;">No traffic data</li>';
          }
        } catch (e) {
          console.error('Error loading metrics', e);
          const errElem = '<span style="color: #ef4444; font-size:0.8rem;">OFFLINE</span>';
          lblTotalRequests.innerHTML = errElem;
        }
      }
      fetchMetrics();
      setInterval(fetchMetrics, 30000); 
    </script>
  </body>
  </html>
`;