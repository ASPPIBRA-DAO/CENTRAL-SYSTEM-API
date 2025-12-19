/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API & Identity Provider
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { verify } from 'hono/jwt';
import { eq } from 'drizzle-orm';
import { users, audit_logs } from '../../../db/schema';
import { signUpSchema, loginSchema } from '../../../validators/auth';
import { AuthService } from '../../../services/auth';
import { Database } from '../../../db';

// Tipagem para os Bindings do Cloudflare e Variáveis do Hono
type Bindings = { JWT_SECRET: string; DB: D1Database };
type Variables = { db: Database };

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ----------------------------------------------------------------------
// Rota de REGISTRO (Sign-Up)
// ----------------------------------------------------------------------
auth.post('/sign-up', zValidator('json', signUpSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  try {
    // 1. Verificar se o email já existe
    const [existingUser] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existingUser) return c.json({ error: 'Este email já está em uso' }, 409);

    // 2. Criar Hash da senha
    const passwordHash = await AuthService.hashPassword(body.password);

    // 3. Inserir novo usuário (Usando 'citizen' como default do seu schema)
    const [newUser] = await db.insert(users).values({
      email: body.email,
      password: passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      role: 'citizen',
    }).returning();

    // 4. Gerar Token
    const accessToken = await AuthService.generateToken(newUser, c.env.JWT_SECRET);

    return c.json({
      accessToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: `${newUser.firstName} ${newUser.lastName}`,
        role: newUser.role
      }
    }, 201);

  } catch (error) {
    console.error('Erro no registro:', error);
    return c.json({ error: 'Erro ao criar conta institucional' }, 500);
  }
});

// ----------------------------------------------------------------------
// Rota de LOGIN (Sign-In)
// ----------------------------------------------------------------------
auth.post('/sign-in', zValidator('json', loginSchema), async (c) => {
  const db = c.get('db');
  const { email, password } = c.req.valid('json');

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !(await AuthService.comparePassword(password, user.password))) {
      return c.json({ error: 'Credenciais inválidas' }, 401);
    }

    const accessToken = await AuthService.generateToken(user, c.env.JWT_SECRET);

    // 🛡️ AUDITORIA (Conforme seu schema de logs)
    await db.insert(audit_logs).values({
      actorId: String(user.id),
      action: 'login',
      resource: 'auth/session',
      status: 'success',
      ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
      userAgent: c.req.header('user-agent'),
    });

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: `${user.firstName} ${user.lastName}`,
        role: user.role
      }
    });

  } catch (error) {
    return c.json({ error: 'Falha na autenticação' }, 500);
  }
});

// ----------------------------------------------------------------------
// Rota ME (Perfil atual)
// ----------------------------------------------------------------------
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Não autorizado' }, 401);

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    const db = c.get('db');
    
    const [user] = await db.select().from(users).where(eq(users.id, Number(payload.userId))).limit(1);

    if (!user) return c.json({ error: 'Usuário inexistente' }, 401);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        aal_level: user.aal_level
      }
    });
  } catch (e) {
    return c.json({ error: 'Sessão expirada' }, 401);
  }
});

export default auth;