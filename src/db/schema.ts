/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Database Schema (Drizzle ORM + SQLite D1)
 * Version: 1.3.1 - Fix: Audit Actor Type & RWA Multi-Currency
 */

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ======================================================================
// === 1. IDENTIDADE E GOVERNANÇA (USUÁRIOS) ===
// ======================================================================

/**
 * Tabela Central de Usuários.
 * Gerencia a identidade dos sócios com suporte a Soft Deletes.
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

  // Segurança e 2FA (Pronto para Google Authenticator)
  mfaSecret: text('mfa_secret'), 
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).default(false),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),

  // Governança e Compliance DAO
  kycStatus: text('kyc_status', { enum: ['none', 'pending', 'approved', 'rejected'] }).default('none'),
  role: text('role', { enum: ['citizen', 'partner', 'admin', 'system'] }).default('citizen'),

  // Ciclo de Vida do Registro (Soft Delete protege o histórico da associação)
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), 
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  roleIdx: index('idx_users_role').on(table.role),
  deletedIdx: index('idx_users_deleted').on(table.deletedAt),
}));

// ======================================================================
// === 2. SEGURANÇA E WEB3 ===
// ======================================================================

export const passwordResets = sqliteTable('password_resets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(), 
  ipAddress: text('ip_address'), 
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

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
  totalViews: integer('total_views').default(0),
  totalShares: integer('total_shares').default(0),
  totalFavorites: integer('total_favorites').default(0),
  timeToRead: integer('time_to_read').default(5),
  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
  publish: integer('publish', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  slugIdx: index('idx_posts_slug').on(table.slug),
  publishIdx: index('idx_posts_publish').on(table.publish),
}));

export const postFavorites = sqliteTable('post_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  uniqueFavoriteIdx: uniqueIndex('unique_post_user_favorite').on(table.postId, table.userId),
}));

// ======================================================================
// === 4. ATIVOS REAIS (RWA) E CONTRATOS AGRO ===
// ======================================================================

/**
 * Gestão de Contratos RWA.
 * Melhoria: Adicionado campo 'currency' para suportar diversificação financeira internacional.
 */
export const contracts = sqliteTable('contracts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  description: text('description').notNull(), 
  totalValue: integer('total_value').notNull(), // Valor em centavos para precisão absoluta
  currency: text('currency').default('BRL'), // Suporte para BRL, USD, USDT
  totalInstallments: integer('total_installments').default(1),
  
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
  
  /** * 🟢 CORREÇÃO CRÍTICA: actorId alterado para TEXT.
   * Permite armazenar o ID do usuário (ex: "1") ou identificadores de sistema (ex: "anon", "system").
   * Isso evita o Erro 500 no registro/login causado pela inserção de strings em campos integer.
   */
  actorId: text('actor_id').notNull(), 
  
  action: text('action').notNull(), 
  status: text('status').default('success'), 
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'), 
  
  // Metadados flexíveis em JSON para auditoria detalhada
  metadata: text('metadata', { mode: 'json' }), 
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  actionIdx: index('idx_audit_action').on(table.action),
  actorIdx: index('idx_audit_actor').on(table.actorId),
  timeIdx: index('idx_audit_time').on(table.createdAt),
}));