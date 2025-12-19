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
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// === TABELA DE USUÁRIOS (NÚCLEO DA IDENTIDADE) ===
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // --- Identidade Web2 ---
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Armazena o hash (Bcrypt ou Argon2id)

  // [NOVO] Controle de Verificação de Email
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),

  // --- Segurança & MFA ---
  mfa_secret: text('mfa_secret'), 
  mfa_enabled: integer('mfa_enabled', { mode: 'boolean' }).default(false),

  // --- Compliance & Nível de Garantia ---
  kyc_status: text('kyc_status', { enum: ['none', 'pending', 'approved', 'rejected'] }).default('none'),
  aal_level: integer('aal_level').default(1), 

  // --- Controle de Acesso & Metadados ---
  role: text('role', { enum: ['citizen', 'admin', 'system'] }).default('citizen'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    emailIdx: index('idx_users_email').on(table.email),
    roleIdx: index('idx_users_role').on(table.role),
  };
});

// === [NOVO] TABELA DE TOKENS DE RECUPERAÇÃO (PASSWORD RESET) ===
export const password_resets = sqliteTable('password_resets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(), // Token único enviado por email
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    used: integer('used', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        tokenIdx: index('idx_password_resets_token').on(table.token),
    };
});

// === TABELA DE CARTEIRAS (IDENTIDADE WEB3) ===
export const wallets = sqliteTable('wallets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    address: text('address').notNull().unique(),
    chainId: integer('chain_id').notNull(),
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        userIdx: index('idx_wallets_user_id').on(table.userId),
        addressIdx: index('idx_wallets_address').on(table.address),
    };
});

// === TABELA DE LOGS DE AUDITORIA (RASTREABILIDADE) ===
export const audit_logs = sqliteTable('audit_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorId: text('actor_id'), 
    action: text('action').notNull(), 
    resource: text('resource'), 
    status: text('status', { enum: ['success', 'failure'] }).default('success'),
    ipAddress: text('ip_address'),
    country: text('country'), 
    userAgent: text('user_agent'),
    metadata: text('metadata', { mode: 'json' }), 
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        actionIdx: index('idx_audit_logs_action').on(table.action),
        actorIdx: index('idx_audit_logs_actor').on(table.actorId),
    };
});