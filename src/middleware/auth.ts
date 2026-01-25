/**
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Middleware (JWT Guardian)
 * Version: 1.1.0 - Strict Context Typing
 */

import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { error } from '../utils/response'; // ✅ Importando seu utilitário de erro padronizado

// Definição global de tipos para o contexto do Middleware
type AuthEnv = {
  Bindings: {
    JWT_SECRET: string;
  };
  Variables: {
    user: {
      id: number;
      email: string;
      role: string;
    };
  };
};

/**
 * Middleware para proteger rotas privadas.
 * Valida o JWT no Header Authorization e injeta o usuário no contexto.
 */
export const requireAuth = () => createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  // Verifica se o cabeçalho Bearer está presente
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(c, 'Acesso negado. Token de autenticação ausente.', null, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    // Validação do token usando o Secret do wrangler.toml
    const payload = await verify(token, c.env.JWT_SECRET);
    
    /**
     * ✅ INJEÇÃO DE DADOS: 
     * Agora, qualquer rota que use este middleware pode acessar 'const user = c.get("user")'
     */
    c.set('user', payload as any);
    
    await next();
  } catch (err) {
    // Caso o token tenha sido alterado ou tenha expirado (definimos 7 dias no service)
    return error(c, 'Sessão expirada ou token inválido. Faça login novamente.', null, 401);
  }
});