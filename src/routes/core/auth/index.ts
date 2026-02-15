/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Routes (Register, Login, Identity)
 * Version: 1.2.2 - Bugfix (sql import) & Security Patched
 */

import { Hono } from 'hono';
import { eq, sql, and, isNull } from 'drizzle-orm'; // 🟢 CORREÇÃO: Importações essenciais para queries
import { sign } from 'hono/jwt';
import { users, auditLogs } from '../../../db/schema'; 
import { success, error } from '../../../utils/response';
import { hashPassword, comparePassword } from '../../../services/auth';
import { Bindings } from '../../../types/bindings';
import { Database } from '../../../db'; // Tipagem forte do Database Factory
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// --- SCHEMAS DE VALIDAÇÃO (ZOD) ---
const registerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
  firstName: z.string().min(2, 'Nome muito curto'),
  lastName: z.string().min(2, 'Sobrenome muito curto')
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

const auth = new Hono<{ Bindings: Bindings }>();

// ======================================================================
// 1. REGISTRO (SIGN UP)
// ======================================================================
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  // Cast para Database para garantir Autocomplete e segurança de tipos
  const db = c.get('db' as any) as Database; 
  const { email, password, firstName, lastName } = c.req.valid('json');

  try {
    // 1.1 Verificação de existência (Prevenção de e-mails duplicados)
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      return error(c, 'Este e-mail já está cadastrado no sistema ASPPIBRA', null, 400);
    }

    // 1.2 Criptografia de Credenciais
    const hashedPassword = await hashPassword(password);
    
    // Inserção no banco D1
    const newUser = await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'citizen',
    }).returning().get();

    // 1.3 Segurança: Remove o hash da senha do objeto de retorno
    const { password: _, ...userSafe } = newUser;

    // 1.4 Auditoria Forense em background (Não bloqueia o fluxo principal)
    c.executionCtx.waitUntil(
      db.insert(auditLogs).values({
        action: 'USER_REGISTER',
        actorId: newUser.id,
        status: 'success',
        ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
        userAgent: c.req.header('user-agent'),
        metadata: { email: newUser.email }
      })
    );

    // 1.5 Emissão de Token de Acesso (JWT)
    const token = await sign({ 
      id: newUser.id, 
      role: newUser.role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) 
    }, c.env.JWT_SECRET);

    return success(c, 'Conta criada com sucesso', { accessToken: token, user: userSafe }, 201);
  } catch (e: any) {
    console.error("🔥 Registro Error:", e.message);
    return error(c, 'Falha interna ao processar registro', e.message, 500);
  }
});

// ======================================================================
// 2. LOGIN (SIGN IN)
// ======================================================================
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const db = c.get('db' as any) as Database;
  const { email, password } = c.req.valid('json');

  try {
    // 2.1 Busca ativa: Filtra por e-mail e garante que o usuário não foi "deletado" (Soft Delete)
    const user = await db.select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          isNull(users.deletedAt)
        )
      )
      .get();

    // 2.2 Verificação de credenciais
    if (!user || !(await comparePassword(password, user.password))) {
      return error(c, 'Credenciais inválidas ou conta inativa', null, 401);
    }

    // 2.3 Atualização de Metadata e Auditoria (Async)
    c.executionCtx.waitUntil(
      Promise.all([
        db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)),
        db.insert(auditLogs).values({
          action: 'USER_LOGIN',
          actorId: user.id,
          ipAddress: c.req.header('cf-connecting-ip'),
          userAgent: c.req.header('user-agent'),
          status: 'success'
        })
      ])
    );

    // 2.4 Geração de Token
    const token = await sign({ 
      id: user.id, 
      role: user.role, 
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) 
    }, c.env.JWT_SECRET);
    
    // Remove a senha antes de enviar a resposta
    const { password: _, ...userSafe } = user;
    
    return success(c, 'Bem-vindo ao ASPPIBRA DAO', { accessToken: token, user: userSafe });
  } catch (e: any) {
    return error(c, 'Erro no processamento de autenticação', e.message, 500);
  }
});

// ======================================================================
// 3. IDENTIDADE (ME)
// ======================================================================
auth.get('/me', async (c) => {
  // Recuperado via middleware de verificação JWT
  const payload = c.get('jwtPayload' as any); 
  const db = c.get('db' as any) as Database;

  try {
    // Uso da Query API do Drizzle para facilitar a exclusão de colunas
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, payload.id),
        isNull(users.deletedAt)
      ),
      columns: { password: false } // 🟢 Segurança: Nunca traz a senha do DB
    });

    if (!user) return error(c, 'Usuário não localizado ou desativado', null, 404);

    return success(c, 'Sessão válida', { user });
  } catch (e: any) {
    return error(c, 'Erro ao validar identidade', e.message, 500);
  }
});

export default auth;