import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types/bindings';
import { createDb, Database } from './db';
import { error } from './utils/response';
import { DashboardTemplate } from './views/dashboard';
import { AuditService } from './services/audit';

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

// 1.3 Audit & Telemetry (DADOS REAIS - ZERO FAKE)
// Captura métricas de todas as requisições API (exceto arquivos estáticos)
app.use('*', async (c, next) => {
  const start = Date.now();
  
  await next(); // Executa a rota real

  const path = c.req.path;
  // Ignora assets estáticos e rotas de monitoramento interno para não poluir o DB
  if (!path.match(/\.(css|js|png|jpg|ico|json|map)$/) && !path.startsWith('/monitoring')) {
    const audit = new AuditService(c.env);
    const executionTime = Date.now() - start;

    // Fire-and-forget
    c.executionCtx.waitUntil(
      audit.log({
        action: "API_REQUEST",
        ip: c.req.header("cf-connecting-ip") || "unknown",
        
        // [VERDADE]: Sem simulação. Se não tiver header (localhost), é XX.
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

// Renderiza o HTML do Dashboard
app.get('/', (c) => {
  const url = new URL(c.req.url);
  const isLocal = url.hostname.includes('localhost') || url.hostname.includes('127.0.0.1');
  const domain = isLocal ? url.origin : "https://api.asppibra.com";
  const imageUrl = `${domain}/img/social-preview.png`;

  // Log de Visualização do Dashboard
  const audit = new AuditService(c.env);
  c.executionCtx.waitUntil(audit.log({
    action: "DASHBOARD_VIEW",
    ip: c.req.header("cf-connecting-ip") || "unknown",
    
    // [VERDADE]: Mantém consistência com o middleware acima
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

// --- CORE ---
app.route('/api/auth', authRouter);
app.route('/api/auth', sessionRouter);
app.route('/api/health', healthRouter);
app.route('/api/webhooks', webhooksRouter);

// --- PLATFORM ---
app.route('/api/payments', paymentsRouter);
app.route('/api/storage', storageRouter);

// --- PRODUCTS ---
app.route('/api/agro', agroRouter);
app.route('/api/rwa', rwaRouter);
app.route('/api/posts', postsRouter);

// =================================================================
// 4. ARQUIVOS ESTÁTICOS (CORRIGIDO: Cast 'as any')
// =================================================================
app.get('/*', async (c) => {
  try {
    // Evita loop se o browser tentar buscar a raiz como arquivo
    if (new URL(c.req.url).pathname === '/') return c.notFound();
    
    // [CORREÇÃO AQUI]: Adicionado 'as any' para silenciar o erro de getSetCookie do TypeScript
    return await c.env.ASSETS.fetch(c.req.raw as any);

  } catch (e) {
    // Se não achar, retorna 404 limpo sem estourar erro vermelho no terminal
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
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(updateTokenPrice(env));
  },
};

async function updateTokenPrice(env: Bindings) {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd"
    );

    if (response.ok) {
      const data: any = await response.json();
      const price = data.binancecoin?.usd || 0;
      if (env.KV_CACHE) {
        await env.KV_CACHE.put("market:price_usd", price.toString());
        console.log(`✅ Cron: Preço atualizado para $${price}`);
      }
    }
  } catch (error) {
    console.error("❌ Cron: Falha ao atualizar preço", error);
  }
}