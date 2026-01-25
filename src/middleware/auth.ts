/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';

// ✅ DEFINIÇÃO DE TIPAGEM CORRIGIDA
// Aqui definimos o que existe no Env (Bindings) e o que existe no Contexto (Variables)
type AuthEnv = {
  Bindings: {
    JWT_SECRET: string;
  };
  Variables: {
    user: any; // Agora o Hono sabe que c.set('user', ...) é permitido!
  };
};

/**
 * Middleware para proteger rotas privadas.
 * Verifica o Header Authorization: Bearer <token>
 */
export const requireAuth = () => createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ 
      success: false, 
      message: 'Acesso negado. Token de autenticação ausente.' 
    }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    
    // Injeta os dados do usuário no contexto
    // O erro sumirá porque definimos 'user' dentro de 'Variables' lá em cima
    c.set('user', payload);
    
    await next();
  } catch (err) {
    return c.json({ 
      success: false, 
      message: 'Token inválido ou expirado.' 
    }, 401);
  }
});