/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API Entry Point (Hono Framework)
 * Version: 1.2.1 - Fix: AuditAction Alignment
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
 * Configuração de Tipagem Global do App
 * Utiliza as definições sincronizadas para garantir Type-Safety total.
 */
type AppType = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppType>();

// =================================================================
// 1. MIDDLEWARES GLOBAIS
// =================================================================

/**
 * 1.1 CORS Dinâmico & Adaptativo
 * Configurado para permitir o ecossistema Monorepo (Vercel + Cloudflare).
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
    maxAge: 600,
  });
  return corsMiddleware(c, next);
});

/**
 * 1.2 Injeção de Banco de Dados (D1 Factory)
 * Garante que a instância do Drizzle esteja disponível em c.var.db.
 */
app.use(async (c, next) => {
  if (!c.env.DB) {
    return error(c, 'Binding D1 (DB) não encontrado no ambiente.', null, 500);
  }
  const db = createDb(c.env.DB);
  c.set('db', db);
  await next();
});

/**
 * 1.3 Auditoria Forense & Telemetria
 * 🟢 CORREÇÃO: 'action' alterada para "API_REQUEST" para alinhar com o AuditService.
 */
app.use('*', async (c, next) => {
  const start = Date.now();
  await next(); 

  const path = c.req.path;
  // Ignora logs para arquivos estáticos e rotas de telemetria interna
  if (!path.match(/\.(css|js|png|jpg|ico|json)$/) && !path.startsWith('/api/core/health')) {
    const audit = new AuditService(c.env);
    const executionTime = Date.now() - start;

    c.executionCtx.waitUntil(
      audit.log({
        action: "API_REQUEST", // Valor corrigido conforme AuditAction
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
// 2. DASHBOARD DE STATUS
// =================================================================

app.get('/', async (c) => {
  const audit = new AuditService(c.env);
  const metrics = await audit.getDashboardMetrics();
  
  const host = c.env.ENVIRONMENT === 'production' 
    ? "https://api.asppibra.com" 
    : "http://localhost:8787";

  return c.html(DashboardTemplate({
    version: "1.2.1",
    service: "ASPPIBRA DAO Core API",
    cacheRatio: (metrics as any).cacheRatio || "98%", 
    domain: host,
    imageUrl: `${host}/img/social-preview.png`
  }));
});

// =================================================================
// 3. ORQUESTRAÇÃO DE ROTAS
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
// 4. ERROS E TAREFAS AGENDADAS (CRON)
// =================================================================

app.notFound((c) => c.json({ success: false, message: 'Rota não encontrada' }, 404));

app.onError((err, c) => {
  console.error(`[CRITICAL_ERROR]: ${err.message}`);
  return c.json({ 
    success: false, 
    message: 'Falha no sistema central da DAO',
    error: c.env.ENVIRONMENT === 'development' ? err.message : undefined 
  }, 500);
});

export default {
  fetch: app.fetch,
  
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await updateMarketCache(env);
      const audit = new AuditService(env);
      await audit.computeGlobalStats();
    })());
  },
};

async function updateMarketCache(env: Bindings) {
  try {
    const marketData = await getTokenMarketData(env, 'price_only');
    if (marketData && env.KV_CACHE) {
      await env.KV_CACHE.put("market:data", JSON.stringify(marketData));
      console.log("[CRON] Cache de mercado atualizado.");
    }
  } catch (err) {
    console.error("[CRON ERROR]", err);
  }
}