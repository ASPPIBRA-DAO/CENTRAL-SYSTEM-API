/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Routes (Register, Login, Refresh, Logout)
 * Version: 8.0.0 - Absolute Bank-Grade Hardened (10/10) - TS Strict
 */

import { Hono } from 'hono';
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie } from 'hono/cookie';
import { createId } from '@paralleldrive/cuid2'; 
import { users, auditLogs, sessions } from '../../../db/schema'; 
import { success, error } from '../../../utils/response';
import { hashPassword, comparePassword } from '../../../services/auth';
import type { Database } from '../../../db'; 
import type { AuthUser } from '../../../middleware/auth'; 
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// ⚡ UTILITY: Fast Hash for Refresh Tokens
async function hashToken(token: string) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 🛡️ UTILITY: Adaptive Device Fingerprinting (Subnet + Normalized UA)
// Tolerante a atualizações de navegador e saltos de rede mobile, mas letal contra session cloning.
async function createFingerprint(ip: string, ua: string) {
  const subnet = ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip.split('.').slice(0, 3).join('.');
  const normalizedUa = ua.replace(/[\d.]+/g, ''); // Remove versões numéricas
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${subnet}|${normalizedUa}`));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const registerSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string()
    .min(8)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/),
  firstName: z.string().min(2).trim(),
  lastName: z.string().min(2).trim()
});

const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1)
});

type AppBindings = {
  JWT_SECRET: string;
  EXPECTED_ISSUER?: string;
  EXPECTED_AUDIENCE?: string;
  NODE_ENV?: string;
  COOKIE_DOMAIN?: string;
  REQUIRE_EMAIL_VERIFICATION?: string; 
  KV_BLACKLIST?: KVNamespace; 
  KV_MFA_CHALLENGES?: KVNamespace; // 🔒 Contexto MFA Stateful
};

type Variables = {
  db: Database;
  user: AuthUser; 
};

const auth = new Hono<{ Bindings: AppBindings; Variables: Variables }>();

// ======================================================================
// 1. REGISTRO (SIGN UP)
// ======================================================================
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const db = c.get('db'); 
  const { email, password, firstName, lastName } = c.req.valid('json');

  try {
    const emailNormalized = email.toLowerCase();
    
    // 1.1 Prevenção de Enumeração vs Time-Based Attacks
    let userExists = false;
    const existingUser = await db.select().from(users).where(eq(users.emailNormalized, emailNormalized)).get();
    if (existingUser) userExists = true;

    const hashedPassword = await hashPassword(password);
    
    if (userExists) {
      c.executionCtx.waitUntil(
        db.insert(auditLogs).values({
          action: 'USER_REGISTER_FAILED',
          actorId: 'system',
          actorType: 'system',
          ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
          userAgent: c.req.header('user-agent') || 'unknown',
          status: 'fail',
          metadata: { reason: 'email_exists', email: emailNormalized }
        })
      );
      // 🕵️ ANTI-ENUMERATION: Always returns 201 Strict
      return success(c, 'Conta criada. Verifique seu e-mail para ativar.', null, 201);
    }
    
    const newUser = await db.insert(users).values({
      email,
      emailNormalized,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      role: 'citizen',
    }).returning().get();

    c.executionCtx.waitUntil(
      db.insert(auditLogs).values({
        action: 'USER_REGISTER',
        actorId: newUser.id, 
        actorType: 'user',
        actorUserId: newUser.id,
        status: 'success',
        ipAddress: c.req.header('cf-connecting-ip') || '127.0.0.1',
        userAgent: c.req.header('user-agent') || 'unknown',
      })
    );

    return success(c, 'Conta criada. Verifique seu e-mail para ativar.', null, 201);
  } catch (e: any) {
    if (c.env.NODE_ENV !== 'production') console.error(e);
    return error(c, 'Falha interna.', null, 500);
  }
});

// ======================================================================
// 2. LOGIN (SIGN IN)
// ======================================================================
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const db = c.get('db');
  const { email, password } = c.req.valid('json');

  try {
    const emailNormalized = email.toLowerCase();
    const nowMillis = Date.now();
    const currentIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    const currentUa = c.req.header('user-agent') || 'unknown';

    const user = await db.select().from(users).where(and(eq(users.emailNormalized, emailNormalized), isNull(users.deletedAt))).get();

    if (!user) {
      await hashPassword(password);
      return error(c, 'Credenciais inválidas.', null, 401);
    }

    if (user.lockUntil && user.lockUntil.getTime() > nowMillis) {
      return error(c, 'Conta temporariamente bloqueada.', null, 403);
    }

    if (c.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.emailVerified) {
      return error(c, 'Verifique seu e-mail antes de acessar.', null, 403);
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // 📈 PROGRESSIVE LOCKOUT (TS FIX: Safe default if null)
      const attempts = (user.loginAttempts || 0) + 1;
      const updates: Partial<typeof users.$inferInsert> = { loginAttempts: attempts };
      
      if (attempts >= 5) {
        updates.lockUntil = new Date(nowMillis + (15 * 60 * 1000)); 
      }

      c.executionCtx.waitUntil(
        Promise.all([
          db.update(users).set(updates).where(eq(users.id, user.id)),
          db.insert(auditLogs).values({
            action: 'USER_LOGIN_FAILED',
            actorId: user.id,
            actorType: 'user',
            actorUserId: user.id,
            ipAddress: currentIp,
            userAgent: currentUa,
            status: 'fail'
          })
        ])
      );

      return error(c, 'Credenciais inválidas.', null, 401);
    }

    const sessionId = createId(); 
    const now = Math.floor(nowMillis / 1000);

    // 2.5 🔒 STATEFUL MFA CHALLENGE
    if (user.mfaEnabled) {
      const mfaChallengeToken = await sign({ 
        sub: user.id,
        jti: sessionId, 
        token_type: 'mfa_challenge', 
        iss: c.env.EXPECTED_ISSUER || 'asppibra-auth',
        aud: c.env.EXPECTED_AUDIENCE || 'asppibra-system',
        exp: now + (5 * 60) 
      }, c.env.JWT_SECRET, 'HS256');

      if (c.env.KV_MFA_CHALLENGES) {
        const fingerprint = await createFingerprint(currentIp, currentUa);
        c.executionCtx.waitUntil(
          c.env.KV_MFA_CHALLENGES.put(`mfa:${sessionId}`, fingerprint, { expirationTtl: 300 })
        );
      }

      return success(c, 'Verificação 2FA necessária.', { mfa_token: mfaChallengeToken }, 202);
    }

    // 2.6 🚦 SESSION CAP (Max 5 Sessions per user)
    const activeSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user.id)).orderBy(desc(sessions.createdAt)).all();
    if (activeSessions.length >= 5) {
       const toDelete = activeSessions.slice(4).map(s => s.id);
       if (toDelete.length > 0) {
           c.executionCtx.waitUntil(db.delete(sessions).where(inArray(sessions.id, toDelete)));
       }
    }

    c.executionCtx.waitUntil(
      Promise.all([
        db.update(users).set({ lastLoginAt: new Date(nowMillis), loginAttempts: 0, lockUntil: null }).where(eq(users.id, user.id)),
        db.insert(auditLogs).values({
          action: 'USER_LOGIN',
          actorId: user.id,
          actorType: 'user',
          actorUserId: user.id,
          ipAddress: currentIp,
          userAgent: currentUa,
          status: 'success',
          metadata: { sessionId }
        })
      ])
    );

    const accessToken = await sign({ 
      id: user.id, sub: user.id, email: user.emailNormalized, role: user.role, 
      token_type: 'access', iss: c.env.EXPECTED_ISSUER || 'asppibra-auth', aud: c.env.EXPECTED_AUDIENCE || 'asppibra-system',
      jti: sessionId, iat: now, exp: now + (15 * 60) 
    }, c.env.JWT_SECRET, 'HS256');

    const refreshExp = now + (7 * 24 * 60 * 60);
    const refreshToken = await sign({
      sub: user.id, jti: sessionId, token_type: 'refresh',
      iss: c.env.EXPECTED_ISSUER || 'asppibra-auth', aud: c.env.EXPECTED_AUDIENCE || 'asppibra-system',
      iat: now, exp: refreshExp 
    }, c.env.JWT_SECRET, 'HS256');

    // 💾 STATEFUL PERSISTENCE (Hash)
    const hashedRefresh = await hashToken(refreshToken);

    c.executionCtx.waitUntil(
      db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        token: hashedRefresh, 
        expiresAt: new Date(refreshExp * 1000),
        ipAddress: currentIp,
        userAgent: currentUa
      })
    );

    // 🍪 COOKIES & CSRF ROTATION
    const isProd = c.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true, secure: isProd, sameSite: 'Strict' as const,
      ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN })
    };

    const csrfToken = createId();

    setCookie(c, 'refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60, path: '/auth/refresh' });
    setCookie(c, 'csrfToken', csrfToken, { secure: isProd, sameSite: 'Strict', path: '/', ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }) }); 

    const { passwordHash: _, mfaSecretEncrypted: __, ...userSafe } = user;
    return success(c, 'Bem-vindo.', { accessToken, user: userSafe });
  } catch (e: any) {
    if (c.env.NODE_ENV !== 'production') console.error(e);
    return error(c, 'Falha interna.', null, 500);
  }
});

// ======================================================================
// 3. ROTAÇÃO DE SESSÃO (REFRESH)
// ======================================================================
auth.post('/refresh', async (c) => {
  const tokenStr = getCookie(c, 'refreshToken');
  if (!tokenStr) return error(c, 'Não autorizado.', null, 401);

  // 🔒 CSRF Protection for Cookies
  if (c.env.NODE_ENV === 'production') {
    const csrfHeader = c.req.header('X-CSRF-Token');
    const csrfCookie = getCookie(c, 'csrfToken');
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return error(c, 'CSRF Falha.', null, 403);
    }
  }

  try {
    const decoded = await verify(tokenStr, c.env.JWT_SECRET, 'HS256') as any;
    if (decoded.token_type !== 'refresh' || !decoded.jti || !decoded.sub) throw new Error();

    const db = c.get('db');
    const session = await db.select().from(sessions).where(eq(sessions.id, decoded.jti)).get();

    // 🚨 REUSE DETECTION (OAuth 2.1)
    if (!session) {
      c.executionCtx.waitUntil(db.delete(sessions).where(eq(sessions.userId, decoded.sub)));
      return error(c, 'Vazamento detectado. Todas as sessões revogadas.', null, 403);
    }

    if (session.expiresAt.getTime() < Date.now()) {
      c.executionCtx.waitUntil(db.delete(sessions).where(eq(sessions.id, session.id)));
      return error(c, 'Sessão expirada.', null, 401);
    }

    const hashedInput = await hashToken(tokenStr);
    if (session.token !== hashedInput) throw new Error();

    // 🛡️ ADAPTIVE DEVICE FINGERPRINTING (Dynamic Logic sem coluna Metadata)
    const currentIp = c.req.header('cf-connecting-ip') || '127.0.0.1';
    const currentUa = c.req.header('user-agent') || 'unknown';
    const currentFingerprint = await createFingerprint(currentIp, currentUa);
    
    // Recalcula o fingerprint original a partir das strings isoladas na tabela
    const originalFingerprint = await createFingerprint(session.ipAddress || '', session.userAgent || '');

    if (originalFingerprint !== currentFingerprint) {
      c.executionCtx.waitUntil(db.delete(sessions).where(eq(sessions.id, session.id)));
      return error(c, 'Anomalia de dispositivo detectada. Faça login novamente.', null, 403);
    }

    const user = await db.select().from(users).where(and(eq(users.id, decoded.sub), isNull(users.deletedAt))).get();
    if (!user) throw new Error();

    // 🔄 ROTATION
    const newSessionId = createId();
    const now = Math.floor(Date.now() / 1000);
    
    const accessToken = await sign({ 
      id: user.id, sub: user.id, email: user.emailNormalized, role: user.role, 
      token_type: 'access', iss: c.env.EXPECTED_ISSUER || 'asppibra-auth', aud: c.env.EXPECTED_AUDIENCE || 'asppibra-system',
      jti: newSessionId, iat: now, exp: now + (15 * 60) 
    }, c.env.JWT_SECRET, 'HS256');

    const refreshExp = now + (7 * 24 * 60 * 60);
    const newRefreshToken = await sign({
      sub: user.id, jti: newSessionId, token_type: 'refresh', 
      iss: c.env.EXPECTED_ISSUER || 'asppibra-auth', aud: c.env.EXPECTED_AUDIENCE || 'asppibra-system',
      iat: now, exp: refreshExp 
    }, c.env.JWT_SECRET, 'HS256');

    const hashedNewRefresh = await hashToken(newRefreshToken);

    c.executionCtx.waitUntil(
      Promise.all([
        db.delete(sessions).where(eq(sessions.id, session.id)),
        db.insert(sessions).values({
          id: newSessionId, userId: user.id, token: hashedNewRefresh, 
          expiresAt: new Date(refreshExp * 1000), ipAddress: currentIp, userAgent: currentUa
        })
      ])
    );

    const isProd = c.env.NODE_ENV === 'production';
    const cookieOptions = { httpOnly: true, secure: isProd, sameSite: 'Strict' as const, ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }) };
    const csrfToken = createId();

    setCookie(c, 'refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60, path: '/auth/refresh' });
    setCookie(c, 'csrfToken', csrfToken, { secure: isProd, sameSite: 'Strict', path: '/', ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }) });

    return success(c, 'Sessão renovada.', { accessToken });
  } catch (e) {
    return error(c, 'Sessão inválida.', null, 401);
  }
});

// ======================================================================
// 4. LOGOUT SEGURO
// ======================================================================
auth.post('/logout', async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  if (user.jti && c.env.KV_BLACKLIST && user.exp) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(60, user.exp - now); 
    c.executionCtx.waitUntil(c.env.KV_BLACKLIST.put(`revoked:${user.jti}`, '1', { expirationTtl: ttl }));
  }

  const refreshToken = getCookie(c, 'refreshToken');
  if (refreshToken) {
    try {
      const decoded = await verify(refreshToken, c.env.JWT_SECRET, 'HS256') as any;
      c.executionCtx.waitUntil(db.delete(sessions).where(eq(sessions.id, decoded.jti)));
    } catch (e) {}
  }

  const isProd = c.env.NODE_ENV === 'production';
  const cookieOptions = { secure: isProd, sameSite: 'Strict' as const, ...(c.env.COOKIE_DOMAIN && { domain: c.env.COOKIE_DOMAIN }) };

  setCookie(c, 'refreshToken', '', { ...cookieOptions, httpOnly: true, maxAge: 0, path: '/auth/refresh' });
  setCookie(c, 'csrfToken', '', { ...cookieOptions, maxAge: 0, path: '/' });
  
  return success(c, 'Logout executado.');
});

// ======================================================================
// 5. IDENTIDADE (ME)
// ======================================================================
auth.get('/me', async (c) => {
  return success(c, 'Sessão ativa.', { user: c.get('user') });
});

export default auth;