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

// === [NOVO] TABELA DE CONTRATOS (GESTÃO DE ATIVOS & RWA) ===
export const contracts = sqliteTable('contracts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Detalhes do Ativo
    description: text('description').notNull(), // Ex: "Lote Condado", "Itaipuaçu"
    totalValue: integer('total_value').notNull(), // Valor em centavos ou Real (recomenda-se real/float para SQLite)
    
    // Configuração de Parcelamento
    totalInstallments: integer('total_installments'),
    startDate: integer('start_date', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    
    // Status do Contrato
    status: text('status', { enum: ['active', 'completed', 'defaulted', 'transferred'] }).default('active'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        userIdx: index('idx_contracts_user_id').on(table.userId),
        statusIdx: index('idx_contracts_status').on(table.status),
    };
});

// === [NOVO] TABELA DE TRANSAÇÕES (HISTÓRICO DE PAGAMENTOS) ===
export const transactions = sqliteTable('transactions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contractId: integer('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
    
    amount: integer('amount').notNull(), // Valor pago
    paymentDate: integer('payment_date', { mode: 'timestamp' }).notNull(),
    
    // Controle de Referência (Ex: "11/2025")
    referencePeriod: text('reference_period'), 
    
    type: text('type', { enum: ['sinal', 'parcela', 'acordo', 'taxa', 'extra'] }).notNull(),
    
    // Metadados do Pagamento
    paymentMethod: text('payment_method').default('transfer'), // pix, cash, transfer
    notes: text('notes'), // Ex: "Desconto pandemia aplicado"
    
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        contractIdx: index('idx_transactions_contract_id').on(table.contractId),
        periodIdx: index('idx_transactions_reference').on(table.referencePeriod),
    };
});

// =========================================================
// === [NOVO] MÓDULO SOCIALFI (BLOG & NOTÍCIAS) ===
// =========================================================

export const posts = sqliteTable('posts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    // Conteúdo Principal
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(), // URL amigável (ex: 'nova-parceria-paraty')
    content: text('content').notNull(),    // HTML ou Markdown
    coverUrl: text('cover_url'),           // URL da imagem de capa
    
    // Metadados
    category: text('category').default('Geral'),
    tags: text('tags'), // Pode armazenar array como string JSON se necessário
    
    // Métricas de Engajamento
    totalViews: integer('total_views').default(0),
    
    // Relacionamento (Autor)
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    
    // Estado
    published: integer('published', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        slugIdx: index('idx_posts_slug').on(table.slug),
        categoryIdx: index('idx_posts_category').on(table.category),
        publishedIdx: index('idx_posts_published').on(table.published),
    };
});

// === COMENTÁRIOS (INTERAÇÃO SOCIAL) ===
export const post_comments = sqliteTable('post_comments', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    
    // Relacionamentos
    postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        postIdx: index('idx_comments_post').on(table.postId),
    };
});