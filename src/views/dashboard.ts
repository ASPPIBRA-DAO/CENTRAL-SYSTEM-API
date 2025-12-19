/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API & Identity Provider
 */
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
  <html lang="en" itemscope itemtype="http://schema.org/WebPage">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="index, follow, max-image-preview:large">
    
    <title>ASPPIBRA DAO | Real-World Asset (RWA) Governance Protocol</title>
    <meta name="title" content="ASPPIBRA DAO | Real-World Asset (RWA) Governance Protocol">
    <meta name="description" content="Official dashboard for ASPPIBRA DAO. Monitor real-time $ASPPBR token price, agricultural asset treasury, governance voting, and decentralized network telemetry on BSC.">
    <meta name="keywords" content="ASPPIBRA, DAO, RWA, Real World Assets, Tokenization, Agro DeFi, BSC, Governance, $ASPPBR, Web3, Agriculture Blockchain, Brazil Crypto">
    <meta name="author" content="ASPPIBRA Foundation">
    <link rel="canonical" href="${props.domain}">
    
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#020617">
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="/css/style.css">
    
    <meta property="og:type" content="website">
    <meta property="og:url" content="${props.domain}">
    <meta property="og:title" content="ASPPIBRA Protocol | RWA Token & Network Status">
    <meta property="og:description" content="⚡ Live Market: $ASPPBR Token Price, Liquidity & Governance metrics. The first decentralized protocol bridging Brazilian Agriculture with Web3.">
    <meta property="og:image" content="${props.imageUrl}">
    <meta property="og:site_name" content="ASPPIBRA DAO">
    <meta property="og:locale" content="en_US">

    <meta name="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${props.domain}">
    <meta name="twitter:title" content="$ASPPBR Live Price & DAO Metrics">
    <meta name="twitter:description" content="Track ASPPIBRA's Real-World Asset treasury and network health in real-time. Governance for the future of agriculture.">
    <meta name="twitter:image" content="${props.imageUrl}">

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FinanceApplication",
      "name": "ASPPIBRA DAO Dashboard",
      "url": "${props.domain}",
      "description": "Decentralized application for monitoring ASPPIBRA DAO governance token ($ASPPBR) and network telemetry.",
      "applicationCategory": "DeFi",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "organization": {
        "@type": "Organization",
        "name": "ASPPIBRA DAO",
        "url": "${props.domain}",
        "logo": "${props.domain}/icons/android-chrome-512x512.png",
        "sameAs": [
          "https://twitter.com/asppibra",
          "https://github.com/asppibra"
        ]
      }
    }
    </script>
  </head>
  <body class="theme-dark"> 
    <div class="bg-grid"></div>
    
    <header>
      <div class="header-container">
        
        <div class="header-brand">
          <div class="logo-wrapper">
            <div class="logo-glow"></div>
            <img src="/icons/android-chrome-192x192.png" alt="ASPPIBRA" class="header-logo" onerror="this.style.display='none'">
          </div>
          <div class="header-text-col">
            <h1 class="header-title">ASPPIBRA DAO</h1>            
          </div>
        </div>

        <button class="menu-toggle" id="mobile-menu-btn" aria-label="Toggle Menu">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>

        <div class="header-tools" id="nav-menu">
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
              
              <h2 style="font-size: 2rem; margin: 0; line-height: 1.1;">ASPPIBRA <span style="color: var(--text-highlight);">$ASPPBR</span></h2>
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
            <h3>Network Requests</h3>
            <p class="value" id="lbl-total-requests"><span class="loading">0000</span></p>
            <div class="label-badge">24h Activity</div>
          </div>

          <div class="summary-card glass-panel">
            <h3>Processed Data</h3>
            <p class="value" id="lbl-total-bytes"><span class="loading">-- GB</span></p>
            <div class="label-badge">Throughput</div>
          </div>

          <div class="summary-card glass-panel">
            <h3>Global Users</h3>
            <p class="value" id="lbl-uniques"><span class="loading">--</span></p>
            <div class="label-badge">Active Nodes</div>
          </div>
          
        </div>

        <div class="tech-dashboard">
          <div class="col-system">
            <div class="governance-card glass-panel">
              <div class="logo-container">
                  <div class="logo-ring"></div>
                  <img src="/icons/android-chrome-192x192.png" alt="Logo" class="logo-img" onerror="this.style.display='none'">
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
                <div class="metric-title">State Queries (24h)</div>
                <div class="metric-value" id="lbl-reads"><span class="loading">--</span></div>
                <div class="metric-bar"><div class="bar-fill cyan" id="bar-reads" style="width: 0%;"></div></div>
              </div>
              
              <div class="metric-card glass-panel">
                <div class="metric-title">Ledger Mutations</div>
                <div class="metric-value" id="lbl-writes"><span class="loading">--</span></div>
                <div class="metric-bar"><div class="bar-fill purple" id="bar-writes" style="width: 0%;"></div></div>
              </div>
              
              <div class="metric-card glass-panel">
                <div class="metric-title">Edge Operations</div>
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

    <script src="/js/dashboard.js"></script>
  </body>
  </html>
`;