/**
 * ASPPIBRA DAO - Dashboard Controller (v8.0 - Full Production)
 * Frontend Conectado com Backend Moralis + D1 + KV
 */

const CONFIG = {
    API_STATS: '/api/stats',
    REFRESH_RATE: 5000, // 5 segundos
  };
  
  document.addEventListener('DOMContentLoaded', () => {
      console.log('🚀 ASPPIBRA Dashboard v8.0 Initialized');
      setupTheme();
      setupMobileMenu();
  
      // Inicia Loop de Dados (Único e Centralizado)
      fetchSystemStats();
      setInterval(fetchSystemStats, CONFIG.REFRESH_RATE);
  });
  
  // --- O CÉREBRO DO DASHBOARD ---
  async function fetchSystemStats() {
      try {
          const response = await fetch(CONFIG.API_STATS);
          if (!response.ok) return; 
  
          const data = await response.json();
          
          // 1. MÉTRICAS DE INFRAESTRUTURA
          animateValue('lbl-total-requests', data.networkRequests);
          document.getElementById('lbl-total-bytes').innerText = formatBytes(data.processedData);
          animateValue('lbl-uniques', data.globalUsers);
          
          // 2. MÉTRICAS DE BANCO DE DADOS
          const reads = data.dbStats.queries;
          const writes = data.dbStats.mutations;
          const totalOps = reads + writes + data.networkRequests;
          
          animateValue('lbl-reads', reads);
          animateValue('lbl-writes', writes);
          animateValue('lbl-workload', totalOps);
  
          updateBar('bar-reads', reads);
          updateBar('bar-writes', writes);
          updateBar('bar-workload', totalOps);
  
          // 3. DADOS DE MERCADO (O CORAÇÃO - MORALIS)
          if (data.market) {
              updateMarketData(data.market);
          }
  
          // 4. ORIGEM DO TRÁFEGO
          updateCountryList(data.countries);
  
      } catch (error) {
          console.error('Telemetria offline:', error);
      }
  }
  
  // --- LÓGICA DE MERCADO (Preço, Liquidez, Gráfico) ---
  function updateMarketData(market) {
      // A) Preço e Variação
      const price = parseFloat(market.price);
      const change = parseFloat(market.change24h || 0);
      
      document.getElementById('price-display').innerText = '$' + price.toFixed(4);
      
      // Cor da variação (Verde/Vermelho)
      const changeEl = document.getElementById('price-change');
      if (changeEl) {
          changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% (24h)`;
          changeEl.style.color = change >= 0 ? 'var(--success-color)' : '#ef4444';
          changeEl.style.background = change >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
      }
  
      // B) Liquidez e MarketCap (Dados Reais)
      const liqEl = document.getElementById('liquidity-display');
      if (liqEl) liqEl.innerHTML = `Liq: <span class="stat-val">$${formatCompact(market.liquidity)}</span>`;
  
      const mcapEl = document.getElementById('mcap-display');
      if (mcapEl) mcapEl.innerHTML = `MCap: <span class="stat-val">$${formatCompact(market.marketCap)}</span>`;
  
      // C) Gráfico Sparkline (Usando o histórico da Moralis)
      if (market.history && market.history.length > 0) {
          // Extrai apenas os preços para o desenho
          const prices = market.history.map(h => h.p);
          renderSparkline(prices);
      }
  }
  
  // --- DESENHO DO GRÁFICO (SVG) ---
  function renderSparkline(data) {
      const path = document.getElementById('sparkline-path');
      const fill = document.getElementById('sparkline-fill');
      if (!path || data.length < 2) return;
  
      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 0.0001;
  
      // Normaliza os pontos para caber na caixa SVG 100x100
      const points = data.map((val, i) => {
          const x = (i / (data.length - 1)) * 100;
          const normalized = (val - min) / range;
          const y = 90 - (normalized * 80); // 80% de altura, margem superior
          return `${x},${y}`;
      });
  
      const lineD = 'M' + points.join(' L');
      
      // Aplica o desenho
      path.setAttribute('d', lineD);
      if (fill) fill.setAttribute('d', lineD + ' L100,120 L0,120 Z');
      
      // Define a cor baseada na tendência (Último vs Primeiro)
      const isUp = data[data.length-1] >= data[0];
      const color = isUp ? '#00ff9d' : '#ef4444'; // Verde ou Vermelho
      
      path.setAttribute('stroke', color);
      
      // Atualiza o gradiente de fundo para combinar
      const gradientStop = document.querySelector('#chartFill stop');
      if(gradientStop) gradientStop.setAttribute('stop-color', color);
  }
  
  // --- UTILITÁRIOS ---
  
  function animateValue(id, value) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.innerText !== String(value).toLocaleString()) {
          el.innerText = value.toLocaleString();
          el.classList.remove('loading');
      }
  }
  
  function updateBar(id, val) {
      const bar = document.getElementById(id);
      if (bar) {
          const pct = Math.min(100, Math.max(5, (val % 100))); 
          bar.style.width = `${pct}%`;
      }
  }
  
  function formatBytes(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function formatCompact(num) {
      if (!num) return '--';
      return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  }
  
  function updateCountryList(countries) {
      const list = document.getElementById('list-countries');
      if (!list) return;
  
      if (!countries || countries.length === 0) {
          if (list.children[0]?.className === 'loading') return;
          list.innerHTML = '<li class="country-item"><span class="loading">Scanning nodes...</span></li>';
          return;
      }
  
      // Limita a 5 países para não estourar o layout
      list.innerHTML = countries.slice(0, 5).map(c => `
          <li class="country-item">
              <div class="flag-wrapper">
                  <span class="flag-code">${c.code}</span>
                  <span class="country-name">${c.country}</span>
              </div>
              <span class="count">${c.count}</span>
          </li>
      `).join('');
  }
  
  // --- TEMA E MOBILE ---
  function setupTheme() {
      const btn = document.getElementById('theme-toggle');
      const body = document.body;
      const saved = localStorage.getItem('theme') || 'dark';
      body.className = 'theme-' + saved;
      if(btn) {
          btn.innerText = saved === 'dark' ? '☀️' : '🌙';
          btn.addEventListener('click', () => {
              const isDark = body.classList.contains('theme-dark');
              body.className = isDark ? 'theme-light' : 'theme-dark';
              localStorage.setItem('theme', isDark ? 'light' : 'dark');
              btn.innerText = isDark ? '🌙' : '☀️';
          });
      }
  }
  
  function setupMobileMenu() {
      const btn = document.getElementById('mobile-menu-btn');
      const nav = document.getElementById('nav-menu');
      if (btn && nav) {
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              btn.classList.toggle('is-active');
              nav.classList.toggle('nav-active');
          });
          document.addEventListener('click', (e) => {
              if (!nav.contains(e.target) && !btn.contains(e.target)) {
                  nav.classList.remove('nav-active');
                  btn.classList.remove('is-active');
              }
          });
      }
  }