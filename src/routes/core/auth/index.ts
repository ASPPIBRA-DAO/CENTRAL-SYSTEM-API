import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { users, audit_logs } from '../../../db/schema';
import { signUpSchema, loginSchema } from '../../../validators/auth';
import { AuthService } from '../../../services/auth';
import { Database } from '../../../db';

type Bindings = { JWT_SECRET: string; DB: D1Database };
type Variables = { db: Database };

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ----------------------------------------------------------------------
// Rota de REGISTRO
// ----------------------------------------------------------------------
auth.post('/register', zValidator('json', signUpSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  try {
    const [existingUser] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    
    // Ajustado para 'message' para o toast do Frontend capturar
    if (existingUser) return c.json({ message: 'Este email já está em uso' }, 409);

    const passwordHash = await AuthService.hashPassword(body.password);

    const [newUser] = await db.insert(users).values({
      email: body.email,
      password: passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      role: 'citizen',
    }).returning();

    const accessToken = await AuthService.generateToken(newUser, c.env.JWT_SECRET);

    return c.json({
      accessToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: `${newUser.firstName} ${newUser.lastName}`,
        role: newUser.role,
        photoURL: null
      }
    }, 201);
  } catch (error) {
    return c.json({ message: 'Erro ao criar conta institucional' }, 500);
  }
});

// ----------------------------------------------------------------------
// Rota de LOGIN
// ----------------------------------------------------------------------
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const db = c.get('db');
  const { email, password } = c.req.valid('json');

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !(await AuthService.comparePassword(password, user.password))) {
      return c.json({ message: 'E-mail ou senha incorretos' }, 401);
    }

    const accessToken = await AuthService.generateToken(user, c.env.JWT_SECRET);

    c.executionCtx.waitUntil(
      db.insert(audit_logs).values({
        actorId: String(user.id),
        action: 'login',
        resource: 'auth/session',
        status: 'success',
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        userAgent: c.req.header('user-agent'),
      })
    );

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        photoURL: null
      }
    });
  } catch (error) {
    return c.json({ message: 'Falha na autenticação servidor' }, 500);
  }
});

// ----------------------------------------------------------------------
// Rota /ME (Persistência de Sessão)
// ----------------------------------------------------------------------
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ message: 'Não autorizado' }, 401);

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    const db = c.get('db');
    const [user] = await db.select().from(users).where(eq(users.id, Number(payload.userId))).limit(1);

    if (!user) return c.json({ message: 'Usuário inexistente' }, 401);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        photoURL: null
      }
    });
  } catch (e) {
    return c.json({ message: 'Sessão expirada' }, 401);
  }
});

export default auth;