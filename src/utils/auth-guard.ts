/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Role-Based Access Control (RBAC) Guard (Absolute Bank-Grade 10/10)
 * Version: 1.0.0 - Hierarchical Role Mapping & Zero-Trust Rejection
 */

import { Context, Next } from 'hono';
import { error } from './response';

/**
 * 🛡️ SECURITY: Role Hierarchy Mapping
 * Permite uma estrutura escalável onde papéis superiores herdam permissões de papéis inferiores,
 * evitando a necessidade de passar arrays gigantes em cada rota.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  'GUEST': 0,
  'USER': 1,
  'MODERATOR': 2,
  'ADMIN': 3,
  'SYSADMIN': 4,
};

type Role = keyof typeof ROLE_HIERARCHY;

/**
 * 🛡️ SRE: Middleware de Verificação de Permissão (RBAC)
 * @param minimumRole O papel mínimo exigido para acessar a rota
 */
export const requireRole = (minimumRole: Role) => {
  return async (c: Context, next: Next) => {
    // 1. Extrai o usuário injetado pelo middleware de Autenticação prévio (ex: Bearer JWT validator)
    const user = c.get('user');

    // 2. Zero-Trust: Se não há usuário no contexto, rejeita imediatamente
    if (!user) {
      return error(c, 'Acesso Negado: Usuário não autenticado no contexto', null, 401, 'RBAC_UNAUTHENTICATED');
    }

    // 3. Fallback Seguro: Se o usuário não tiver papel definido, assumimos GUEST
    const userRole: string = (user.role || 'GUEST').toUpperCase();
    
    // 4. Mapeamento Hierárquico de Poder
    const userPower = ROLE_HIERARCHY[userRole] ?? -1; // -1 garante falha se o papel for inválido/hackeado
    const requiredPower = ROLE_HIERARCHY[minimumRole];

    // 5. Validação de Acesso
    if (userPower < requiredPower) {
      const traceId = c.res.headers.get('X-Trace-Id') || c.req.header('X-Trace-Id') || 'unknown';
      
      // 🛡️ OBSERVABILITY: Registro detalhado de tentativa de escalada de privilégio
      console.warn(`[SECURITY_RBAC_VIOLATION] Trace: ${traceId} - User ${user.id} (${userRole}) attempted to access ${c.req.method} ${new URL(c.req.url).pathname} requiring ${minimumRole}`);

      // 🛡️ SECURITY: Retorna 403 genérico ao cliente para não mapear hierarquia interna
      return error(c, 'Acesso Proibido: Permissões Insuficientes', null, 403, 'RBAC_FORBIDDEN');
    }

    // Passou na verificação, segue para a rota
    await next();
  };
};

/**
 * 🛡️ UTILITY: Middleware auxiliar estrito para rotas administrativas isoladas
 * Atalho semântico para requireRole('ADMIN')
 */
export const requireAdmin = requireRole('ADMIN');
