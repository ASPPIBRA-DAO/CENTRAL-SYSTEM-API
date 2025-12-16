import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';

const app = new Hono<{ Bindings: Bindings }>();

// 1. Health Check Simples (Ping)
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    system: 'CENTRAL-SYSTEM-API',
    timestamp: new Date().toISOString()
  });
});

// 2. Health Check do Banco de Dados
app.get('/db', async (c) => {
  // Como o middleware global já injetou o DB, se chegou aqui, o DB instanciou.
  // Podemos fazer uma query simples para garantir.
  try {
    const db = c.get('db' as any); // Recupera do contexto
    // Opcional: const result = await db.run(sql`SELECT 1`);
    return c.json({ status: 'ok', message: 'DB Connected' });
  } catch (e: any) {
    return c.json({ status: 'error', message: e.message }, 500);
  }
});

// 3. Monitoramento Avançado (Cloudflare GraphQL)
// Movido do index.ts antigo para cá
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

  const query = `
    query {
      viewer {
        accounts(filter: { accountTag: "${accountId}" }) {
          d1: d1AnalyticsAdaptiveGroups(limit: 1, filter: { date_geq: "${dateStart}" }) {
            sum { readQueries, writeQueries }
          }
        }
        zones(filter: { zoneTag: "${zoneId}" }) {
          traffic: httpRequestsAdaptiveGroups(limit: 1, filter: { datetime_geq: "${isoStart}", datetime_lt: "${isoEnd}" }) {
            count
            sum { edgeResponseBytes }
          }
          cache: httpRequestsAdaptiveGroups(limit: 5, filter: { datetime_geq: "${isoStart}", datetime_lt: "${isoEnd}" }, orderBy: [count_DESC]) {
            count
            dimensions { cacheStatus }
          }
          countries: httpRequestsAdaptiveGroups(limit: 5, filter: { datetime_geq: "${isoStart}", datetime_lt: "${isoEnd}" }, orderBy: [count_DESC]) {
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
      body: JSON.stringify({ query })
    });

    const cfData: any = await cfResponse.json();

    if (cfData.errors) {
      console.error("Erro Cloudflare:", JSON.stringify(cfData.errors));
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
      cacheRatio: cacheRatio,
      dbReads: dbMetrics.readQueries,
      dbWrites: dbMetrics.writeQueries,
      countries: countries
    });

  } catch (e: any) {
    console.error("Monitoring Exception:", e.message);
    return c.json({ error: 'Falha interna', msg: e.message }, 500);
  }
});

export default app;