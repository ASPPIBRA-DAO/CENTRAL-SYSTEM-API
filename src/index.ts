/**
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API & Identity Provider
 * Entry Point: Cloudflare Worker (Hono Framework)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types/bindings';
import { createDb, Database } from './db';
import { error } from './utils/response';
import { DashboardTemplate } from './views/dashboard';
import { AuditService } from './services/audit';
import { getTokenMarketData } from './services/market';

// --- CORE MODULES ---
import authRouter from './routes/core/auth';
import healthRouter from './routes/core/health';
import webhooksRouter from './routes/core/webhooks';

// --- PLATFORM MODULES ---
import paymentsRouter from './routes/platform/payments';
import storageRouter from './routes/platform/storage';

// --- PRODUCT MODULES ---
import agroRouter from './routes/products/agro';
import rwaRouter from './routes/products/rwa';
import blogRouter from './routes/products/blog';

// Configuração de Tipagem do Hono
type Variables = {
  db: Database;
};

type AppType = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppType>();

// =================================================================
// 1. MIDDLEWARES GLOBAIS
// =================================================================

// 1.1 CORS Dinâmico para suporte a Vercel e Localhost
app.use('/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      const allowedOrigins = [
        'http://localhost:8080',
        'http://localhost:3000',
        'https://asppibra.com', 
        'https://www.asppibra.com', 
        'https://api.asppibra.com',
        'https://social-fi-asppibra.vercel.app' // Adicione sua URL específica da Vercel
      ];
      // Permite localhost, domínios de desenvolvimento da Cloudflare e origens oficiais
      if (origin && (
        origin.includes('localhost') || 
        origin.includes('cloudworkstations.dev') || 
        origin.includes('.vercel.app') || 
        allowedOrigins.includes(origin)
      )) {
        return origin;
      }
      return allowedOrigins[0]; // Fallback seguro para produção
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-App-ID', 'x-admin-key'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// 1.2 Database Injection (Scoped)
app.use(async (c, next) => {
  if (!c.env.DB) {
    return error(c, 'Binding DB não configurado no wrangler.toml', null, 500);
  }
  const db = createDb(c.env.DB);
  c.set('db', db);
  await next();
});

// 1.3 Audit & Telemetry com WaitUntil (Performance)
app.use('*', async (c, next) => {
  const start = Date.now();
  await next(); 

  const path = c.req.path;
  // Ignora logs de telemetria para assets e rotas de saúde
  if (!path.match(/\.(css|js|png|jpg|ico|json|map)$/) && !path.startsWith('/api/core/health')) {
    const audit = new AuditService(c.env);
    const executionTime = Date.now() - start;
    const cf = (c.req.raw as any).cf;

    c.executionCtx.waitUntil(
      audit.log({
        action: "API_REQUEST",
        ip: c.req.header("cf-connecting-ip") || "unknown",
        country: c.req.header("cf-ipcountry") || "XX",
        userAgent: c.req.header("user-agent"),
        status: c.res.ok ? "success" : "failure",
        metadata: {
          path: path,
          method: c.req.method,
          executionTimeMs: executionTime,
          city: cf?.city       
        }
      })
    );
  }
});

// =================================================================
// 2. ROTAS DE DASHBOARD E MONITORAMENTO
// =================================================================

app.get('/', async (c) => {
  const audit = new AuditService(c.env);
  const metrics = await audit.getDashboardMetrics();
  
  const domain = c.req.url.includes('localhost') ? "http://localhost:8787" : "https://api.asppibra.com";

  return c.html(DashboardTemplate({
    version: "1.1.0",
    service: "Central System API",
    cacheRatio: (metrics as any).cacheRatio || "N/A", 
    domain: domain,
    imageUrl: `${domain}/img/social-preview.png`
  }));
});

app.get('/api/stats', async (c) => {
  const audit = new AuditService(c.env);
  return c.json(await audit.getDashboardMetrics());
});

// =================================================================
// 3. API & ROTAS MODULARES
// =================================================================

app.route('/api/core/auth', authRouter);
app.route('/api/core/health', healthRouter);
app.route('/api/core/webhooks', webhooksRouter);
app.route('/api/platform/payments', paymentsRouter);
app.route('/api/platform/storage', storageRouter);
app.route('/api/products/agro', agroRouter);
app.route('/api/products/rwa', rwaRouter);
app.route('/api/posts', blogRouter); // SocialFi Integration

// =================================================================
// 4. ARQUIVOS ESTÁTICOS & ERROS
// =================================================================

app.get('/static/*', async (c) => {
  return await c.env.ASSETS.fetch(c.req.raw as any) as unknown as Response;
});

app.notFound((c) => c.json({ success: false, message: 'Rota não encontrada (404)' }, 404));

app.onError((err, c) => {
  console.error('🔥 Server Error:', err);
  return c.json({ success: false, message: 'Internal Server Error', error: err.message }, 500);
});

export default {
  fetch: app.fetch,
  
  // Worker CRON: Atualização de Mercado e Estatísticas
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      await updateTokenPrice(env);
      const audit = new AuditService(env);
      await audit.computeGlobalStats();
    })());
  },
};

// Lógica de Atualização de Cache KV (Preços de Token)
async function updateTokenPrice(env: Bindings) {
  try {
    const newData = await getTokenMarketData(env, 'price_only');
    if (newData && env.KV_CACHE) {
      await env.KV_CACHE.put("market:data", JSON.stringify(newData));
      await env.KV_CACHE.put("market:price_usd", newData.price.toString());
    }
  } catch (error) {
    console.error("❌ Cron: Erro na atualização", error);
  }
}