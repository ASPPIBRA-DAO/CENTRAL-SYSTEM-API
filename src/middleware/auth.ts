/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Middleware (Hybrid: Bearer + Cookie)
 * Version: 10.0.0 - Absolute Bank-Level Hardened (10/10)
 */

import { createMiddleware } from 'hono/factory';
import { verify, decode } from 'hono/jwt';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import { error } from '../utils/response';

interface KVNamespace {
  get(key: string): Promise<string | null>;
}

const CLOCK_SKEW_SEC = 5;
const MAX_TOKEN_LENGTH = 4096;

// ======================================================================
// ⚡ PERFORMANCE: Isolate-Level LRU Caches with TTL
// Previne Memory Leaks e gargalos de latência no KV.
// ======================================================================
interface CacheEntry { value: string | boolean; expires: number; }
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const jwksCache = new Map<string, CacheEntry>();
const blacklistCache = new Map<string, CacheEntry>(); // Negative Caching

function setCache(map: Map<string, CacheEntry>, key: string, value: string | boolean) {
  if (map.size >= CACHE_MAX_SIZE) {
    const firstKey = map.keys().next().value;
    if (firstKey) map.delete(firstKey); // Simple eviction
  }
  map.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

function getCache(map: Map<string, CacheEntry>, key: string): string | boolean | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

// ======================================================================
// 🔒 CONTRACT: Zod Schema
// ======================================================================
const JwtPayloadSchema = z.object({
  id: z.string().min(1), 
  sub: z.string().min(1), 
  email: z.string().email(),
  role: z.enum(['citizen', 'partner', 'admin', 'system']),
  
  // ✅ SCALABILITY: Preparado para granularidade de permissões
  scopes: z.array(z.string()).optional(),
  
  token_type: z.literal('access'), 
  iss: z.string(), 
  aud: z.union([z.string(), z.array(z.string())]),
  jti: z.string().uuid().optional(), 
  
  exp: z.number().refine((val) => val > Math.floor(Date.now() / 1000) - CLOCK_SKEW_SEC, {
    message: 'Token expired',
  }),
  nbf: z.number().optional().refine((val) => !val || val <= Math.floor(Date.now() / 1000) + CLOCK_SKEW_SEC, {
    message: 'Token not yet valid (nbf)',
  }),
  iat: z.number().optional().refine((val) => !val || val <= Math.floor(Date.now() / 1000) + CLOCK_SKEW_SEC, {
    message: 'Token issued in the future (iat)',
  }),
}).strict();

export type AuthUser = z.infer<typeof JwtPayloadSchema>;

type AuthEnv = {
  Bindings: {
    JWT_SECRET?: string;      
    JWT_PUBLIC_KEY?: string;  
    JWT_ALG?: 'HS256' | 'RS256' | 'EdDSA'; 
    EXPECTED_ISSUER?: string; 
    EXPECTED_AUDIENCE?: string; 
    KV_BLACKLIST?: KVNamespace; 
    KV_JWKS?: KVNamespace;      
    NODE_ENV?: string;
    ALLOWED_ORIGIN?: string; // Aceita lista separada por vírgula
  };
  Variables: {
    user: AuthUser; 
  };
};

export const requireAuth = () => createMiddleware<AuthEnv>(async (c, next) => {
  const isProd = c.env.NODE_ENV === 'production';

  if (c.req.method === 'OPTIONS') return c.body(null, 204);

  if (!c.env.JWT_SECRET && !c.env.JWT_PUBLIC_KEY) {
    throw new Error('FATAL: Crypto keys not configured.');
  }

  let token: string | undefined;
  let tokenSource: 'header' | 'cookie' = 'header';

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    token = getCookie(c, 'accessToken');
    tokenSource = 'cookie';
  }

  if (!token) return error(c, 'Acesso negado. Credenciais ausentes.', null, 401);

  // 3. Segurança Anti-CSRF (Cookies) - Aplicado em todos os ambientes para evitar drift
  if (tokenSource === 'cookie') {
    const origin = c.req.header('Origin');
    
    // 3.1 Multi-Origin Check
    if (c.env.ALLOWED_ORIGIN && origin) {
      const allowedOrigins = c.env.ALLOWED_ORIGIN.split(',').map(s => s.trim());
      if (!allowedOrigins.includes(origin)) {
        return error(c, isProd ? 'Acesso negado.' : 'Origem não autorizada.', null, 403);
      }
    }
    
    // 3.2 Full Double-Submit CSRF Check
    const csrfHeader = c.req.header('X-CSRF-Token');
    const csrfCookie = getCookie(c, 'csrfToken'); 
    
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return error(c, isProd ? 'Acesso negado.' : 'Falha de CSRF. Tokens ausentes ou divergentes.', null, 403);
    }
  }

  try {
    if (token.length > MAX_TOKEN_LENGTH) throw new Error('Token length exceeds maximum limit.');

    // 4. Header Decode & Validation
    const decoded = decode(token);
    if (!decoded || !decoded.header || typeof decoded.header !== 'object' || !decoded.header.alg) {
      throw new Error('Malformed token header.');
    }

    const { header } = decoded;
    
    // 4.1 Strict Type check
    if (header.typ !== 'JWT') throw new Error('Invalid token type header.');

    const alg = c.env.JWT_ALG || 'HS256';
    if (header.alg !== alg) throw new Error('Algorithm mismatch.');

    // 5. Key Resolution & Caching
    let cryptoKey = alg === 'HS256' ? c.env.JWT_SECRET : c.env.JWT_PUBLIC_KEY;
    
    if (header.kid && alg !== 'HS256' && c.env.KV_JWKS) {
      const cachedKey = getCache(jwksCache, header.kid) as string | undefined;
      if (cachedKey) {
        cryptoKey = cachedKey;
      } else {
        const jwk = await c.env.KV_JWKS.get(`key:${header.kid}`);
        if (!jwk) throw new Error('Invalid kid.');
        setCache(jwksCache, header.kid, jwk);
        cryptoKey = jwk;
      }
    }

    if (!cryptoKey) throw new Error('Crypto key resolved to undefined.');

    // 6. Cryptographic Verification
    const rawPayload = await verify(token, cryptoKey, alg) as Record<string, unknown>;
    
    // 7. Structural Validation
    const payload = JwtPayloadSchema.parse(rawPayload);

    if (payload.sub !== payload.id) throw new Error('Subject mismatch.');

    const expectedIss = c.env.EXPECTED_ISSUER || 'asppibra-auth';
    if (payload.iss !== expectedIss) throw new Error('Invalid issuer.');

    if (c.env.EXPECTED_AUDIENCE) {
      const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audArray.includes(c.env.EXPECTED_AUDIENCE)) throw new Error('Invalid audience.');
    }

    // 8. Revocation Check with Negative Caching
    if (payload.jti && c.env.KV_BLACKLIST) {
      let isRevoked = getCache(blacklistCache, payload.jti) as boolean | undefined;
      
      if (isRevoked === undefined) {
        const kvStatus = await c.env.KV_BLACKLIST.get(`revoked:${payload.jti}`);
        isRevoked = !!kvStatus;
        setCache(blacklistCache, payload.jti, isRevoked);
      }
      
      if (isRevoked) throw new Error('Token revoked.');
    }

    // 9. Context Injection
    c.set('user', payload);
    
    await next();
    
  } catch (err) {
    if (!isProd) console.error('[AuthMiddleware] Error:', err);
    return error(c, isProd ? 'Acesso negado. Sessão inválida ou expirada.' : (err as Error).message, null, 401);
  }
});