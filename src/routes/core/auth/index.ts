import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { users, auditLogs } from '../../../db/schema'; // ✅ CORREÇÃO: Usando auditLogs
import { success, error } from '../../../utils/response';
import { hashPassword, comparePassword } from '../../../services/auth';
import { Bindings } from '../../../types/bindings';

const auth = new Hono<{ Bindings: Bindings }>();

// ==========================================
// 1. REGISTRO (SIGN UP)
// ==========================================
auth.post('/register', async (c) => {
  const db = c.get('db' as any);
  const { email, password, firstName, lastName } = await c.req.json();

  try {
    // Verifica se o usuário já existe
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return error(c, 'Este e-mail já está cadastrado', null, 400);
    }

    // Hash da senha e inserção
    const hashedPassword = await hashPassword(password);
    
    const newUser = await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName, // ✅ Gravando o Nome
      lastName,  // ✅ Gravando o Sobrenome
      role: 'citizen',
    }).returning().get();

    // Log de Auditoria
    c.executionCtx.waitUntil(
      db.insert(auditLogs).values({
        action: 'USER_REGISTER',
        actorId: newUser.id.toString(),
        status: 'success',
        metadata: { email: newUser.email }
      })
    );

    // Gera token para já deixar logado após registro
    const token = await sign({ id: newUser.id, role: newUser.role }, c.env.JWT_SECRET);

    return success(c, 'Conta criada com sucesso', { accessToken: token, user: newUser });
  } catch (e: any) {
    return error(c, 'Erro ao criar conta', e.message, 500);
  }
});

// ==========================================
// 2. LOGIN (SIGN IN)
// ==========================================
auth.post('/login', async (c) => {
  const db = c.get('db' as any);
  const { email, password } = await c.req.json();

  try {
    const user = await db.select().from(users).where(eq(users.email, email)).get();

    if (!user || !(await comparePassword(password, user.password))) {
      return error(c, 'E-mail ou senha incorretos', null, 401);
    }

    const token = await sign(
      { 
        id: user.id, 
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24h
      }, 
      c.env.JWT_SECRET
    );

    return success(c, 'Bem-vindo de volta', { accessToken: token, user });
  } catch (e: any) {
    return error(c, 'Erro no processo de login', e.message, 500);
  }
});

// ==========================================
// 3. PERFIL (ME) - Usado pelo AuthProvider
// ==========================================
auth.get('/me', async (c) => {
  const db = c.get('db' as any);
  const payload = c.get('jwtPayload' as any); // Preenchido pelo middleware de auth

  if (!payload) return error(c, 'Não autorizado', null, 401);

  const user = await db.select().from(users).where(eq(users.id, payload.id)).get();
  
  if (!user) return error(c, 'Usuário não encontrado', null, 404);

  return success(c, 'Usuário carregado', { user });
});

export default auth;