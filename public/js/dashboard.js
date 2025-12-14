/**
 * ASPPIBRA DAO - Dashboard Logic (v6.0 - Real Data & 6h Cache)
 * Conecta dados reais da API Moralis com proteção de Cache de 6 horas.
 */

// --- CONFIGURAÇÃO GLOBAL ---
const CONFIG = {
  TOKEN_SUPPLY: 21000000, 
  API_DATA: '/api/rwa/token-data',       
  API_HISTORY: '/api/rwa/token-history', 
  METRICS_ENDPOINT: '/monitoring',
  
  // ⚡ MODO REAL ATIVADO (Simulação Desligada)
  SIMULATE_HISTORY: false, 

  // TEMPOS DE ATUALIZAÇÃO (Economia Máxima - Plano Free)
  REFRESH_PRICE: 60000,       // 1 Minuto (Preço)
  REFRESH_CHART: 21600000,    // 6 Horas (Gráfico Pesado)
  REFRESH_METRICS: 60000      // 1 Minuto (Métricas)
};

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
  if (savedTheme) applyTheme(savedTheme); else applyTheme('dark'); 
}
if(toggleButton) toggleButton.addEventListener('click', toggleTheme);
initTheme();

// --- ELEMENTOS DO DOM ---
const sparklinePath = document.getElementById('sparkline-path');
const sparklineFill = document.getElementById('sparkline-fill');
const priceDisplay = document.getElementById('price-display');
const changeDisplay = document.getElementById('price-change');
const liqDisplay = document.getElementById('liquidity-display');
const mcapDisplay = document.getElementById('mcap-display');
const chartFillGradient = document.getElementById('chartFill');
const logoHeader = document.querySelector('.header-logo');
const logoGovernance = document.querySelector('.logo-img');

// Variáveis Globais
let globalHistoryData = [];
let globalCurrentPrice = 0.45;

function formatCompact(num) {
  return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
}

// 1. ATUALIZAÇÃO DE PREÇO (REAL - 1 Minuto)
async function updatePriceOnly() {
  try {
      const res = await fetch(CONFIG.API_DATA);
      const json = await res.json();
      const data = json.success ? json.data : null;

      if(data) {
          globalCurrentPrice = parseFloat(data.usdPrice || 0);
          renderPriceInfo(data, globalCurrentPrice);
          
          // Se já temos histórico carregado, redesenha conectando ao novo preço
          if(globalHistoryData.length > 0) {
              renderChart(globalHistoryData, globalCurrentPrice);
          }
      }
  } catch (e) { console.error("Price Update Failed:", e); }
}

// 2. ATUALIZAÇÃO DE HISTÓRICO (REAL - 6 Horas)
async function updateHistoryOnly() {
  try {
    const res = await fetch(CONFIG.API_HISTORY);
    if(!res.ok) return; 
    const json = await res.json();
    const history = json.success ? json.data : [];

    if(history && history.length > 0) {
        // Extrai apenas o preço de fechamento (close) das velas
        globalHistoryData = history.map(candle => parseFloat(candle.close));
        renderChart(globalHistoryData, globalCurrentPrice);
    }
  } catch (e) { console.error("History Update Failed:", e); }
}

// Renderiza Informações de Texto
function renderPriceInfo(data, price) {
    let changeRaw = (data['24hrPercentChange']) ? data['24hrPercentChange'] : 0;
    if(changeRaw === 'null') changeRaw = 0;
    const change24h = parseFloat(changeRaw);
    
    const liquidity = parseFloat(data.pairTotalLiquidityUsd || 0); 
    const mcap = price * CONFIG.TOKEN_SUPPLY;
    const isPositive = change24h >= 0;
    const color = isPositive ? '#00ff9d' : '#ef4444'; 

    if(priceDisplay) {
        priceDisplay.innerText = '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        priceDisplay.classList.remove('loading');
    }
    if(changeDisplay) {
        changeDisplay.innerText = (isPositive ? '▲ ' : '▼ ') + Math.abs(change24h).toFixed(2) + '% (24h)';
        changeDisplay.style.color = color;
        changeDisplay.style.background = isPositive ? 'rgba(0, 255, 157, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    }
    if(liqDisplay) liqDisplay.innerHTML = 'Liq: <span class="stat-val">$' + formatCompact(liquidity) + '</span>';
    if(mcapDisplay) mcapDisplay.innerHTML = 'MCap: <span class="stat-val">$' + formatCompact(mcap) + '</span>';

    if (data.tokenLogo && data.tokenLogo !== "null") {
        if(logoHeader) logoHeader.src = data.tokenLogo;
        if(logoGovernance) logoGovernance.src = data.tokenLogo;
    }
}

// Renderiza Gráfico SVG
function renderChart(historyData, currentPrice) {
    let chartData = [...historyData];
    
    // Fallback: se vazio, usa preço atual
    if (chartData.length === 0) chartData = [currentPrice];
    
    // Conecta último ponto histórico ao preço em tempo real
    const lastVal = chartData[chartData.length - 1];
    if (lastVal !== currentPrice) chartData.push(currentPrice);
    
    // Limita a 1 ano (366 dias)
    if(chartData.length > 366) chartData = chartData.slice(-366);

    // Se só tiver 1 ponto, duplica para formar linha reta
    if(chartData.length === 1) chartData.push(chartData[0]);

    const min = Math.min(...chartData);
    const max = Math.max(...chartData);
    const range = (max - min) === 0 ? 0.00001 : (max - min); 
    
    const start = chartData[0];
    const end = chartData[chartData.length-1];
    const color = end >= start ? '#00ff9d' : '#ef4444';

    if(sparklinePath) {
        sparklinePath.setAttribute('stroke', color);
        if(chartFillGradient) {
            const stops = chartFillGradient.getElementsByTagName('stop');
            if(stops.length >= 2) {
                stops[0].setAttribute('stop-color', color);
                stops[1].setAttribute('stop-color', color);
            }
        }

        const points = chartData.map((val, i) => {
          const x = (i / (chartData.length - 1)) * 100;
          const normalizedVal = (val - min) / range;
          const y = 95 - (normalizedVal * 80); // Margem de segurança de 80% da altura
          return `${x},${y}`;
        });
        
        const lineD = 'M' + points.join(' L');
        sparklinePath.setAttribute('d', lineD);
        if(sparklineFill) {
            sparklineFill.setAttribute('d', lineD + ' L100,120 L0,120 Z');
        }
    }
}

// --- MÉTRICAS (Cloudflare) ---
async function fetchMetrics() {
  const elements = {
      req: document.getElementById('lbl-total-requests'),
      bytes: document.getElementById('lbl-total-bytes'),
      writes: document.getElementById('lbl-summary-writes'),
      reads: document.getElementById('lbl-reads'),
      dbWrites: document.getElementById('lbl-writes'),
      cache: document.getElementById('lbl-cache-ratio'),
      countries: document.getElementById('list-countries'),
      workload: document.getElementById('lbl-workload'),
      barWorkload: document.getElementById('bar-workload'),
      barReads: document.getElementById('bar-reads'),
      barWrites: document.getElementById('bar-writes')
  };

  try {
    const response = await fetch(CONFIG.METRICS_ENDPOINT); 
    if (!response.ok && response.status !== 302) {
         // Fallback silencioso para API direta se necessário
         const fallback = await fetch('/api/health/analytics');
         if(fallback.ok) renderMetrics(await fallback.json());
         return;
    }
    renderMetrics(await response.json());
  } catch (e) {}

  function renderMetrics(data) {
    if(data.error) return;
    if(elements.req) elements.req.innerText = (data.requests || 0).toLocaleString();
    
    const bytes = data.bytes || 0;
    let byteStr = bytes > 1073741824 ? (bytes / 1073741824).toFixed(2) + " GB" : (bytes / 1048576).toFixed(2) + " MB";
    if(elements.bytes) elements.bytes.innerText = byteStr;
    if(data.cacheRatio && elements.cache) elements.cache.innerText = data.cacheRatio + "%";
    
    const reads = data.dbReads || 0;
    const writes = data.dbWrites || 0;
    if(elements.writes) elements.writes.innerText = writes.toLocaleString();
    if(elements.reads) elements.reads.innerText = reads.toLocaleString();
    if(elements.dbWrites) elements.dbWrites.innerText = writes.toLocaleString();

    const maxVal = Math.max(reads, writes, 100); 
    if(elements.barReads) elements.barReads.style.width = Math.min(100, (reads / maxVal) * 100) + "%";
    if(elements.barWrites) elements.barWrites.style.width = Math.min(100, (writes / maxVal) * 100) + "%";
    
    if(elements.countries) {
        elements.countries.innerHTML = ''; 
        if(data.countries && data.countries.length > 0) {
            data.countries.slice(0, 5).forEach(c => {
                const li = document.createElement('li');
                li.className = 'country-item';
                const code = c.code || 'UNK';
                const flagUrl = 'https://flagsapi.com/' + code + '/flat/32.png';
                li.innerHTML = `<div class="flag-wrapper"><img src="${flagUrl}" style="width:24px;" onerror="this.style.display='none'"><span>${code}</span></div><span>${c.count.toLocaleString()}</span>`;
                elements.countries.appendChild(li);
            });
        } else {
            elements.countries.innerHTML = '<li class="country-item">No data</li>';
        }
    }
  }
}

// Inicialização
updatePriceOnly();   
updateHistoryOnly(); 
fetchMetrics();

// Timers
setInterval(updatePriceOnly, CONFIG.REFRESH_PRICE); 
setInterval(updateHistoryOnly, CONFIG.REFRESH_CHART); 
setInterval(fetchMetrics, CONFIG.REFRESH_METRICS);

// Latência Fake (Efeito Visual)
setInterval(() => {
  const latElem = document.getElementById('footer-latency');
  if(latElem) latElem.innerText = Math.floor(Math.random() * 30 + 15) + 'ms';
}, 3000);