import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types/bindings';
import { createDb, Database } from './db';
import { error } from './utils/response';
import { DashboardTemplate } from './views/dashboard';
import { AuditService } from './services/audit';
// [NOVO] Importa o serviço oficial de mercado (Moralis)
import { getTokenMarketData } from './services/market';

// --- CORE MODULES ---
import authRouter from './routes/core/auth';
import sessionRouter from './routes/core/auth/session';
import healthRouter from './routes/core/health';
import webhooksRouter from './routes/core/webhooks';

// --- PLATFORM MODULES ---
import paymentsRouter from './routes/platform/payments';
import storageRouter from './routes/platform/storage';

// --- PRODUCT MODULES ---
import agroRouter from './routes/products/agro';
import rwaRouter from './routes/products/rwa';
import postsRouter from './routes/products/posts';

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

// 1.1 CORS
app.use('/*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'http://localhost:8082', 'http://localhost:3000', 'http://127.0.0.1:8082',
      'https://asppibra.com', 'https://www.asppibra.com', 'https://api.asppibra.com'
    ];
    if (origin && (origin.includes('localhost') || origin.includes('cloudworkstations.dev'))) return origin;
    if (allowedOrigins.includes(origin)) return origin;
    return origin;
  },
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-admin-key'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// 1.2 Database Injection
app.use(async (c, next) => {
  try {
    const db = createDb(c.env.DB);
    c.set('db', db);
    await next();
  } catch (e) {
    return error(c, 'Erro interno ao conectar no banco de dados', null, 500);
  }
});

// 1.3 Audit & Telemetry (PRODUÇÃO)
app.use('*', async (c, next) => {
  const start = Date.now();
  
  await next(); 

  const path = c.req.path;
  if (!path.match(/\.(css|js|png|jpg|ico|json|map)$/) && !path.startsWith('/monitoring')) {
    const audit = new AuditService(c.env);
    const executionTime = Date.now() - start;

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
          executionTimeMs: executionTime
        },
        metrics: {
          dbReads: c.req.method === 'GET' ? 1 : 0,
          dbWrites: ['POST', 'PUT', 'DELETE'].includes(c.req.method) ? 1 : 0,
          bytesOut: parseInt(c.res.headers.get("content-length") || "0")
        }
      })
    );
  }
});

// =================================================================
// 2. ROTAS DE DASHBOARD E MONITORAMENTO
// =================================================================

app.get('/', (c) => {
  const url = new URL(c.req.url);
  const isLocal = url.hostname.includes('localhost') || url.hostname.includes('127.0.0.1');
  const domain = isLocal ? url.origin : "https://api.asppibra.com";
  const imageUrl = `${domain}/img/social-preview.png`;

  const audit = new AuditService(c.env);
  c.executionCtx.waitUntil(audit.log({
    action: "DASHBOARD_VIEW",
    ip: c.req.header("cf-connecting-ip") || "unknown",
    country: c.req.header("cf-ipcountry") || "XX",
    status: "success"
  }));

  return c.html(DashboardTemplate({
    version: "1.1.0",
    service: "Central System API",
    cacheRatio: "98.5%",
    domain: domain,
    imageUrl: imageUrl
  }));
});

app.get('/api/stats', async (c) => {
  const audit = new AuditService(c.env);
  const metrics = await audit.getDashboardMetrics();
  return c.json(metrics);
});

app.get('/monitoring', (c) => c.redirect('/api/health'));

// =================================================================
// 3. API & ROTAS MODULARES
// =================================================================

app.route('/api/auth', authRouter);
app.route('/api/auth', sessionRouter);
app.route('/api/health', healthRouter);
app.route('/api/webhooks', webhooksRouter);

app.route('/api/payments', paymentsRouter);
app.route('/api/storage', storageRouter);

app.route('/api/agro', agroRouter);
app.route('/api/rwa', rwaRouter);
app.route('/api/posts', postsRouter);

// =================================================================
// 4. ARQUIVOS ESTÁTICOS
// =================================================================
app.get('/*', async (c) => {
  try {
    if (new URL(c.req.url).pathname === '/') return c.notFound();
    return await c.env.ASSETS.fetch(c.req.raw as any);
  } catch (e) {
    return c.notFound();
  }
});

// =================================================================
// 5. ERROS & ENTRY POINT
// =================================================================
app.notFound((c) => c.json({ success: false, message: 'Rota não encontrada (404)' }, 404));

app.onError((err, c) => {
  console.error('🔥 Erro Interno:', err);
  return c.json({ success: false, message: 'Erro Interno do Servidor' }, 500);
});

export default {
  fetch: app.fetch,
  // CRON JOB AUTOMÁTICO (A cada 5 minutos)
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(updateTokenPrice(env));
  },
};

/**
 * Função Worker que roda em background para manter o preço atualizado
 * Usa o serviço Moralis com contratos reais ($ASPPBR)
 */
async function updateTokenPrice(env: Bindings) {
  try {
    // Chama o serviço que configuramos no src/services/market.ts
    const data = await getTokenMarketData(env);

    if (data && env.KV_CACHE) {
      // 1. Salva o Objeto Completo (Preço, Liquidez, MarketCap)
      // Útil se você quiser mostrar mais detalhes no futuro
      await env.KV_CACHE.put("market:data", JSON.stringify(data));
      
      // 2. Salva o Preço isolado (Para leitura rápida do Dashboard atual)
      await env.KV_CACHE.put("market:price_usd", data.price.toString());
      
      console.log(`✅ Cron: Mercado atualizado via Moralis. Preço: $${data.price}`);
    } else {
      console.warn("⚠️ Cron: Falha ao obter dados da Moralis (Retorno vazio)");
    }
  } catch (error) {
    console.error("❌ Cron: Erro crítico na atualização de mercado", error);
  }
}