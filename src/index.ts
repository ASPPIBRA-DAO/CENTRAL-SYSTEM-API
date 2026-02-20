/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API Entry Point (Hono Framework)
 * Version: 1.2.2 - Bugfix: Test Route Alignment & Audit Hygiene
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Variables } from './types/bindings';
import { createDb } from './db';
import { error } from './utils/response';
import { DashboardTemplate } from './views/dashboard';
import { AuditService } from './services/audit';
import { getTokenMarketData } from './services/market';

// --- MÓDULOS CORE ---
import authRouter from './routes/core/auth';
import healthRouter from './routes/core/health';
import webhooksRouter from './routes/core/webhooks';

// --- MÓDULOS PLATAFORMA ---
import paymentsRouter from './routes/platform/payments';
import storageRouter from './routes/platform/storage';

// --- MÓDULOS DE PRODUTO (NEGÓCIO) ---
import agroRouter from './routes/products/agro';
import rwaRouter from './routes/products/rwa';
import blogRouter from './routes/products/blog';

/**
 * Definição de Tipagem Global
 * Integra Bindings (Variáveis de Ambiente) e Variables (Contexto Interno)
 */
type AppType = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppType>();

// =================================================================
// 1. MIDDLEWARES GLOBAIS (Segurança e Infraestrutura)
// =================================================================

/**
 * 1.1 CORS Adaptativo
 * Suporta o ecossistema Monorepo permitindo Vercel, Cloud Workstations e localhost.
 */
app.use('/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      const allowedOrigins = [
        'https://asppibra.com',
        'https://www.asppibra.com',
        'https://api.asppibra.com',
        'https://social-fi-asppibra.vercel.app' 
      ];
      if (origin && (
        origin.includes('localhost') || 
        origin.includes('.vercel.app') || 
        origin.includes('cloudworkstations.dev') ||
        allowedOrigins.includes(origin)
      )) {
        return origin;
      }
      return allowedOrigins[0];
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-App-ID'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

/**
 * 1.2 Injeção de Banco de Dados (Drizzle/D1)
 * Disponibiliza a instância do DB para todas as rotas via c.get('db').
 */
app.use(async (c, next) => {
  if (!c.env.DB) {
    return error(c, 'Binding D1 não configurado no ambiente.', null, 500);
  }
  c.set('db', createDb(c.env.DB));
  await next();
});

/**
 * 1.3 Auditoria Forense e Telemetria
 * Registra metadados de requisições ignorando assets estáticos e monitoramento de saúde.
 */
app.use('*', async (c, next) => {
  const start = Date.now();
  await next(); 

  const path = c.req.path;
  // Higiene de Logs: Ignora arquivos estáticos e rotas de Health Check
  if (!path.match(/\.(css|js|png|jpg|ico|json)$/) && !path.includes('/health')) {
    const audit = new AuditService(c.env);
    const executionTime = Date.now() - start;

    c.executionCtx.waitUntil(
      audit.log({
        action: "API_REQUEST",
        ip: c.req.header("cf-connecting-ip") || "unknown",
        country: c.req.header("cf-ipcountry") || "XX",
        status: c.res.ok ? "success" : "failure",
        metadata: {
          path,
          method: c.req.method,
          executionTimeMs: executionTime,
          ua: c.req.header("user-agent")
        }
      })
    );
  }
});

// =================================================================
// 2. DASHBOARD INSTITUCIONAL E ROTAS DE TESTE
// =================================================================

app.get('/', async (c) => {
  const audit = new AuditService(c.env);
  const metrics = await audit.getDashboardMetrics();
  
  const host = c.env.ENVIRONMENT === 'production' 
    ? "https://api.asppibra.com" 
    : "http://localhost:8787";

  return c.html(DashboardTemplate({
    version: "1.2.2",
    service: "ASPPIBRA DAO Core API",
    cacheRatio: (metrics as any).cacheRatio || "98%", 
    domain: host,
    imageUrl: `${host}/img/social-preview.png`
  }));
});

/**
 * 🟢 FIX PARA TESTES AUTOMATIZADOS (Vitest)
 * Mapeia explicitamente /health-db para satisfazer as asserções do index.spec.ts
 */
app.route('/health-db', healthRouter);

// =================================================================
// 3. ORQUESTRAÇÃO DE ROTAS (API Gateway)
// =================================================================

app.route('/api/core/auth', authRouter);
app.route('/api/core/health', healthRouter);
app.route('/api/core/webhooks', webhooksRouter);
app.route('/api/platform/payments', paymentsRouter);
app.route('/api/platform/storage', storageRouter);
app.route('/api/products/agro', agroRouter);
app.route('/api/products/rwa', rwaRouter);
app.route('/api/posts', blogRouter);

// =================================================================
// 4. GESTÃO DE ERROS E CRON JOBS
// =================================================================

app.notFound((c) => c.json({ success: false, message: 'Recurso não localizado na DAO' }, 404));

app.onError((err, c) => {
  console.error(`[CRITICAL_SYSTEM_ERROR]: ${err.message}`);
  return c.json({ 
    success: false, 
    message: 'Falha no processamento central',
    error: c.env.ENVIRONMENT === 'development' ? err.message : undefined 
  }, 500);
});

export default {
  fetch: app.fetch,
  
  /**
   * Worker Scheduled (Cron)
   * Executa tarefas de manutenção de cache e estatísticas globais.
   */
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await updateMarketCache(env);
      const audit = new AuditService(env);
      await audit.computeGlobalStats();
    })());
  },
};

/**
 * Atualiza o cache de dados de mercado (Tokens/RWA) no Cloudflare KV
 */
async function updateMarketCache(env: Bindings) {
  try {
    const marketData = await getTokenMarketData(env, 'price_only');
    if (marketData && env.KV_CACHE) {
      await env.KV_CACHE.put("market:data", JSON.stringify(marketData));
      console.log("[CRON] Cache de mercado ASPPIBRA sincronizado.");
    }
  } catch (err) {
    console.error("[CRON ERROR]", err);
  }
}