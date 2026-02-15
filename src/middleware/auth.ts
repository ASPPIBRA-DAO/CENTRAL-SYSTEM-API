/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Middleware (JWT Guardian)
 * Version: 1.2.1 - Fix: JWT Algorithm & Strict Typing
 */

import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { error } from '../utils/response';

/**
 * Interface rigorosa para o Usuário Autenticado.
 * Mapeia os dados do JWT para o ecossistema ASPPIBRA.
 */
interface AuthUser {
  id: number;
  email: string;
  role: 'citizen' | 'partner' | 'admin' | 'system';
}

/**
 * Definição do Ambiente do Hono (Env).
 * Vincula as variáveis de ambiente (Bindings) e as variáveis de contexto (Variables).
 */
type AuthEnv = {
  Bindings: {
    JWT_SECRET: string;
  };
  Variables: {
    user: AuthUser; 
  };
};

/**
 * Middleware 'requireAuth'
 * Atua como o guardião das rotas privadas da ASPPIBRA DAO.
 * * MELHORIAS E CORREÇÕES APLICADAS:
 * 1. Resolução do erro TS2554: Adicionado 'HS256' como argumento obrigatório.
 * 2. Case-insensitivity: Suporta 'Bearer' e 'bearer'.
 * 3. Memory Efficient: Uso de .slice(7) para extração do token em Edge Computing.
 */
export const requireAuth = () => createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  // 1. Validação de presença e formato do Header
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return error(c, 'Acesso negado. Credenciais de autenticação ausentes.', null, 401);
  }

  // 2. Extração do token (Pula os primeiros 7 caracteres: 'Bearer ')
  const token = authHeader.slice(7);

  try {
    /**
     * 3. Verificação do JWT
     * 🟢 CORREÇÃO TÉCNICA: O Hono exige o algoritmo (HS256) para validar a assinatura.
     */
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    
    // 4. Validação de integridade do payload
    if (!payload || typeof payload.id !== 'number') {
      throw new Error('Payload íntegro, mas campos obrigatórios ausentes.');
    }

    /**
     * 5. INJEÇÃO DE CONTEXTO SEGURO
     * O cast 'unknown as AuthUser' garante Type-Safety nas rotas protegidas.
     */
    c.set('user', payload as unknown as AuthUser);
    
    await next();
    
  } catch (err) {
    /**
     * Tratamento de erros de segurança:
     * Abrange expiração, assinatura inválida ou tokens malformados.
     */
    return error(c, 'Sessão expirada ou token inválido. Por favor, faça login novamente.', null, 401);
  }
});