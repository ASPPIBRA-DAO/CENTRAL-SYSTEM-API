/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Password Recovery Controller (Production Ready)
 * Version: 1.2.2 - Fix: DB Factory Sincronizada & KV Flow
 */

import { Hono } from 'hono';
// 🟢 Sincronizado com a exportação de packages/back/src/db/index.ts
import { createDb } from '../../../db'; 
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../../services/auth';
import { success, error } from '../../../utils/response';
import { forgotPasswordSchema, resetPasswordSchema } from '../../../validators/auth';

// Definição de tipos para suportar D1Database e KVNamespace
type PasswordEnv = {
  Bindings: {
    DB: D1Database;
    KV_AUTH: KVNamespace;
  };
};

const passwordRoutes = new Hono<PasswordEnv>();

/**
 * [POST] /forgot-password
 * Gera um identificador único de recuperação e persiste no KV com TTL de 1 hora.
 */
passwordRoutes.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validação robusta com safeParse para evitar exceções não tratadas
    const parseStatus = forgotPasswordSchema.safeParse(body);
    if (!parseStatus.success) {
      return error(c, 'Dados inválidos', parseStatus.error.format(), 400);
    }

    const { email } = parseStatus.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Instancia o banco via Factory e busca o usuário
    const database = createDb(c.env.DB);
    const [user] = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (user) {
      // 2. Geração de Token Seguro (UUID v4)
      const recoveryToken = crypto.randomUUID();
      const kvKey = `reset:${recoveryToken}`;

      /**
       * 3. Persistência no KV_AUTH com Expiração Nativa
       * Armazenamos o ID do usuário como valor.
       * expirationTtl: 3600 segundos (O link expira automaticamente em 1 hora)
       */
      await c.env.KV_AUTH.put(kvKey, user.id.toString(), {
        expirationTtl: 3600
      });

      // Auditoria em console para ambiente de desenvolvimento/homologação
      console.log(`[AUTH-DAO] Token gerado para ${normalizedEmail}: ${recoveryToken}`);
    }

    /**
     * 4. Resposta Anti-Enumeração (Segurança Forense)
     * Não confirmamos se o e-mail existe para impedir mapeamento de usuários por terceiros.
     */
    return success(c, 'Se o e-mail informado estiver em nossa base, as instruções foram enviadas.');
  } catch (err) {
    return error(c, 'Erro ao processar solicitação de recuperação.', null, 500);
  }
});

/**
 * [POST] /reset-password
 * Valida o token no KV e aplica o novo hash de senha no D1.
 */
passwordRoutes.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    
    const parseStatus = resetPasswordSchema.safeParse(body);
    if (!parseStatus.success) {
      return error(c, 'Dados de nova senha inválidos', parseStatus.error.format(), 400);
    }

    const { token, password } = parseStatus.data;
    const kvKey = `reset:${token}`;

    // 1. Recupera o ID do usuário vinculado ao token no KV
    const userId = await c.env.KV_AUTH.get(kvKey);

    if (!userId) {
      return error(c, 'O link de recuperação é inválido ou já expirou.', null, 400);
    }

    // 2. Hash da nova senha (Bcryptjs cost 10)
    const hashedPassword = await hashPassword(password);

    // 3. Atualização no Banco de Dados
    const database = createDb(c.env.DB);
    await database
      .update(users)
      .set({ 
        password: hashedPassword, 
        updatedAt: new Date() 
      })
      .where(eq(users.id, parseInt(userId)));

    /**
     * 4. Invalidação do Token (Segurança One-Time Use)
     * Deletamos o token imediatamente após o uso para prevenir ataques de replay.
     */
    await c.env.KV_AUTH.delete(kvKey);

    return success(c, 'Sua credencial foi atualizada com sucesso. O acesso à DAO está liberado.');
  } catch (err) {
    console.error('[DATABASE ERROR]', err);
    return error(c, 'Falha sistêmica ao atualizar a senha.', null, 500);
  }
});

export default passwordRoutes;