/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Routes (Register, Login, Identity)
 * Version: 1.3.1 - Production Ready (Type-Safe & Audit Fix)
 */

import { Hono } from 'hono';
import { eq, and, isNull } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import { users, auditLogs } from '../../../db/schema'; 
import { success, error } from '../../../utils/response';
import { hashPassword, comparePassword } from '../../../services/auth';
import { Bindings } from '../../../types/bindings';
import { Database } from '../../../db'; 
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// --- SCHEMAS DE VALIDAÇÃO (ZOD) ---
// Sanitização rigorosa para evitar falhas de entrada do usuário
const registerSchema = z.object({
  email: z.string().email('E-mail inválido').trim().toLowerCase(),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
  firstName: z.string().min(2, 'Nome muito curto').trim(),
  lastName: z.string().min(2, 'Sobrenome muito curto').trim()
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido').trim().toLowerCase(),
  password: z.string().min(1, 'Senha é obrigatória')
});

// Definição de variáveis de contexto para garantir tipagem forte (Removido 'any')
type Variables = {
  db: Database;
  jwtPayload: {
    id: number;
    role: string;
    exp: number;
  };
};

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ======================================================================
// 1. REGISTRO (SIGN UP)
// ======================================================================
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const db = c.get('db'); 
  const { email, password, firstName, lastName } = c.req.valid('json');

  try {
    // 1.1 Verificação de existência (Prevenção de e-mails duplicados)
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return error(c, 'Este e-mail já está cadastrado no ecossistema ASPPIBRA', null, 400);
    }

    // 1.2 Criptografia de Credenciais
    const hashedPassword = await hashPassword(password);
    
    // 1.3 Persistência no D1/Postgres
    const newUser = await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'citizen',
    }).returning().get();

    // 1.4 Higienização de Saída
    const { password: _, ...userSafe } = newUser;

    // 1.5 Auditoria Forense Assíncrona
    // 🟢 FIX: Convertendo ID para String para evitar erro de Type Mismatch no Drizzle
    c.executionCtx.waitUntil(
      db.insert(auditLogs).values({
        action: 'USER_REGISTER',
        actorId: String(newUser.id), 
        status: 'success',
        ipAddress: c.req.header('cf-connecting-ip') || 'remote',
        userAgent: c.req.header('user-agent') || 'unknown',
        metadata: { method: 'email_registration' }
      })
    );

    // 1.6 Emissão de Token JWT
    const token = await sign({ 
      id: newUser.id, 
      role: newUser.role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) 
    }, c.env.JWT_SECRET);

    return success(c, 'Conta DAO criada com sucesso', { accessToken: token, user: userSafe }, 201);
  } catch (e: any) {
    return error(c, 'Falha interna ao processar registro', e.message, 500);
  }
});

// ======================================================================
// 2. LOGIN (SIGN IN)
// ======================================================================
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const db = c.get('db');
  const { email, password } = c.req.valid('json');

  try {
    // 2.1 Busca ativa com verificação de Soft Delete
    const user = await db.select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .get();

    // 2.2 Validação de Hash de Senha
    if (!user || !(await comparePassword(password, user.password))) {
      return error(c, 'Credenciais inválidas ou conta inativa', null, 401);
    }

    // 2.3 Atualização de Metadata e Auditoria
    // 🟢 FIX: Garantindo actorId como String para compatibilidade de Schema
    c.executionCtx.waitUntil(
      Promise.all([
        db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)),
        db.insert(auditLogs).values({
          action: 'USER_LOGIN',
          actorId: String(user.id),
          ipAddress: c.req.header('cf-connecting-ip') || 'remote',
          userAgent: c.req.header('user-agent') || 'unknown',
          status: 'success'
        })
      ])
    );

    // 2.4 Geração de Token usando a Secret protegida
    const token = await sign({ 
      id: user.id, 
      role: user.role, 
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) 
    }, c.env.JWT_SECRET);
    
    const { password: _, ...userSafe } = user;
    
    return success(c, 'Bem-vindo de volta à ASPPIBRA', { accessToken: token, user: userSafe });
  } catch (e: any) {
    return error(c, 'Erro no processamento de autenticação', e.message, 500);
  }
});

// ======================================================================
// 3. IDENTIDADE (ME)
// ======================================================================
auth.get('/me', async (c) => {
  const payload = c.get('jwtPayload'); 
  const db = c.get('db');

  try {
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, payload.id),
        isNull(users.deletedAt)
      ),
      columns: { password: false } 
    });

    if (!user) return error(c, 'Usuário não localizado ou sessão expirada', null, 404);

    return success(c, 'Sessão validada', { user });
  } catch (e: any) {
    return error(c, 'Erro ao validar identidade', e.message, 500);
  }
});

export default auth;