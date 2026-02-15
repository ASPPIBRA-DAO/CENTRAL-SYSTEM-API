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
import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';

const app = new Hono<{ Bindings: Bindings }>();

// 1. Health Check Inteligente (Ping + Service Discovery)
app.get('/', async (c) => {
  const servicesParam = c.req.query('services');
  
  const report: any = {
    status: 'ok',
    system: 'CENTRAL-SYSTEM-API',
    timestamp: new Date().toISOString()
  };

  // Se o parâmetro ?services=all for passado, realiza checagem profunda
  if (servicesParam === 'all') {
    const checks: any = {};
    let hasError = false;

    // --- Verificação D1 (Database) ---
    try {
      // Tenta uma query real em vez de apenas verificar a instância
      await c.env.DB.prepare('SELECT 1').first();
      checks.database = { status: 'healthy', type: 'D1' };
    } catch (e: any) {
      checks.database = { status: 'unhealthy', error: e.message };
      hasError = true;
    }

    // --- Verificação KV (Cache/Config) ---
    try {
      // Tenta listar chaves (operação leve)
      await c.env.KV_CACHE.list({ limit: 1 });
      checks.cache = { status: 'healthy', type: 'KV' };
    } catch (e: any) {
      checks.cache = { status: 'unhealthy', error: e.message };
      hasError = true;
    }

    // --- Verificação R2 (Storage) ---
    try {
      // Tenta listar objetos no bucket
      await c.env.STORAGE.list({ limit: 1 });
      checks.storage = { status: 'healthy', type: 'R2' };
    } catch (e: any) {
      checks.storage = { status: 'unhealthy', error: e.message };
      hasError = true;
    }

    report.details = checks;
    if (hasError) report.status = 'partial_error';
  }

  return c.json(report, report.status === 'ok' ? 200 : 207);
});

// 2. Health Check Dedicado do Banco de Dados
app.get('/db', async (c) => {
  try {
    // Executa teste real de leitura
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'ok', message: 'DB Connected and Responsive' });
  } catch (e: any) {
    return c.json({ status: 'error', message: e.message }, 500);
  }
});

// 3. Monitoramento Avançado (Cloudflare GraphQL)
app.get('/analytics', async (c) => {
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = c.env.CLOUDFLARE_ZONE_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !zoneId || !apiToken) {
    return c.json({ error: 'Configuração incompleta de Observabilidade' }, 500);
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const isoStart = oneDayAgo.toISOString();
  const isoEnd = now.toISOString();
  const dateStart = isoStart.split('T')[0];

  // Query otimizada para Cloudflare GraphQL
  const query = `
    query GetAnalytics($accountId: String!, $zoneId: String!, $start: String!, $end: DateTime!, $dateStart: Date!) {
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
          countries: httpRequestsAdaptiveGroups(limit: 5, filter: { datetime_geq: $start, datetime_lt: $end }, orderBy: [count_DESC]) {
            count
            dimensions { clientCountryName }
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
        variables: { accountId, zoneId, start: isoStart, end: isoEnd, dateStart }
      })
    });

    const cfData: any = await cfResponse.json();

    if (cfData.errors) {
      return c.json({ error: 'Erro API Cloudflare', details: cfData.errors }, 500);
    }

    const zoneData = cfData?.data?.viewer?.zones?.[0] || {};
    const accountData = cfData?.data?.viewer?.accounts?.[0] || {};
    
    const trafficRaw = zoneData.traffic?.[0] || { count: 0, sum: { edgeResponseBytes: 0 } };
    const dbMetrics = accountData.d1?.[0]?.sum || { readQueries: 0, writeQueries: 0 };
    const cacheRaw = zoneData.cache || [];
    
    const totalCacheReqs = cacheRaw.reduce((acc: number, item: any) => acc + item.count, 0);
    const hits = cacheRaw.find((i: any) => ['hit', 'revalidated'].includes(i.dimensions.cacheStatus))?.count || 0;
    const cacheRatio = totalCacheReqs > 0 ? ((hits / totalCacheReqs) * 100).toFixed(0) : "0";

    const countries = (zoneData.countries || []).map((item: any) => ({
      code: item.dimensions.clientCountryName,
      count: item.count
    }));

    return c.json({
      requests: trafficRaw.count,
      bytes: trafficRaw.sum.edgeResponseBytes,
      cacheRatio: `${cacheRatio}%`,
      dbReads: dbMetrics.readQueries,
      dbWrites: dbMetrics.writeQueries,
      countries: countries
    });

  } catch (e: any) {
    return c.json({ error: 'Falha interna de monitoramento', msg: e.message }, 500);
  }
});

export default app;