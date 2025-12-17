const fs = require('node:fs');
const path = require('node:path');

// --- CONFIGURAÇÃO ---
let conteudoRelatorio = `# 🌩️ Monitoramento de Rede (Validado)\n**Data:** ${new Date().toLocaleString()}\n\n`;

function criarTabelaMarkdown(dados) {
  if (!dados || dados.length === 0) return '_Sem dados._\n';
  const colunas = Object.keys(dados[0]);
  let tabela = '| ' + colunas.join(' | ') + ' |\n' + '| ' + colunas.map(() => '---').join(' | ') + ' |\n';
  dados.forEach(item => {
    tabela += '| ' + colunas.map(c => typeof item[c] === 'number' && c.includes('bytes') ? (item[c]/1024/1024).toFixed(2)+' MB' : item[c]).join(' | ') + ' |\n';
  });
  return tabela + '\n';
}

// Carregar ENV
const arquivos = ['.dev.vars', '.env'];
for (const f of arquivos) {
  if (fs.existsSync(f)) fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  });
}

const CONFIG = { token: process.env.CLOUDFLARE_API_TOKEN, zone: process.env.CLOUDFLARE_ZONE_ID, account: process.env.CLOUDFLARE_ACCOUNT_ID };
if (!CONFIG.token || !CONFIG.zone) { console.error('❌ Falta token/zone ID'); process.exit(1); }

// --- QUERIES QUE FUNCIONAM ---
const QUERIES = {
  http: `query HttpTraffic($zoneTag: string, $start: Time, $end: Time) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1hGroups(limit: 5, orderBy: [sum_requests_DESC], filter: { datetime_geq: $start, datetime_leq: $end }) {
        sum { requests bytes }
        uniq { uniques }
        dimensions { datetime }
      }
    }}
  }`,
  workers: `query WorkersAnalytics($accountTag: string, $start: Time, $end: Time) {
    viewer { accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 5, filter: { datetime_geq: $start, datetime_leq: $end }) {
        sum { requests errors } 
        dimensions { scriptName status }
      }
    }}
  }`
};
// Nota: Removido cpuTime, D1, R2 e KV pois não estão disponíveis na API pública do seu plano.

async function run(nome, query, escopo) {
  const now = new Date(); const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.token}` },
    body: JSON.stringify({ query, variables: { zoneTag: CONFIG.zone, accountTag: CONFIG.account, start: yesterday.toISOString(), end: now.toISOString() } })
  });
  const json = await res.json();
  if (json.errors) { conteudoRelatorio += `## ${nome}\n> ❌ Erro: ${json.errors[0].message}\n\n`; return; }
  
  const data = escopo === 'account' ? json.data?.viewer?.accounts?.[0] : json.data?.viewer?.zones?.[0];
  const items = data ? data[Object.keys(data)[0]] : [];
  
  conteudoRelatorio += `## ${nome}\n` + (items.length ? criarTabelaMarkdown(items.map(i => ({...i.dimensions, ...i.sum, ...i.uniq}))) : '_Sem dados_\n') + '\n';
  console.log(`✅ ${nome}: OK`);
}

(async () => {
  console.log('--- 🚀 MONITORAMENTO VALIDADO ---');
  await run('Tráfego HTTP & Visitantes', QUERIES.http, 'zone');
  if (CONFIG.account) await run('Workers (Status)', QUERIES.workers, 'account');
  fs.writeFileSync('RELATORIO_REDE.md', conteudoRelatorio);
  console.log('\n🏁 Relatório salvo: RELATORIO_REDE.md');
})();