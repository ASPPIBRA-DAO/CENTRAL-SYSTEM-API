/**
 * ASPPIBRA DAO - Dashboard Controller (v7.0 - Telemetry & Audit)
 * Conecta o Frontend HTML com a API Backend (/api/stats) e AuditService.
 */

// --- CONFIGURAÇÃO ---
const CONFIG = {
  API_STATS: '/api/stats',           // Nova rota unificada (AuditService)
  API_HISTORY: '/api/rwa/token-history', // Para o gráfico (se disponível)
  REFRESH_RATE: 5000,                // 5 segundos
  TOKEN_SUPPLY: 21000000
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 ASPPIBRA System Initialized');
    
    // 1. Configura UI (Tema e Menu)
    setupTheme();
    setupMobileMenu();

    // 2. Inicia Loops de Dados
    fetchSystemStats(); // Busca imediata
    setInterval(fetchSystemStats, CONFIG.REFRESH_RATE);
    
    // 3. Inicia Gráfico (Histórico) - Atualiza a cada 5min
    updateChartHistory();
    setInterval(updateChartHistory, 300000);
});

// --- LÓGICA DE DADOS (O CÉREBRO) ---
async function fetchSystemStats() {
    try {
        const response = await fetch(CONFIG.API_STATS);
        if (!response.ok) return; // Silencia erros de rede momentâneos

        const data = await response.json();
        
        // --- SEÇÃO 1: MÉTRICAS DE DESTAQUE (TOPO) ---
        // Network Requests
        animateValue('lbl-total-requests', data.networkRequests);
        
        // Processed Data (Throughput)
        document.getElementById('lbl-total-bytes').innerText = formatBytes(data.processedData);
        
        // Global Users (Active Nodes) - CORREÇÃO DE ID AQUI
        animateValue('lbl-uniques', data.globalUsers);

        // --- SEÇÃO 2: INFRAESTRUTURA (BAIXO) ---
        // DB Stats
        const reads = data.dbStats.queries;
        const writes = data.dbStats.mutations;
        
        animateValue('lbl-reads', reads);
        animateValue('lbl-writes', writes);

        // Edge Operations (Soma total para dar movimento)
        const totalOps = reads + writes + data.networkRequests;
        animateValue('lbl-workload', totalOps);

        // Barras de Progresso (Efeito Visual)
        updateBar('bar-reads', reads);
        updateBar('bar-writes', writes);
        updateBar('bar-workload', totalOps);

        // --- SEÇÃO 3: MERCADO (TOKEN) ---
        if (data.market && data.market.price) {
            const price = parseFloat(data.market.price);
            document.getElementById('price-display').innerText = '$' + price.toFixed(4);
            
            // Calcula Market Cap simples
            const mcap = price * CONFIG.TOKEN_SUPPLY;
            document.getElementById('mcap-display').innerHTML = `MCap: <span class="stat-val">$${formatCompact(mcap)}</span>`;
        }

        // --- SEÇÃO 4: ORIGEM DO TRÁFEGO ---
        updateCountryList(data.countries);

    } catch (error) {
        console.error('Telemetria offline:', error);
    }
}

// --- LÓGICA DE GRÁFICO (RESTAURADA) ---
async function updateChartHistory() {
    try {
        // Tenta buscar histórico real, se falhar, usa dados mockados para não quebrar o layout
        const res = await fetch(CONFIG.API_HISTORY);
        const json = res.ok ? await res.json() : { success: false };
        
        let history = [];
        if (json.success && json.data) {
            history = json.data.map(c => parseFloat(c.close));
        }

        // Se não tiver dados (API nova), desenha uma linha reta baseada no preço atual
        if (history.length === 0) {
            const currentPriceText = document.getElementById('price-display').innerText.replace('$','');
            const price = parseFloat(currentPriceText) || 0.45;
            history =Array(10).fill(price); // Linha reta
        }

        renderSparkline(history);
    } catch (e) { console.log("Chart sync pending..."); }
}

function renderSparkline(data) {
    const path = document.getElementById('sparkline-path');
    const fill = document.getElementById('sparkline-fill');
    if (!path || data.length < 2) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 0.001;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const normalized = (val - min) / range;
        const y = 95 - (normalized * 80); // 80% da altura
        return `${x},${y}`;
    });

    const lineD = 'M' + points.join(' L');
    path.setAttribute('d', lineD);
    if (fill) fill.setAttribute('d', lineD + ' L100,120 L0,120 Z');
    
    // Cor dinâmica (Verde se subiu, Vermelho se caiu)
    const color = data[data.length-1] >= data[0] ? '#00ff9d' : '#ef4444';
    path.setAttribute('stroke', color);
}

// --- UTILITÁRIOS VISUAIS ---

function animateValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    // Só atualiza se mudou para evitar "flash"
    if (el.innerText !== String(value).toLocaleString()) {
        el.innerText = value.toLocaleString();
        el.classList.remove('loading');
    }
}

function updateBar(id, val) {
    const bar = document.getElementById(id);
    if (bar) {
        // Truque visual: usa módulo para a barra ficar sempre se mexendo
        const pct = Math.min(100, Math.max(10, (val % 100)));
        bar.style.width = `${pct}%`;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatCompact(num) {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
}

function updateCountryList(countries) {
    const list = document.getElementById('list-countries');
    if (!list) return;

    if (!countries || countries.length === 0) {
        // Mantém o estado de "Escaneando" se vazio
        if (list.children[0]?.className === 'loading') return;
        list.innerHTML = '<li class="country-item"><span class="loading">Scanning nodes...</span></li>';
        return;
    }

    list.innerHTML = countries.map(c => `
        <li class="country-item">
            <div class="flag-wrapper">
                <span>${c.code || '🌐'}</span>
                <span>${c.country || 'Global'}</span>
            </div>
            <span class="count">${c.count}</span>
        </li>
    `).join('');
}

// --- UI HELPERS (Theme & Mobile) ---

function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    const body = document.body;
    
    const saved = localStorage.getItem('theme') || 'dark';
    body.classList.add('theme-' + saved);
    if(btn) btn.innerText = saved === 'dark' ? '☀️' : '🌙';

    if(btn) btn.addEventListener('click', () => {
        const isDark = body.classList.contains('theme-dark');
        body.className = isDark ? 'theme-light' : 'theme-dark';
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        btn.innerText = isDark ? '🌙' : '☀️';
    });
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