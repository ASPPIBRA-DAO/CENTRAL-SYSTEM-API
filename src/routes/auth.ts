import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt'; // ✅ Adicionado 'verify' para validar o token
import { compare, hash } from 'bcryptjs';
import { Database } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Definimos o que esperar do Contexto
type Variables = {
  db: Database;
};

type Bindings = {
  JWT_SECRET: string;
};

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ----------------------------------------------------------------------
// Rota de LOGIN
// ----------------------------------------------------------------------
auth.post('/sign-in', async (c) => {
  try {
    const db = c.get('db');
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email e senha são obrigatórios' }, 400);
    }

    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];

    if (!user) {
      return c.json({ error: 'Credenciais inválidas' }, 401);
    }

    const isValid = await compare(password, user.password);

    if (!isValid) {
      return c.json({ error: 'Credenciais inválidas' }, 401);
    }

    const accessToken = await sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'user',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 dias
      },
      c.env.JWT_SECRET
    );

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: `${user.firstName} ${user.lastName}`,
        photoURL: null,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return c.json({ error: 'Erro interno no servidor' }, 500);
  }
});

// ----------------------------------------------------------------------
// Rota de REGISTRO
// ----------------------------------------------------------------------
auth.post('/sign-up', async (c) => {
  try {
    const db = c.get('db');
    // Adicionei validação de campos obrigatórios aqui
    const { email, password, firstName, lastName } = await c.req.json();

    if (!email || !password || !firstName || !lastName) {
      return c.json({ error: 'Todos os campos são obrigatórios' }, 400);
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return c.json({ error: 'Este email já está em uso' }, 409);
    }

    const passwordHash = await hash(password, 10);

    const newUser = await db.insert(users).values({
      email,
      password: passwordHash,
      firstName,
      lastName,
      role: 'user', // Garante que tem role
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    const user = newUser[0];

    const accessToken = await sign(
      { userId: user.id, email: user.email, role: 'user', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
      c.env.JWT_SECRET
    );

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: `${user.firstName} ${user.lastName}`,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    return c.json({ error: 'Erro ao criar conta' }, 500);
  }
});

// ----------------------------------------------------------------------
// 🆕 Rota ME (Recuperar Sessão) - ESSENCIAL PARA O FRONTEND
// ----------------------------------------------------------------------
auth.get('/me', async (c) => {
  const header = c.req.header('Authorization');

  if (!header) {
    return c.json({ error: 'Token não fornecido' }, 401);
  }

  const token = header.split(' ')[1]; // Remove "Bearer "

  try {
    // 1. Valida o Token
    const payload = await verify(token, c.env.JWT_SECRET);

    // 2. Busca o usuário no banco para ter dados atualizados
    const db = c.get('db');
    // payload.userId precisa ser tratado como número se seu ID no banco for number
    const result = await db.select().from(users).where(eq(users.id, Number(payload.userId))).limit(1);
    const user = result[0];

    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 401);
    }

    // 3. Retorna o objeto user formatado
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: `${user.firstName} ${user.lastName}`,
        photoURL: null,
        role: user.role || 'user'
      }
    });

  } catch (error) {
    console.error('Erro ao validar token:', error);
    return c.json({ error: 'Token inválido' }, 401);
  }
});

export default auth;