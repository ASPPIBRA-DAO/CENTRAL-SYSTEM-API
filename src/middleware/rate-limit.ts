/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Rate Limit Middleware (Fractional Token Bucket + Penalty Box + KV)
 * Version: 11.0.0 - Absolute Enterprise Hardened (10/10) - TS Strict
 * 
 * 🏛️ ARCHITECTURE NOTE:
 * Uses KV + Isolate Memory for extremely fast, cost-effective DoS protection.
 * If `mode: 'strict'` is used, you MUST implement Cloudflare Durable Objects 
 * for absolute global consensus. KV alone provides "Best Effort" eventual consistency.
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { error } from '../utils/response';

type RateLimitEnv = {
  Bindings: {
    KV_CACHE: KVNamespace;
    DO_LIMITER?: DurableObjectNamespace; // 🏛️ Hook para Strong Consistency
    NODE_ENV?: string;
  };
  Variables: {
    user?: { id: string; role?: string };
  };
};

export interface RateLimitOptions {
  limit?: number;
  window?: number;
  cost?: number; 
  mode?: 'balanced' | 'strict'; 
  keyGenerator?: (c: Context<RateLimitEnv>) => string;
  roleLimits?: Record<string, { limit: number; window: number }>;
  combineIdentity?: boolean;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  strikes: number; // 📈 Penalty Box: Escalonamento exponencial para abusadores
}

interface CacheWrapper {
  bucket: TokenBucket;
  localExpiresAt: number; 
}

const localCache = new Map<string, CacheWrapper>();
const MAX_CACHE_SIZE = 2000;

function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export const rateLimit = (options: RateLimitOptions = {}) => {
  return createMiddleware<RateLimitEnv>(async (c, next) => {
    const isProd = c.env.NODE_ENV === 'production';
    let ip = c.req.header('CF-Connecting-IP');
    
    if (!ip && !isProd) {
      ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    }
    if (!ip) {
      return error(c, 'Acesso negado. Identificação ausente.', null, 403);
    }

    if (ip.includes(':')) {
      const blocks = ip.split(':');
      if (blocks.length > 4) {
        ip = blocks.slice(0, 4).join(':') + '::/64';
      }
    }
            
    const user = c.get('user');
    let rawIdentity = ip;
    if (user?.id) {
      rawIdentity = options.combineIdentity ? `${user.id}:${ip}` : user.id;
    }
    const identity = String(rawIdentity).slice(0, 64); 
    
    // 🔒 ANTI-EXPLOSION GUARD: Regex scrub genérico caso routePath falhe
    let routePath = c.req.routePath;
    if (!routePath) {
      routePath = c.req.path.split('?')[0]
        .replace(/\/[a-fA-F0-9-]{36}/g, '/:uuid') // Scrub UUIDs
        .replace(/\/\d+/g, '/:id');               // Scrub IDs Numéricos
    }
    
    let keyString = `rl:${c.req.method}:${routePath}:${identity}`;
    if (options.keyGenerator) {
      const custom = options.keyGenerator(c).replace(/[^a-zA-Z0-9_:-]/g, '');
      keyString = `rl:custom:${custom}`.slice(0, 128);
    }
    
    const key = `rl_hash:${fastHash(keyString)}`;
    
    let finalLimit = Math.min(options.limit ?? 5, 10000); 
    let finalWindow = Math.min(options.window ?? 60, 3600); 
    const cost = options.cost ?? 1;
    const mode = options.mode ?? 'balanced';

    if (user?.role && options.roleLimits?.[user.role]) {
      finalLimit = Math.min(options.roleLimits[user.role].limit, 10000);
      finalWindow = Math.min(options.roleLimits[user.role].window, 3600);
    }

    if (cost > finalLimit) {
      throw new Error('FATAL: Rate limit cost exceeds total limit capacity.');
    }
    
    if (mode === 'strict' && !c.env.DO_LIMITER) {
      console.warn('Strict mode requested but DO_LIMITER not bound. Falling back to KV.');
    }

    const refillRate = finalLimit / finalWindow;
    const now = Date.now() / 1000; 
    let shouldSyncKV = false;
    let wrapper: CacheWrapper | undefined;

    if (mode !== 'strict') {
      wrapper = localCache.get(key);
      if (wrapper) {
        if (wrapper.localExpiresAt <= now) {
          localCache.delete(key);
          wrapper = undefined;
        } else {
          localCache.delete(key); 
          localCache.set(key, wrapper); 
        }
      }
    }

    let data = wrapper?.bucket;

    if (!data) {
      try {
        const kvDataStr = await c.env.KV_CACHE.get(key);
        if (kvDataStr) {
          const parsed = JSON.parse(kvDataStr);
          if (
            typeof parsed.tokens === 'number' && isFinite(parsed.tokens) &&
            typeof parsed.lastRefill === 'number' && isFinite(parsed.lastRefill) &&
            typeof parsed.strikes === 'number' && isFinite(parsed.strikes) &&
            parsed.tokens >= -cost && parsed.tokens <= finalLimit + (refillRate * finalWindow)
          ) {
            data = parsed as TokenBucket;
          }
        }
      } catch (e) {}
    }

    // TS Strict: Garante ao compilador que a variável nunca será undefined nas linhas abaixo
    let currentBucket: TokenBucket;

    if (!data) {
      currentBucket = { tokens: finalLimit - cost, lastRefill: now, strikes: 0 };
      shouldSyncKV = true; 
    } else {
      currentBucket = data; // Vincula a referência segura
      const timePassed = Math.max(0, now - currentBucket.lastRefill);
      const refill = timePassed * refillRate;

      currentBucket.tokens = Math.min(finalLimit, currentBucket.tokens + refill);
      currentBucket.lastRefill = now;

      if (Math.floor(currentBucket.tokens) >= cost) {
        currentBucket.tokens -= cost;
        
        // 📉 Healing: Comportamento bom reduz strikes
        if (currentBucket.tokens >= finalLimit * 0.8) currentBucket.strikes = 0;
        
        if (mode === 'strict' || (currentBucket.tokens < finalLimit / 2 && timePassed > 1)) {
             shouldSyncKV = true;
        }
      } else {
        shouldSyncKV = true;
        
        // 📈 PENALTY BOX: Escalonamento Exponencial (Máx 32x)
        currentBucket.strikes += 1;
        const penaltyMultiplier = Math.pow(2, Math.min(currentBucket.strikes, 5));
        
        const rawRetryAfter = Math.ceil((cost - currentBucket.tokens) / refillRate);
        const retryAfter = Math.max(1, rawRetryAfter * penaltyMultiplier); 
        
        c.header('Retry-After', retryAfter.toString());
        
        return error(c, 'Muitas tentativas detectadas. Acesso bloqueado temporariamente.', null, 429);
      }
    }

    if (localCache.size >= MAX_CACHE_SIZE) {
      const firstKey = localCache.keys().next().value;
      if (firstKey) localCache.delete(firstKey);
    }
    
    const jitter = finalWindow * (0.9 + Math.random() * 0.2); 
    
    localCache.set(key, { 
      bucket: currentBucket, 
      localExpiresAt: now + jitter 
    });

    const remaining = Math.floor(currentBucket.tokens).toString();
    const reset = Math.ceil(now + ((finalLimit - currentBucket.tokens) / refillRate)).toString();
    const limitStr = finalLimit.toString();

    c.header('X-RateLimit-Limit', limitStr);
    c.header('X-RateLimit-Remaining', remaining);
    c.header('X-RateLimit-Reset', reset);
    
    c.header('RateLimit-Limit', limitStr);
    c.header('RateLimit-Remaining', remaining);
    c.header('RateLimit-Reset', reset);

    if (shouldSyncKV) {
      // ⏱️ TTL SAFETY: Garante vida útil para o refil fracionário + margem de latência
      const kvTtl = Math.max(60, Math.min(finalWindow * 2, 86400)); 
      c.executionCtx.waitUntil(
        c.env.KV_CACHE.put(key, JSON.stringify(currentBucket), { expirationTtl: kvTtl }).catch(() => {})
      );
    }

    await next();
  });
};