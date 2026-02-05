/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Database Schema (Drizzle ORM + SQLite D1)
 * Version: 1.2.0 - Real Identity & SocialFi Integration
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// === 1. TABELA DE USUÁRIOS (Sincronizado com AuthGuard do Frontend) ===
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Identidade Web2
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), 

  // Status de Verificação
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  avatarUrl: text('avatar_url'),

  // Segurança (Snake_case para o DB, CamelCase para o código)
  mfaSecret: text('mfa_secret'), 
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).default(false),

  // Compliance & Governança
  kycStatus: text('kyc_status', { enum: ['none', 'pending', 'approved', 'rejected'] }).default('none'),
  role: text('role', { enum: ['citizen', 'partner', 'admin', 'system'] }).default('citizen'),

  // Timestamps em formato Unix (Melhor performance no D1)
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  roleIdx: index('idx_users_role').on(table.role),
}));

// === 2. SEGURANÇA: RECUPERAÇÃO DE SENHA ===
export const passwordResets = sqliteTable('password_resets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(), 
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// === 3. CARTEIRAS (IDENTIDADE WEB3 / TOKENIZAÇÃO) ===
export const wallets = sqliteTable('wallets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  address: text('address').notNull().unique(),
  chainId: integer('chain_id').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// ======================================================================
// === 4. MÓDULO SOCIALFI (POSTS & BLOG) ===
// ======================================================================

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'), // Meta Description e Cards
  content: text('content').notNull(),
  coverUrl: text('cover_url'),
  
  category: text('category').default('Geral'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(), // Tags dinâmicas em JSON
  
  // Métricas SocialFi
  totalViews: integer('total_views').default(0),
  totalShares: integer('total_shares').default(0),
  totalFavorites: integer('total_favorites').default(0),
  timeToRead: integer('time_to_read').default(5), // Minutos estimados

  // Controle de Destaque e Governança
  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
  isTrending: integer('is_trending', { mode: 'boolean' }).default(false),

  // 🟢 AJUSTE: Renomeado para 'publish' para bater com o Front-end
  publish: integer('publish', { mode: 'boolean' }).default(true),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  slugIdx: index('idx_posts_slug').on(table.slug),
  publishIdx: index('idx_posts_publish').on(table.publish),
  categoryIdx: index('idx_posts_category').on(table.category),
}));

// --- Comentários ---
export const postComments = sqliteTable('post_comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  content: text('content').notNull(),
  likes: integer('likes').default(0), 
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- 🟢 NOVO: Favoritos (Social Proof & SocialFi) ---
// Essencial para o componente de AvatarGroup no Front-end
export const postFavorites = sqliteTable('post_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  uniqueFavoriteIdx: uniqueIndex('unique_post_user_favorite').on(table.postId, table.userId),
}));


// === 5. GESTÃO DE ATIVOS (RWA) & CONTRATOS ===
export const contracts = sqliteTable('contracts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  description: text('description').notNull(), 
  totalValue: integer('total_value').notNull(), // Valor em centavos
  totalInstallments: integer('total_installments'),
  
  status: text('status', { enum: ['active', 'completed', 'defaulted'] }).default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// ======================================================================
// === 6. LOGS DE AUDITORIA (TRANSPARÊNCIA DAO) ===
// ======================================================================

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: integer('actor_id').references(() => users.id),
  
  action: text('action').notNull(), // Ex: 'BLOG_POST_CREATE', 'USER_LOGIN'
  status: text('status').default('success'), // 'success' | 'failure'
  ipAddress: text('ip_address'),
  
  // Metadados para auditoria forense (JSON com detalhes da mudança)
  metadata: text('metadata', { mode: 'json' }), 
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  actionIdx: index('idx_audit_action').on(table.action),
  actorIdx: index('idx_audit_actor').on(table.actorId),
}));