/**
 * Script de Monitorização Cloudflare -> Saída em Markdown
 * GERA O ARQUIVO: RELATORIO_CLOUDFLARE.md
 */

const fs = require('node:fs');
const path = require('node:path');

// --- 0. PREPARAÇÃO DO RELATÓRIO ---
let conteudoRelatorio = `# 🌩️ Relatório de Monitorização Cloudflare\n`;
conteudoRelatorio += `**Data de Geração:** ${new Date().toLocaleString()}\n\n`;
conteudoRelatorio += `_Este relatório foi gerado automaticamente via script de monitorização._\n\n`;

// Função auxiliar para criar tabelas Markdown
function criarTabelaMarkdown(dados) {
  if (!dados || dados.length === 0) return '_Nenhum dado retornado._\n';

  const colunas = Object.keys(dados[0]);
  
  // 1. Cabeçalho
  let tabela = '| ' + colunas.join(' | ') + ' |\n';
  // 2. Separador
  tabela += '| ' + colunas.map(() => '---').join(' | ') + ' |\n';
  
  // 3. Linhas
  dados.forEach(item => {
    const linha = colunas.map(col => {
      let val = item[col];
      // Tratamento para valores vazios ou objetos
      if (val === null || val === undefined) return '-';
      if (typeof val === 'object') return JSON.stringify(val);
      return val.toString();
    }).join(' | ');
    tabela += `| ${linha} |\n`;
  });

  return tabela + '\n';
}

// --- 1. CARREGAMENTO DE VARIÁVEIS ---
function carregarVariaveisAmbiente() {
  const arquivos = ['.dev.vars', '.env'];
  for (const arquivo of arquivos) {
    const caminho = path.resolve(process.cwd(), arquivo);
    if (fs.existsSync(caminho)) {
      console.log(`📄 Configuração lida de: ${arquivo}`);
      const conteudo = fs.readFileSync(caminho, 'utf-8');
      conteudo.split(/\r?\n/).forEach(linha => {
        const match = linha.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1].trim()]) {
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
          process.env[match[1].trim()] = val;
        }
      });
      return;
    }
  }
}
carregarVariaveisAmbiente();

const CONFIG = {
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  zoneId: process.env.CLOUDFLARE_ZONE_ID,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID
};

if (!CONFIG.apiToken || !CONFIG.zoneId) {
  console.error('❌ ERRO: Faltam credenciais (CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID).');
  process.exit(1);
}

const API_BASE = 'https://api.cloudflare.com/client/v4';

// --- 2. FUNÇÃO DE TESTE DE CONEXÃO ---
async function verificarConexao() {
  console.log('\n--- 🔌 1. TESTE DE CONEXÃO E AUTENTICAÇÃO ---');
  const verificationUrl = CONFIG.accountId 
    ? `${API_BASE}/accounts/${CONFIG.accountId}/tokens/verify`
    : `${API_BASE}/user/tokens/verify`;

  try {
    const response = await fetch(verificationUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${CONFIG.apiToken}`, 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    
    if (result.success || result.status === 'active') {
      console.log('✅ Conexão estabelecida com sucesso!');
      return true;
    }
    
    throw new Error(`API indicou falha: ${JSON.stringify(result.messages || result.errors)}`);
  } catch (error) {
    console.error('❌ FALHA CRÍTICA DE CONEXÃO:', error.message);
    return false;
  }
}

// --- 3. DEFINIÇÃO DAS QUERIES ---
const QUERIES = {
  http: `
    query HttpTraffic($zoneTag: string, $start: Time, $end: Time) {
      viewer { zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1hGroups(limit: 5, filter: { datetime_geq: $start, datetime_leq: $end }) {
          sum { requests bytes } dimensions { datetime }
        }
      }}
    }
  `,
  firewall: `
    query FirewallEvents($zoneTag: string, $start: Time, $end: Time) {
      viewer { zones(filter: { zoneTag: $zoneTag }) {
        firewallEventsAdaptiveGroups(limit: 5, filter: { datetime_geq: $start, datetime_leq: $end }) {
          count dimensions { action clientCountryName }
        }
      }}
    }
  `,
  loadBalancing: `
    query LoadBalancing($zoneTag: string, $start: Time, $end: Time) {
      viewer { zones(filter: { zoneTag: $zoneTag }) {
        loadBalancingRequestsAdaptiveGroups(limit: 5, filter: { datetime_geq: $start, datetime_leq: $end }) {
          count dimensions { lbName regionCode }
        }
      }}
    }
  `,
  network: `
    query NetworkAnalytics($accountTag: string, $start: Time, $end: Time) {
      viewer { accounts(filter: { accountTag: $accountTag }) {
        ipFlows1mGroups(limit: 5, filter: { datetime_geq: $start, datetime_leq: $end }) {
          sum { bits packets } dimensions { datetime }
        }
      }}
    }
  `
};

// --- 4. EXECUTOR MODULAR ---
async function executarModulo(nome, queryGraphql, tipoEscopo = 'zone') {
  console.log(`⏳ Processando: ${nome}...`);
  
  // Adiciona título ao Markdown
  conteudoRelatorio += `## ${nome}\n\n`;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const variables = {
    zoneTag: CONFIG.zoneId,
    accountTag: CONFIG.accountId || '',
    start: yesterday.toISOString(),
    end: now.toISOString()
  };

  try {
    const response = await fetch(`${API_BASE}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.apiToken}` },
      body: JSON.stringify({ query: queryGraphql, variables })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const result = await response.json();

    if (result.errors) {
      const erroMsg = `> ⚠️ **Erro na API:** ${result.errors[0].message}`;
      console.warn(`   ⚠️ Erro na API para ${nome}`);
      conteudoRelatorio += erroMsg + '\n\n';
      return;
    }

    const dadosRaiz = tipoEscopo === 'zone' ? result.data?.viewer?.zones?.[0] : result.data?.viewer?.accounts?.[0];
    
    if (!dadosRaiz) {
      conteudoRelatorio += `> ℹ️ Estrutura de dados vazia.\n\n`;
      return;
    }

    const chaveDados = Object.keys(dadosRaiz)[0];
    const dadosReais = dadosRaiz[chaveDados];

    if (dadosReais && dadosReais.length > 0) {
      // "Achata" o objeto para a tabela ficar bonita
      const dadosFormatados = dadosReais.map(d => {
        return {
          ...d.dimensions,
          ...d.sum,
          count: d.count
        };
      });
      
      // Gera a tabela e adiciona ao relatório
      conteudoRelatorio += criarTabelaMarkdown(dadosFormatados) + '\n';
      console.log(`   ✅ ${nome}: Dados capturados.`);
    } else {
      conteudoRelatorio += `_Nenhum registro encontrado nas últimas 24h._\n\n`;
      console.log(`   ℹ️ ${nome}: Sem dados.`);
    }

  } catch (err) {
    console.error(`❌ FALHA (${nome}): ${err.message}`);
    conteudoRelatorio += `> ❌ **Falha de execução:** ${err.message}\n\n`;
  }
}

// --- 5. ORQUESTRADOR PRINCIPAL ---
async function main() {
  if (!await verificarConexao()) {
    console.log('\n🛑 Encerrando script.');
    process.exit(1);
  }

  console.log('\n--- 🚀 2. GERANDO RELATÓRIO... ---');
  
  await executarModulo('Tráfego HTTP', QUERIES.http, 'zone');
  await executarModulo('Firewall (WAF)', QUERIES.firewall, 'zone');
  await executarModulo('Load Balancing', QUERIES.loadBalancing, 'zone');
  
  if (CONFIG.accountId) {
    await executarModulo('Network Analytics', QUERIES.network, 'account');
  } else {
    conteudoRelatorio += `## Network Analytics\n> _Ignorado: Account ID não configurado._\n`;
  }

  // SALVAR O ARQUIVO FINAL
  const nomeArquivo = 'RELATORIO_CLOUDFLARE.md';
  try {
    fs.writeFileSync(path.resolve(process.cwd(), nomeArquivo), conteudoRelatorio, 'utf-8');
    console.log(`\n🏁 SUCESSO! Relatório salvo em: ${nomeArquivo}`);
    console.log(`👉 Abra este arquivo no seu editor para ver as tabelas.`);
  } catch (e) {
    console.error('❌ Erro ao salvar o arquivo:', e);
  }
}

main();