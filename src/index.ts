import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types/bindings';
import { createDb, Database } from './db';
import { error } from './utils/response';
import { DashboardTemplate } from './views/dashboard';

// --- MÓDULOS DA NOVA ARQUITETURA ---
import authRouter from './routes/api-modules/auth';
import usersRouter from './routes/api-modules/users';
import healthRouter from './routes/api-modules/health'; 
import rwaRouter from './routes/api-modules/rwa';
import agroRouter from './routes/api-modules/agro';
import paymentsRouter from './routes/api-modules/payments';
import ipfsRouter from './routes/api-modules/ipfs';
import webhooksRouter from './routes/api-modules/webhooks';

// Tipagem do Contexto
type Variables = {
  db: Database;
};

type AppType = {
  Bindings: Bindings;
  Variables: Variables;
};

const app = new Hono<AppType>();

// 1. Configuração de CORS
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

// 2. Middleware de Banco de Dados
app.use(async (c, next) => {
  try {
    const db = createDb(c.env.DB);
    c.set('db', db);
    await next();
  } catch (e) {
    return error(c, 'Erro interno ao conectar no banco de dados', null, 500);
  }
});

// 3. Dashboard (Rota Raiz)
app.get('/', (c) => {
  const url = new URL(c.req.url);
  
  // Lógica blindada: Se não for localhost, FORÇA o domínio de produção HTTPS
  // Isso evita que urls internas ou http quebrem a pré-visualização
  const isLocal = url.hostname.includes('localhost') || url.hostname.includes('127.0.0.1');
  const domain = isLocal ? url.origin : "https://api.asppibra.com";
  
  // URL absoluta garantida
  const imageUrl = `${domain}/social-preview.png`;

  return c.html(DashboardTemplate({
    version: "1.1.0",
    service: "Central System API",
    cacheRatio: "98.5%",
    domain: domain,
    imageUrl: imageUrl 
  }));
});

app.get('/monitoring', (c) => c.redirect('/api/health/analytics'));

// 5. ROTEAMENTO MODULAR
app.route('/api/auth', authRouter);
app.route('/api/users', usersRouter);
app.route('/api/health', healthRouter);
app.route('/api/rwa', rwaRouter);
app.route('/api/agro', agroRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/ipfs', ipfsRouter);
app.route('/api/webhooks', webhooksRouter);

// 6. Tratamento de Erros
app.notFound((c) => c.json({ success: false, message: 'Rota não encontrada (404)' }, 404));
app.onError((err, c) => {
  console.error('🔥 Erro Interno:', err);
  return c.json({ success: false, message: 'Erro Interno do Servidor' }, 500);
});

export default app;