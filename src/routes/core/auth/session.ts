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
import { Hono } from 'hono';
import { hash } from 'bcryptjs';
import { zValidator } from '@hono/zod-validator';
import { signUpSchema } from '../../../validators/auth'; // ✅ Corrigido: Nome do export
import { users, audit_logs } from '../../../db/schema';
import { success, error } from '../../../utils/response';
import { Database } from '../../../db';
import { eq } from 'drizzle-orm';

// Tipagem do contexto para garantir acesso ao banco D1
const app = new Hono<{ Variables: { db: Database } }>();

// ----------------------------------------------------------------------
// Rota: POST /register
// ----------------------------------------------------------------------
app.post(
  '/register', 
  zValidator('json', signUpSchema), // ✅ Corrigido: Usando signUpSchema
  
  async (c) => {
    const db = c.get('db');
    const data = c.req.valid('json');

    try {
      // 1. Verificar se email já existe
      const existingUser = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

      if (existingUser.length > 0) {
        return error(c, 'Este e-mail já está cadastrado.', null, 409);
      }

      // 2. Criptografar a senha
      const passwordHash = await hash(data.password, 10);

      // 3. Salvar no Banco (Sincronizado com schema.ts)
      const [newUser] = await db.insert(users).values({
        firstName: data.firstName, // ✅ Corrigido: Campo split
        lastName: data.lastName,   // ✅ Corrigido: Campo split
        email: data.email,
        password: passwordHash,
        role: 'citizen',           // ✅ Corrigido: Enum institucional
        emailVerified: false,
      }).returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt
      });

      // 4. Registro de Auditoria Forense
      await db.insert(audit_logs).values({
        actorId: String(newUser.id),
        action: 'register',
        resource: `users:${newUser.id}`,
        status: 'success',
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        userAgent: c.req.header('user-agent'),
      });

      return success(c, newUser, 'Usuário criado com sucesso!', 201);

    } catch (err: any) {
      console.error('Erro no registro:', err);
      return error(c, 'Falha ao processar registro institucional', err.message, 500);
    }
  }
);

export default app;