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
 *
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Central System API & Identity Provider
 */
import { hash, compare } from 'bcryptjs';
import { sign } from 'hono/jwt';

export const AuthService = {
  /**
   * Gera o Hash da senha de forma segura para o Edge.
   * O custo (salt rounds) 10 é o padrão recomendado para equilíbrio entre segurança e performance.
   */
  async hashPassword(password: string): Promise<string> {
    return await hash(password, 10);
  },

  /**
   * Compara a senha enviada pelo usuário com o Hash armazenado no D1.
   * Nota: No bcryptjs, a ordem é (senha_plana, hash_armazenado).
   */
  async comparePassword(password: string, storedHash: string): Promise<boolean> {
    try {
      return await compare(password, storedHash);
    } catch (err) {
      console.error('Erro na comparação de hash:', err);
      return false;
    }
  },

  /**
   * Gera o JWT Access Token para autenticação em múltiplos SaaS.
   * Inclui o 'role' institucional para controle de acesso (RBAC).
   */
  async generateToken(user: any, secret: string): Promise<string> {
    return await sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'citizen', // Define 'citizen' como padrão institucional
        // Expiração definida para 7 dias (em segundos)
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      },
      secret
    );
  }
};