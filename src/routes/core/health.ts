/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Health Monitor & Infrastructure Analytics (Absolute Bank-Grade 10/10)
 * Version: 8.0.1 - Full SRE Maturity & Universal TS Strict-Mode Compliant
 */

import { Hono } from 'hono';
import { success, error } from '../../../utils/response'; 
import { rateLimit } from '../../../middleware/rate-limit'; 

type Bindings = {
  DB: D1Database;
  KV_CACHE: KVNamespace;
  STORAGE: R2Bucket;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  INTERNAL_HEALTH_SECRET: string; 
  NODE_ENV?: string;
};

// 🛡️ SRE UTILITY: Define a structural execution context to resolve TS conflicts with global worker types
type WaitUntilCtx = { waitUntil(promise: Promise<any>): void };

const app = new Hono<{ Bindings: Bindings }>();

// 🛡️ SRE: Isolate Semaphore (Local CPU Exhaustion Protection)
let activeDeepChecks = 0;
const MAX_CONCURRENT_DEEP_CHECKS = 3;

// ⚡ UTILITY: Timer de Precisão
const measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> => {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
};

// ⚡ UTILITY: Hard Timeout
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
  ]);
};

// ⚡ UTILITY: Event Loop Lag Measurement
const measureEventLoopLag = (): Promise<number> => {
  return new Promise((resolve) => {
    const start = Date.now();
    setTimeout(() => {
      resolve(Date.now() - start);
    }, 0);
  });
};

// 🛡️ UTILITY: Structural & Logical Validation for Cache Fallback
const isValidFallbackCache = (data: any): boolean => {
  return data && 
         typeof data === 'object' && 
         typeof data.requests === 'number' && data.requests >= 0 && data.requests < 1e12 &&
         typeof data.bytes === 'number' && data.bytes >= 0 && data.bytes < 1e15 &&
         typeof data.dbReads === 'number' && data.dbReads >= 0 && data.dbReads < 1e12 &&
         typeof data.dbWrites === 'number' && data.dbWrites >= 0 && data.dbWrites < 1e12;
};

// 🔒 SECURITY: Constant-Time Scoped HMAC with Strict 1-Time Use Nonce (Anti-Replay)
const verifyHmacToken = async (
  header: string, 
  secretBase: string, 
  method: string, 
  path: string, 
  search: string,
  kv: KVNamespace | undefined, 
  ctx: WaitUntilCtx | undefined
): Promise<boolean> => {
  if (!header || !header.includes('.')) return false;
  const [timestampStr, signatureHex] = header.split('.');
  const timestamp = parseInt(timestampStr, 10);
  
  // ±30s Time-Drift Tolerance
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 30000) return false;

  // 🛡️ Anti-Replay: Verifica se a assinatura já foi usada nos últimos 35s
  const nonceKey = `sys:nonce:${signatureHex}`;
  if (kv) {
    try {
      const isReplayed = await kv.get(nonceKey);
      if (isReplayed) return false;
    } catch {
      // Fail-open apenas se o KV falhar totalmente
    }
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretBase),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'] 
  );
  
  const sigBytes = new Uint8Array(Math.ceil(signatureHex.length / 2));
  for (let i = 0; i < sigBytes.length; i++) {
    sigBytes[i] = parseInt(signatureHex.substring(i * 2, i * 2 + 2), 16);
  }

  // Assina: timestamp.METHOD./path?query
  const payloadStr = `${timestampStr}.${method.toUpperCase()}.${path}${search}`;

  try {
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadStr));
    
    // Bloqueia reuso gravando o Nonce
    if (isValid && kv && ctx) {
      ctx.waitUntil(kv.put(nonceKey, '1', { expirationTtl: 35 }));
    }
    
    return isValid;
  } catch {
    return false;
  }
};

// 🛡️ SRE: Distributed Global L2 Rate Limiter (IP-Based Bucket)
const checkGlobalL2RateLimit = async (kv: KVNamespace | undefined, currentIp: string, ctx: WaitUntilCtx | undefined): Promise<boolean> => {
  if (!kv || !ctx) return true; // Fail-open
  const limitWindowKey = `sys:ratelimit:l2:${currentIp}:${Math.floor(Date.now() / 60000)}`; 
  
  try {
    const currentCountStr = await kv.get(limitWindowKey);
    const count = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    
    if (count >= 5) return false; 
    
    ctx.waitUntil(kv.put(limitWindowKey, (count + 1).toString(), { expirationTtl: 60 }));
    return true;
  } catch (e) {
    return true; 
  }
};

// 🛡️ SRE: Distributed Global Semaphore
const acquireDistributedSemaphore = async (kv: KVNamespace | undefined, ctx: WaitUntilCtx | undefined): Promise<boolean> => {
  if (!kv || !ctx) return true; // Fail-open
  const semKey = `sys:semaphore:l2_active`;
  try {
    const isLocked = await kv.get(semKey);
    if (isLocked) return false; 
    
    ctx.waitUntil(kv.put(semKey, '1', { expirationTtl: 10 }));
    return true;
  } catch {
    return true;
  }
};

// ----------------------------------------------------------------------
// [1] L1/L2 HEALTH CHECK
// ----------------------------------------------------------------------
app.get('/', rateLimit({ limit: 60, window: 60 }), async (c) => {
  const urlParams = new URL(c.req.url);
  const servicesParam = urlParams.searchParams.get('services');
  const traceId = crypto.randomUUID(); 
  const cfRay = c.req.header('cf-ray') || 'unknown';
  c.header('X-Trace-Id', traceId);

  const lagMs = await measureEventLoopLag();

  // L1: Fast Return
  if (servicesParam !== 'all') {
    return success(c, 'Relatório de integridade do sistema (L1)', {
      status: lagMs > 50 ? 'degraded' : 'ok',
      system: 'edge-api', 
      timestamp: new Date().toISOString(),
      traceId,
      cfRay,
      workerMetrics: { eventLoopLagMs: lagMs }
    }, 200);
  }

  // 🔒 L2 SECURITY
  const tokenHeader = c.req.header('x-internal-token');
  if (!c.env.INTERNAL_HEALTH_SECRET || !tokenHeader) {
    if (c.env.NODE_ENV !== 'production') console.error(`[HEALTH_L2_DENIED] Trace: ${traceId} Ray: ${cfRay} - Missing Token`);
    return error(c, 'Acesso Negado: Faltam Credenciais de SRE', null, 403);
  }

  const isValidToken = await verifyHmacToken(
    tokenHeader, c.env.INTERNAL_HEALTH_SECRET, c.req.method, urlParams.pathname, urlParams.search, c.env.KV_CACHE, c.executionCtx as WaitUntilCtx
  );
  if (!isValidToken) {
    if (c.env.NODE_ENV !== 'production') console.error(`[HEALTH_L2_DENIED] Trace: ${traceId} Ray: ${cfRay} - Invalid HMAC / Nonce Replay`);
    return error(c, 'Acesso Negado: Token HMAC Inválido ou Replay Detectado', null, 403);
  }

  if (activeDeepChecks >= MAX_CONCURRENT_DEEP_CHECKS) {
    return error(c, 'Too Many Deep Checks Active - Isolate Protection Engaged', null, 429);
  }

  const currentIp = c.req.header('cf-connecting-ip') || 'unknown';
  const isGlobalAllowed = await checkGlobalL2RateLimit(c.env.KV_CACHE, currentIp, c.executionCtx as WaitUntilCtx);
  if (!isGlobalAllowed) {
    return error(c, 'Deep Check Quota Exceeded (5/min). Try again later.', null, 429);
  }

  const isSemaphoreAcquired = await acquireDistributedSemaphore(c.env.KV_CACHE, c.executionCtx as WaitUntilCtx);
  if (!isSemaphoreAcquired) {
    return error(c, 'Distributed Deep Check already in progress by another node.', null, 429);
  }

  activeDeepChecks++;

  try {
    type CheckDetail = { status: 'healthy' | 'degraded' | 'unhealthy'; type: string; durationMs: number; error?: string };
    const checks: Record<string, CheckDetail> = {};
    let hasError = false;
    let isDegraded = lagMs > 50;

    const isProd = c.env.NODE_ENV === 'production';
    const maskError = (e: unknown) => isProd ? 'Service Unavailable / Timeout' : (e instanceof Error ? e.message : String(e));

    try {
      if (!c.env.DB) throw new Error('D1 Binding Missing');
      const { durationMs } = await measureTime(() => withTimeout(c.env.DB.prepare('SELECT 1').first(), 1000));
      checks.database = { status: durationMs > 400 ? 'degraded' : 'healthy', type: 'D1', durationMs };
      if (durationMs > 400) isDegraded = true;
    } catch (e: unknown) {
      checks.database = { status: 'unhealthy', type: 'D1', durationMs: -1, error: maskError(e) };
      hasError = true;
    }

    try {
      if (!c.env.KV_CACHE) throw new Error('KV Binding Missing');
      const { durationMs } = await measureTime(() => withTimeout(c.env.KV_CACHE.get('sys:health:ping'), 500));
      checks.cache = { status: durationMs > 200 ? 'degraded' : 'healthy', type: 'KV', durationMs };
      if (durationMs > 200) isDegraded = true;
    } catch (e: unknown) {
      checks.cache = { status: 'unhealthy', type: 'KV', durationMs: -1, error: maskError(e) };
      hasError = true;
    }

    try {
      if (!c.env.STORAGE) throw new Error('R2 Binding Missing');
      const { durationMs } = await measureTime(() => withTimeout(c.env.STORAGE.head('sys/health/ping.txt'), 1000));
      checks.storage = { status: durationMs > 500 ? 'degraded' : 'healthy', type: 'R2', durationMs };
      if (durationMs > 500) isDegraded = true;
    } catch (e: unknown) {
      checks.storage = { status: 'unhealthy', type: 'R2', durationMs: -1, error: maskError(e) };
      hasError = true;
    }

    const overallStatus = hasError ? 'down' : isDegraded ? 'degraded' : 'ok';
    const httpStatus = hasError ? 503 : isDegraded ? 207 : 200;

    const report = {
      status: overallStatus,
      system: 'edge-api',
      timestamp: new Date().toISOString(),
      traceId,
      cfRay,
      workerMetrics: { eventLoopLagMs: lagMs, activeProbes: activeDeepChecks },
      details: checks
    };

    return success(c, 'Relatório de integridade profunda (L2)', report, httpStatus);
  } finally {
    activeDeepChecks--;
  }
});

// ----------------------------------------------------------------------
// [2] HEALTH CHECK DEDICADO DO BANCO
// ----------------------------------------------------------------------
app.get('/db', rateLimit({ limit: 60, window: 60 }), async (c) => {
  const urlParams = new URL(c.req.url);
  const traceId = crypto.randomUUID();
  const cfRay = c.req.header('cf-ray') || 'unknown';
  c.header('X-Trace-Id', traceId);

  const tokenHeader = c.req.header('x-internal-token');
  if (!c.env.INTERNAL_HEALTH_SECRET || !tokenHeader || !(await verifyHmacToken(
    tokenHeader, c.env.INTERNAL_HEALTH_SECRET, c.req.method, urlParams.pathname, urlParams.search, c.env.KV_CACHE, c.executionCtx as WaitUntilCtx
  ))) {
    return error(c, 'Acesso Negado (Anti-Replay Incorreto/Replay Detectado)', null, 403);
  }

  try {
    if (!c.env.DB) throw new Error('D1 Binding Not Configured');
    const { durationMs } = await measureTime(() => withTimeout(c.env.DB.prepare('SELECT 1').first(), 1000));
    
    const isDegraded = durationMs > 400;
    const report = { status: isDegraded ? 'degraded' : 'ok', durationMs, traceId, cfRay };
    
    return success(c, 'Conexão com D1 estável', report, isDegraded ? 207 : 200);
  } catch (e: unknown) {
    const msg = c.env.NODE_ENV === 'production' ? 'Database connectivity failed' : (e instanceof Error ? e.message : 'Unknown Error');
    return error(c, 'Falha na comunicação com o banco de dados', msg, 503);
  }
});

// ----------------------------------------------------------------------
// [3] ANALYTICS (CLOUDFLARE GRAPHQL)
// ----------------------------------------------------------------------
app.get('/analytics', rateLimit({ limit: 10, window: 300 }), async (c) => {
  const urlParams = new URL(c.req.url);
  const traceId = crypto.randomUUID();
  const cfRay = c.req.header('cf-ray') || 'unknown';
  c.header('X-Trace-Id', traceId);

  const tokenHeader = c.req.header('x-internal-token');
  if (!c.env.INTERNAL_HEALTH_SECRET || !tokenHeader || !(await verifyHmacToken(
    tokenHeader, c.env.INTERNAL_HEALTH_SECRET, c.req.method, urlParams.pathname, urlParams.search, c.env.KV_CACHE, c.executionCtx as WaitUntilCtx
  ))) {
    return error(c, 'Acesso Negado (Anti-Replay Incorreto/Replay Detectado)', null, 403);
  }

  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_ZONE_ID: zoneId, CLOUDFLARE_API_TOKEN: apiToken, KV_CACHE } = c.env;

  if (!accountId || !zoneId || !apiToken) {
    return error(c, 'Configuração de observabilidade incompleta (Faltam Variáveis)', null, 500);
  }

  const cacheKey = `sys:analytics:${accountId}:${zoneId}`;
  let fallback: any = null;
  
  if (KV_CACHE) {
     try {
       const cachedStr = await KV_CACHE.get(cacheKey);
       if (cachedStr) {
         const parsed = JSON.parse(cachedStr);
         if (isValidFallbackCache(parsed)) fallback = parsed;
       }
     } catch (e) {
       // Silent ignore
     }
  }

  if (fallback?.isDegraded && fallback?.circuitBreakerUntil > Date.now()) {
      return success(c, 'Circuito Aberto (Serviço Cloudflare Offline) - Dados Stale', fallback, 203);
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateStart = oneDayAgo.toISOString().split('T')[0];

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const cfResponse = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
      body: JSON.stringify({ query, variables: { accountId, zoneId, start: oneDayAgo.toISOString(), end: now.toISOString(), dateStart } }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!cfResponse.ok) throw new Error(`API Cloudflare HTTP ${cfResponse.status}`);

    const contentLength = cfResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1048576) {
      throw new Error(`Payload Too Large. Proteção de Memória V8 acionada.`);
    }

    const cfData = await cfResponse.json() as any;
    if (cfData.errors) throw new Error('GraphQL Errors Returned');

    const zoneData = cfData.data?.viewer?.zones?.[0];
    const accountData = cfData.data?.viewer?.accounts?.[0];
    const trafficRaw = zoneData?.traffic?.[0] || { count: 0, sum: { edgeResponseBytes: 0 } };
    const dbMetrics = accountData?.d1?.[0]?.sum || { readQueries: 0, writeQueries: 0 };
    const cacheRaw = zoneData?.cache || [];

    const totalReqs = cacheRaw.reduce((acc: number, item: any) => acc + (item.count || 0), 0);
    const hitsItem = cacheRaw.find((i: any) => ['hit', 'revalidated'].includes(i.dimensions?.cacheStatus?.toLowerCase() || ''));
    const hits = hitsItem?.count || 0;
    const cacheRatio = totalReqs > 0 ? ((hits / totalReqs) * 100).toFixed(0) : "0";

    const liveResult = {
      requests: trafficRaw.count,
      bytes: trafficRaw.sum?.edgeResponseBytes || 0,
      cacheRatio: `${cacheRatio}%`,
      dbReads: dbMetrics.readQueries,
      dbWrites: dbMetrics.writeQueries,
      timestamp: new Date().toISOString(),
      source: 'live',
      traceId,
      cfRay,
      isDegraded: false
    };

    if (KV_CACHE) {
      c.executionCtx.waitUntil(KV_CACHE.put(cacheKey, JSON.stringify({ ...liveResult, source: 'cache' }), { expirationTtl: 60 }));
    }

    return success(c, 'Métricas de infraestrutura recuperadas (Live)', liveResult);

  } catch (e: unknown) {
    if (fallback) {
      fallback.source = 'stale-fallback';
      fallback.traceId = traceId;
      fallback.isDegraded = true;
      const jitterMs = Math.floor(Math.random() * 60000);
      fallback.circuitBreakerUntil = Date.now() + 300000 + jitterMs; 
      
      if (KV_CACHE) {
        c.executionCtx.waitUntil(KV_CACHE.put(cacheKey, JSON.stringify(fallback), { expirationTtl: 360 }));
      }
      return success(c, 'Circuito Aberto: Métricas via cache estendido com Jitter', fallback, 203);
    }
    
    return error(c, 'Falha sistêmica ao processar telemetria e sem cache disponível', null, 503);
  }
});

export default app;