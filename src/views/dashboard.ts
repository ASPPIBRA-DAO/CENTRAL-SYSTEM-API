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
            <span class="header-subtitle">// CORE API_V1 STATUS</span>
          </div>
        </div>

        <div class="header-tools">
          
          <div class="network-pill" title="Network Status: Operational">
            <div class="pulse-dot"></div>
            <span class="network-text">EDGE_NET</span>
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
        
        <div class="welcome-card glass-panel">
          <h2>Welcome back, <span style="color: var(--text-highlight);">Jaydon Frankie</span></h2>
          <p>System telemetry active. Real-time global governance overview.</p>
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
                <div class="sys-row"><span>Region</span> <span class="sys-val">Global Edge</span></div>
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
            </div>

            <div class="countries-card glass-panel">
              <div class="card-header">
                <h4 style="margin:0; font-weight:600; color: var(--text-highlight); display:flex; align-items:center; gap:8px;">
                  🌍 Traffic Origin
                </h4>
                <div class="live-indicator"><div class="live-dot"></div> Live Feed</div>
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
          <a href="#" title="System Status Page">Status</a>
          <a href="#" title="Governance Proposal">Governance</a>
          <a href="#" title="Privacy Policy">Privacy</a>
        </div>

        <div class="footer-tech">
          <div class="tech-item">
            SYSTEM ONLINE <div class="status-dot-small"></div>
          </div>
          <div class="tech-item">
            <span style="color: var(--text-muted)">v</span>${props.version} • EDGE_NODE_BR
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
        // Force Dark Theme initially for the Tech Vibe
        const savedTheme = localStorage.getItem('theme'); 
        if (savedTheme) applyTheme(savedTheme); 
        else applyTheme('dark'); 
      }
      
      if(toggleButton) toggleButton.addEventListener('click', toggleTheme);
      initTheme();

      // Latency Simulator for Footer
      setInterval(() => {
        const latency = Math.floor(Math.random() * (45 - 15 + 1) + 15);
        const latElem = document.getElementById('footer-latency');
        if(latElem) latElem.innerText = latency + 'ms';
      }, 3000);

      // Metrics Logic
      async function fetchMetrics() {
        const lblTotalRequests = document.getElementById('lbl-total-requests');
        const lblTotalBytes = document.getElementById('lbl-total-bytes');
        const lblSummaryWrites = document.getElementById('lbl-summary-writes');
        const lblReads = document.getElementById('lbl-reads');
        const lblWrites = document.getElementById('lbl-writes');
        const lblCacheRatio = document.getElementById('lbl-cache-ratio');
        const listCountries = document.getElementById('list-countries');

        try {
          const response = await fetch('/monitoring');
          const data = await response.json();
          if (data.error) throw new Error(data.error);

          // Animate Numbers
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

          // Bar Animation
          const maxVal = Math.max(data.dbReads, data.dbWrites, 100);
          document.getElementById('bar-reads').style.width = Math.min(100, (data.dbReads / maxVal) * 100) + "%";
          document.getElementById('bar-writes').style.width = Math.min(100, (data.dbWrites / maxVal) * 100) + "%";

          // Country List Update
          listCountries.innerHTML = ''; 
          if(data.countries && data.countries.length > 0) {
              data.countries.forEach(c => {
                  const li = document.createElement('li');
                  li.className = 'country-item';
                  const code = c.code || 'UNK';
                  const flagUrl = 'https://flagsapi.com/' + code + '/flat/32.png';
                  
                  // Styled List Item with Flag
                  li.innerHTML = \`
                    <div class="flag-wrapper">
                      <img src="\${flagUrl}" style="width:24px; height:24px; object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" onerror="this.style.display=\'none\'">
                      <span class="country-code">\${code}</span>
                    </div>
                    <span style="font-family:'JetBrains Mono', monospace; font-weight:700; color: var(--text-highlight);">
                      \${c.count.toLocaleString()}
                    </span>
                  \`;
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
      setInterval(fetchMetrics, 30000); // 30s update
    </script>
  </body>
  </html>
`;