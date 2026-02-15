/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Database Schema (Drizzle ORM + SQLite D1)
 * Version: 1.3.0 - Enhanced Security, RWA & Forensics
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ======================================================================
// === 1. IDENTIDADE E GOVERNANÇA (USUÁRIOS) ===
// ======================================================================

/**
 * Tabela Central de Usuários.
 * Inclui suporte a Soft Deletes para conformidade com auditoria de DAO
 * e campos de segurança avançada (MFA/KYC).
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Identidade Civil e Digital
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), 

  // Validação e Perfil
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  avatarUrl: text('avatar_url'),

  // Segurança e 2FA
  mfaSecret: text('mfa_secret'), 
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).default(false),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }), // Monitoramento de atividade

  // Governança e Compliance
  kycStatus: text('kyc_status', { enum: ['none', 'pending', 'approved', 'rejected'] }).default('none'),
  role: text('role', { enum: ['citizen', 'partner', 'admin', 'system'] }).default('citizen'),

  // Timestamps e Soft Delete (Não remove fisicamente o sócio da base)
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), 
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  roleIdx: index('idx_users_role').on(table.role),
  deletedIdx: index('idx_users_deleted').on(table.deletedAt),
}));

// ======================================================================
// === 2. SEGURANÇA E RECUPERAÇÃO ===
// ======================================================================

/**
 * Gestão de Tokens de Reset de Senha.
 * Adicionado ipAddress para rastrear tentativas de sequestro de conta.
 */
export const passwordResets = sqliteTable('password_resets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(), 
  ipAddress: text('ip_address'), // Rastreabilidade de segurança
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

/**
 * Vinculação de Carteiras Web3 para Tokenização RWA.
 */
export const wallets = sqliteTable('wallets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  address: text('address').notNull().unique(),
  chainId: integer('chain_id').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// ======================================================================
// === 3. MÓDULO SOCIALFI (POSTS & ENGAJAMENTO) ===
// ======================================================================

/**
 * Tabela de Conteúdo (Blog/Notícias).
 * Sincronizada com as propriedades 'publish' do frontend.
 */
export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  content: text('content').notNull(),
  coverUrl: text('cover_url'),
  
  category: text('category').default('Geral'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(), 
  
  // Métricas de Alcance
  totalViews: integer('total_views').default(0),
  totalShares: integer('total_shares').default(0),
  totalFavorites: integer('total_favorites').default(0),
  timeToRead: integer('time_to_read').default(5),

  // Flags de Curadoria
  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
  isTrending: integer('is_trending', { mode: 'boolean' }).default(false),
  publish: integer('publish', { mode: 'boolean' }).default(true),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  slugIdx: index('idx_posts_slug').on(table.slug),
  publishIdx: index('idx_posts_publish').on(table.publish),
  categoryIdx: index('idx_posts_category').on(table.category),
}));

/**
 * Registro Único de Favoritos para Social Proof.
 */
export const postFavorites = sqliteTable('post_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  uniqueFavoriteIdx: uniqueIndex('unique_post_user_favorite').on(table.postId, table.userId),
}));

// ======================================================================
// === 4. ATIVOS REAIS (RWA) E CONTRATOS FINANCEIROS ===
// ======================================================================

/**
 * Gestão de Contratos de Produção (Café/Agro).
 * Valores armazenados em Inteiros (Cents) para evitar erros de ponto flutuante.
 */
export const contracts = sqliteTable('contracts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  description: text('description').notNull(), 
  totalValue: integer('total_value').notNull(), // Valor em centavos (Ex: R$ 10,00 = 1000)
  totalInstallments: integer('total_installments'),
  
  status: text('status', { enum: ['active', 'completed', 'defaulted', 'archived'] }).default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// ======================================================================
// === 5. TRANSPARÊNCIA E AUDITORIA FORENSE ===
// ======================================================================

/**
 * Tabela de Logs de Auditoria.
 * Crucial para a confiança da DAO e rastreamento de ações administrativas.
 */
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: integer('actor_id').references(() => users.id), // Quem executou
  
  action: text('action').notNull(), // Ex: 'AUTH_LOGIN', 'CONTRACT_CREATE', 'WALLET_BIND'
  status: text('status').default('success'), 
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'), // Identificação do dispositivo/browser
  
  // Metadados em JSON para armazenar o "estado anterior" e o "novo estado"
  metadata: text('metadata', { mode: 'json' }), 
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  actionIdx: index('idx_audit_action').on(table.action),
  actorIdx: index('idx_audit_actor').on(table.actorId),
  timeIdx: index('idx_audit_time').on(table.createdAt),
}));