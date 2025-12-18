import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types/bindings';
import { createDb, Database } from './db';
import { error } from './utils/response';
import { DashboardTemplate } from './views/dashboard';
import { AuditService } from './services/audit';
// Importa o serviço de mercado (Agora suporta modos 'full' e 'price_only')
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
  
  // CRON JOB AUTOMÁTICO (Configurado para rodar a cada 5 min no Wrangler)
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(updateTokenPrice(env));
  },
};

/**
 * Função de Atualização Híbrida (Smart Update)
 * - A cada 5 min: Atualiza apenas o PREÇO (Baixo custo API)
 * - A cada 1 hora: Atualiza GRÁFICO e LIQUIDEZ (Alto custo API)
 */
async function updateTokenPrice(env: Bindings) {
  try {
    const KV_KEY_DATA = "market:data";
    const KV_KEY_LAST_FULL = "market:last_full_sync";

    // 1. Verifica quando foi a última atualização COMPLETA
    const lastFullSyncStr = await env.KV_CACHE.get(KV_KEY_LAST_FULL);
    const lastFullSync = lastFullSyncStr ? parseInt(lastFullSyncStr) : 0;
    const now = Date.now();
    
    // Se passou mais de 1 hora (3600000 ms) ou nunca rodou, faz FULL update.
    const isFullUpdateNeeded = (now - lastFullSync) > 3600000;
    const mode = isFullUpdateNeeded ? 'full' : 'price_only';

    // 2. Chama o serviço da Moralis com o modo correto
    const newData = await getTokenMarketData(env, mode);

    if (!newData) {
      console.warn("⚠️ Cron: Falha ao obter dados da Moralis");
      return;
    }

    let finalData;

    if (mode === 'full') {
      // CENÁRIO A: Atualização Completa (Gráfico, Liq, Preço)
      // Substitui tudo e atualiza o timestamp da última sync completa
      finalData = newData;
      await env.KV_CACHE.put(KV_KEY_LAST_FULL, now.toString());
      console.log(`✅ Cron (FULL): Atualização completa (Gráfico 30d). Preço: $${newData.price}`);
    
    } else {
      // CENÁRIO B: Atualização Rápida (Apenas Preço)
      // Recupera o JSON antigo do Cache para manter o gráfico e liquidez
      const currentCacheRaw = await env.KV_CACHE.get(KV_KEY_DATA);
      const currentCache = currentCacheRaw ? JSON.parse(currentCacheRaw) : {};
      
      finalData = {
        ...currentCache,        // Mantém histórico, liq, mcap antigos
        price: newData.price,   // Atualiza preço novo
        change24h: newData.change24h,
        lastUpdated: new Date().toISOString()
      };
      console.log(`⚡ Cron (LITE): Apenas preço atualizado. Preço: $${newData.price}`);
    }

    // 3. Salva o resultado final no Cache
    if (env.KV_CACHE) {
      await env.KV_CACHE.put(KV_KEY_DATA, JSON.stringify(finalData));
      // Salva também o preço isolado para leituras rápidas
      await env.KV_CACHE.put("market:price_usd", finalData.price.toString());
    }

  } catch (error) {
    console.error("❌ Cron: Erro crítico na atualização de mercado", error);
  }
}