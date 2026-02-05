import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { users, auditLogs } from '../../../db/schema'; 
import { success, error } from '../../../utils/response';
import { hashPassword, comparePassword } from '../../../services/auth';
import { Bindings } from '../../../types/bindings';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// Schema de validação para garantir que o body venha correto
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string(),
  lastName: z.string()
});

const auth = new Hono<{ Bindings: Bindings }>();

// ==========================================
// 1. REGISTRO (SIGN UP) - UNIFICADO
// ==========================================
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const db = c.get('db' as any);
  const { email, password, firstName, lastName } = c.req.valid('json');

  try {
    // 1.1 Verifica se o usuário já existe
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return error(c, 'Este e-mail já está cadastrado', null, 400);
    }

    // 1.2 Hash da senha e inserção
    const hashedPassword = await hashPassword(password);
    
    const newUser = await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'citizen',
    }).returning().get();

    // 1.3 Log de Auditoria (Usando o nome correto: auditLogs)
    c.executionCtx.waitUntil(
      db.insert(auditLogs).values({
        action: 'USER_REGISTER',
        actorId: newUser.id,
        status: 'success',
        ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
        metadata: { email: newUser.email }
      })
    );

    // 1.4 Gera token
    const token = await sign({ 
      id: newUser.id, 
      role: newUser.role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) 
    }, c.env.JWT_SECRET);

    return success(c, 'Conta criada com sucesso', { accessToken: token, user: newUser }, 201);
  } catch (e: any) {
    console.error("🔥 Erro no Registro:", e);
    return error(c, 'Erro ao criar conta', e.message, 500);
  }
});

// [Mantenha as rotas de LOGIN e ME abaixo como estão...]
auth.post('/login', async (c) => { /* seu código atual */ });
auth.get('/me', async (c) => { /* seu código atual */ });

export default auth;