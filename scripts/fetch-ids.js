/**
 * 🕵️ CLOUDFLARE RESOURCE DISCOVERY
 * Busca IDs reais de KV, D1 e R2 para configurar o wrangler.jsonc
 */

const fs = require('node:fs');
const path = require('node:path');

// --- 1. CARREGAR CREDENCIAIS ---
function carregarEnv() {
  const arquivos = ['.dev.vars', '.env'];
  for (const f of arquivos) {
    if (fs.existsSync(f)) fs.readFileSync(f, 'utf-8').split(/\r?\n/).forEach(l => {
      const m = l.match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    });
  }
}
carregarEnv();

const CONFIG = {
  token: process.env.CLOUDFLARE_API_TOKEN,
  account: process.env.CLOUDFLARE_ACCOUNT_ID
};

if (!CONFIG.token || !CONFIG.account) {
  console.error('❌ Erro: CLOUDFLARE_API_TOKEN ou CLOUDFLARE_ACCOUNT_ID faltando no .dev.vars');
  process.exit(1);
}

const API = 'https://api.cloudflare.com/client/v4';
const HEADERS = { 'Authorization': `Bearer ${CONFIG.token}`, 'Content-Type': 'application/json' };

// --- 2. FUNÇÕES DE BUSCA ---

async function fetchAPI(endpoint) {
  const res = await fetch(`${API}/accounts/${CONFIG.account}${endpoint}`, { headers: HEADERS });
  const json = await res.json();
  if (!json.success) throw new Error(json.errors[0]?.message || 'Erro API');
  return json.result;
}

async function main() {
  console.log('🔍 Varrendo recursos na Cloudflare...\n');

  try {
    // 1. D1 DATABASES
    console.log('💾 Buscando Bancos D1...');
    const dbs = await fetchAPI('/d1/database');
    const myDb = dbs.find(d => d.name.includes('gov') || d.name.includes('system')) || dbs[0];
    
    // 2. KV NAMESPACES
    console.log('🔑 Buscando KVs...');
    const kvs = await fetchAPI('/storage/kv/namespaces');
    const kvCache = kvs.find(k => k.title.includes('CACHE')) || { id: "CRIE_UM_KV_CACHE", title: "Nao encontrado" };
    const kvAuth = kvs.find(k => k.title.includes('AUTH')) || { id: "CRIE_UM_KV_AUTH", title: "Nao encontrado" };

    // 3. R2 BUCKETS
    console.log('📦 Buscando Buckets R2...');
    const r2Data = await fetchAPI('/r2/buckets');
    const buckets = r2Data.buckets || [];
    const bucketDocs = buckets.find(b => b.name.includes('doc') || b.name.includes('gov')) || { name: "governance-docs" };

    console.log('\n✅ DADOS ENCONTRADOS! Copie os blocos abaixo para seu wrangler.jsonc:\n');
    console.log('---------------------------------------------------------------');

    console.log(`\n// 2. Banco de Dados D1 (Nome: ${myDb?.name || 'Não encontrado'})`);
    console.log(`"d1_databases": [
    {
      "binding": "DB",
      "database_name": "${myDb?.name || 'gov-system-db'}",
      "database_id": "${myDb?.uuid || 'RODE_WRANGLER_D1_CREATE'}"
    }
  ],`);

    console.log(`\n// 3. KV Namespaces`);
    console.log(`"kv_namespaces": [
    {
      "binding": "KV_CACHE",
      "id": "${kvCache.id}", 
      "preview_id": "${kvCache.id}" 
    },
    {
      "binding": "KV_AUTH",
      "id": "${kvAuth.id}",
      "preview_id": "${kvAuth.id}"
    }
  ],`);

    console.log(`\n// 4. R2 Storage`);
    console.log(`"r2_buckets": [
    {
      "binding": "STORAGE",
      "bucket_name": "${bucketDocs.name}",
      "preview_bucket_name": "${bucketDocs.name}-dev"
    }
  ],`);

    console.log('\n---------------------------------------------------------------');

    if (kvCache.id.includes('CRIE') || !myDb) {
      console.log('\n⚠️  AVISO: Alguns recursos não foram encontrados na conta.');
      console.log('   Para criar os faltantes, rode:');
      if (!myDb) console.log('   npx wrangler d1 create gov-system-db');
      if (kvCache.id.includes('CRIE')) console.log('   npx wrangler kv:namespace create KV_CACHE');
      if (kvAuth.id.includes('CRIE')) console.log('   npx wrangler kv:namespace create KV_AUTH');
    }

  } catch (error) {
    console.error('❌ Falha:', error.message);
  }
}

main();