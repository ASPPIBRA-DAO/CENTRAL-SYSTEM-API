/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Health Monitor & Infrastructure Analytics
 * Version: 1.3.0 - Unified Response Pattern & Test Compatibility
 */

import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';
import { success, error } from '../../utils/response'; // 🟢 Padronização Vital

const app = new Hono<{ Bindings: Bindings }>();

// ----------------------------------------------------------------------

/**
 * [1] HEALTH CHECK INTELIGENTE
 * Realiza Service Discovery e verifica a integridade dos Bindings (D1, KV, R2).
 */
app.get('/', async (c) => {
  const servicesParam = c.req.query('services');
  
  const report: any = {
    status: 'ok',
    system: 'CENTRAL-SYSTEM-API',
    timestamp: new Date().toISOString()
  };

  // Executa checagem profunda se solicitado via query params (?services=all)
  if (servicesParam === 'all') {
    const checks: any = {};
    let hasError = false;

    // --- Verificação D1 (Database) ---
    try {
      await c.env.DB.prepare('SELECT 1').first();
      checks.database = { status: 'healthy', type: 'D1' };
    } catch (e: any) {
      checks.database = { status: 'unhealthy', error: e.message };
      hasError = true;
    }

    // --- Verificação KV (Cache/Config) ---
    try {
      await c.env.KV_CACHE.list({ limit: 1 });
      checks.cache = { status: 'healthy', type: 'KV' };
    } catch (e: any) {
      checks.cache = { status: 'unhealthy', error: e.message };
      hasError = true;
    }

    // --- Verificação R2 (Storage) ---
    try {
      await c.env.STORAGE.list({ limit: 1 });
      checks.storage = { status: 'healthy', type: 'R2' };
    } catch (e: any) {
      checks.storage = { status: 'unhealthy', error: e.message };
      hasError = true;
    }

    report.details = checks;
    if (hasError) report.status = 'partial_error';
  }

  // 🟢 RETORNO PADRONIZADO: Resolve o erro de 'success undefined' nos testes
  return success(c, 'Relatório de integridade do sistema', report, report.status === 'ok' ? 200 : 207);
});

// ----------------------------------------------------------------------

/**
 * [2] HEALTH CHECK DEDICADO DO BANCO
 * Endpoint específico para o teste unitário test/index.spec.ts.
 */
app.get('/db', async (c) => {
  try {
    // Teste de latência/leitura real no D1
    await c.env.DB.prepare('SELECT 1').first();
    
    // 🟢 FORMATO EXIGIDO: data.status === 'ok'
    return success(c, 'Conexão com D1 estável', { status: 'ok' });
  } catch (e: any) {
    return error(c, 'Falha na comunicação com o banco de dados', e.message, 500);
  }
});

// ----------------------------------------------------------------------

/**
 * [3] ANALYTICS (CLOUDFLARE GRAPHQL)
 * Extrai métricas reais de uso da infraestrutura via API da Cloudflare.
 */
app.get('/analytics', async (c) => {
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = c.env.CLOUDFLARE_ZONE_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !zoneId || !apiToken) {
    return error(c, 'Configuração de observabilidade incompleta', null, 500);
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateStart = oneDayAgo.toISOString().split('T')[0];

  // Query GraphQL otimizada para monitorar D1 e Tráfego de Borda
  const query = `
    query GetAnalytics($accountId: String!, $zoneId: String!, $start: DateTime!, $end: DateTime!, $dateStart: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          d1: d1AnalyticsAdaptiveGroups(limit: 1, filter: { date_geq: $dateStart }) {
            sum { readQueries, writeQueries }
          }
        }
        zones(filter: { zoneTag: $zoneId }) {
          traffic: httpRequestsAdaptiveGroups(limit: 1, filter: { datetime_geq: $start, datetime_lt: $end }) {
            count
            sum { edgeResponseBytes }
          }
          cache: httpRequestsAdaptiveGroups(limit: 5, filter: { datetime_geq: $start, datetime_lt: $end }, orderBy: [count_DESC]) {
            count
            dimensions { cacheStatus }
          }
        }
      }
    }
  `;

  try {
    const cfResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiToken}` 
      },
      body: JSON.stringify({ 
        query,
        variables: { accountId, zoneId, start: oneDayAgo.toISOString(), end: now.toISOString(), dateStart }
      })
    });

    const cfData: any = await cfResponse.json();

    if (cfData.errors) {
      return error(c, 'Erro na API de Telemetria Cloudflare', cfData.errors, 500);
    }

    // Processamento de métricas...
    const zoneData = cfData?.data?.viewer?.zones?.[0] || {};
    const accountData = cfData?.data?.viewer?.accounts?.[0] || {};
    const trafficRaw = zoneData.traffic?.[0] || { count: 0, sum: { edgeResponseBytes: 0 } };
    const dbMetrics = accountData.d1?.[0]?.sum || { readQueries: 0, writeQueries: 0 };
    
    // Cálculo do Cache Hit Ratio
    const cacheRaw = zoneData.cache || [];
    const totalReqs = cacheRaw.reduce((acc: number, item: any) => acc + item.count, 0);
    const hits = cacheRaw.find((i: any) => ['hit', 'revalidated'].includes(i.dimensions.cacheStatus))?.count || 0;
    const cacheRatio = totalReqs > 0 ? ((hits / totalReqs) * 100).toFixed(0) : "0";

    return success(c, 'Métricas de infraestrutura recuperadas', {
      requests: trafficRaw.count,
      bytes: trafficRaw.sum.edgeResponseBytes,
      cacheRatio: `${cacheRatio}%`,
      dbReads: dbMetrics.readQueries,
      dbWrites: dbMetrics.writeQueries
    });

  } catch (e: any) {
    return error(c, 'Falha interna ao processar telemetria', e.message, 500);
  }
});

export default app;