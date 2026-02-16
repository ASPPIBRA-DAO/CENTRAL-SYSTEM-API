/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Rate Limit Middleware (Anti-Brute Force Guardian)
 * Version: 1.2.0 - Fixed TTL Window & Hono Compatibility
 */

import { createMiddleware } from 'hono/factory';
import { error } from '../utils/response';

type RateLimitEnv = {
  Bindings: {
    KV_CACHE: KVNamespace;
  };
};

/**
 * Middleware de Rate Limit
 * Protege endpoints sensíveis (Login/Register) contra abusos e ataques DoS.
 * * @param limit - Máximo de requisições permitidas no intervalo.
 * @param window - Janela de tempo em segundos para o bloqueio.
 */
export const rateLimit = (limit: number = 5, window: number = 60) => 
  createMiddleware<RateLimitEnv>(async (c, next) => {
    // 1. Identificação única do cliente (Prioriza o IP real via Cloudflare)
    const ip = c.req.header('CF-Connecting-IP') || 'anonymous';
    const key = `rate-limit:${ip}:${c.req.path}`;

    /**
     * 2. Recuperação de metadados do KV
     * Buscamos o valor atual para validar o limite antes de processar a lógica.
     */
    const current = await c.env.KV_CACHE.get(key);
    const count = current ? parseInt(current) : 0;

    /**
     * 3. Verificação de Limite Excedido
     * Retorna status 429 (Too Many Requests) com metadados de Retry.
     */
    if (count >= limit) {
      // Padrão RFC 6585: Informa ao cliente quando ele pode tentar novamente
      c.header('Retry-After', window.toString());
      
      return error(c, 'Muitas tentativas detectadas. Seu IP foi temporariamente limitado.', {
        ip,
        policy: `${limit} requests per ${window}s`,
      }, 429);
    }

    /**
     * 4. Incremento e Persistência
     * Atualizamos o contador no KV.
     * Nota: O expirationTtl garante a limpeza automática do registro após a janela.
     */
    const nextCount = count + 1;
    await c.env.KV_CACHE.put(key, nextCount.toString(), {
      expirationTtl: window
    });

    /**
     * 5. Injeção de Headers de Controle
     * Utilizamos c.header() do Hono para garantir que os cabeçalhos 
     * acompanhem a resposta final com segurança.
     */
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, limit - nextCount).toString());
    c.header('X-RateLimit-Reset', window.toString());

    // Prosegue para o próximo middleware ou rota
    await next();
  });