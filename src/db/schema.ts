/**
 * Copyright 2026 ASPPIBRA
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Database Schema (Drizzle ORM + SQLite D1)
 * Version: 11.0.0 (High-Throughput Data Architecture)
 *
 */

import { AnySQLiteColumn, sqliteTable, text, integer, index, uniqueIndex, primaryKey, check } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// ======================================================================
// === 🕒 HIGH-PRECISION TIMESTAMPS (Step 2) ===
// ======================================================================
const timestampsMs = {
  // mode: 'timestamp_ms' mapeia o INT (ms) para Date() nativo no JS
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
    
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

// ======================================================================
// === 1. USERS (HARDENED VERSION) ===
// ======================================================================

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // ------------------------------------------------------------------
  // Identity
  // ------------------------------------------------------------------
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),

  email: text('email').notNull(),
  emailNormalized: text('email_normalized').notNull(),

  // ------------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------------
  passwordHash: text('password_hash').notNull(),
  passwordUpdatedAt: integer('password_updated_at', { mode: 'timestamp_ms' }),

  // ------------------------------------------------------------------
  // Email Verification
  // ------------------------------------------------------------------
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),

  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),

  avatarUrl: text('avatar_url'),

  // ------------------------------------------------------------------
  // MFA
  // ------------------------------------------------------------------
  mfaSecretEncrypted: text('mfa_secret_encrypted'),

  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),

  // ------------------------------------------------------------------
  // Login Protection
  // ------------------------------------------------------------------
  lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),

  loginAttempts: integer('login_attempts')
    .notNull()
    .default(0),

  lockUntil: integer('lock_until', { mode: 'timestamp_ms' }),

  // ------------------------------------------------------------------
  // Compliance (KYC)
  // ------------------------------------------------------------------
  kycStatus: text('kyc_status', {
    enum: ['none', 'pending', 'approved', 'rejected'],
  })
    .notNull()
    .default('none'),

  kycUpdatedAt: integer('kyc_updated_at', { mode: 'timestamp_ms' }),

  // ------------------------------------------------------------------
  // Authorization
  // ------------------------------------------------------------------
  role: text('role', {
    enum: ['user', 'admin', 'system'],
  })
    .notNull()
    .default('user'),

  // ------------------------------------------------------------------
  // System Timestamps (createdAt, updatedAt, deletedAt)
  // ------------------------------------------------------------------
  ...timestampsMs,

}, (table) => ({

  // ------------------------------------------------------------------
  // INDEXES
  // ------------------------------------------------------------------

  roleIdx: index('idx_users_role')
    .on(table.role),

  loginIdx: index('idx_users_login')
    .on(table.emailNormalized, table.deletedAt),

  lockIdx: index('idx_users_lock_until')
    .on(table.lockUntil),

  emailActiveUnique: uniqueIndex('idx_users_email_active_unique')
    .on(table.emailNormalized)
    .where(sql`${table.deletedAt} IS NULL`),

  // ------------------------------------------------------------------
  // CHECK CONSTRAINTS (INTEGRITY HARDENING)
  // ------------------------------------------------------------------

  // Password must look like real bcrypt/argon hash
  pwdHashLenCheck: check(
    'chk_pwd_hash_len',
    sql`length(${table.passwordHash}) >= 60`
  ),

  // loginAttempts cannot be negative
  loginAttemptsNonNegative: check(
    'chk_login_attempts_non_negative',
    sql`${table.loginAttempts} >= 0`
  ),

  // Basic email format validation
  emailFormatCheck: check(
    'chk_email_format',
    sql`${table.emailNormalized} LIKE '%@%.__%'`
  ),

  // Email verified consistency
  emailVerificationConsistency: check(
    'chk_email_verification_consistency',
    sql`
      (
        ${table.emailVerified} = 0 AND ${table.emailVerifiedAt} IS NULL
      )
      OR
      (
        ${table.emailVerified} = 1 AND ${table.emailVerifiedAt} IS NOT NULL
      )
    `
  ),

  // MFA consistency
  mfaConsistency: check(
    'chk_mfa_consistency',
    sql`
      (
        ${table.mfaEnabled} = 0 AND ${table.mfaSecretEncrypted} IS NULL
      )
      OR
      (
        ${table.mfaEnabled} = 1 AND ${table.mfaSecretEncrypted} IS NOT NULL
      )
    `
  ),

  // Lock consistency
  lockTimeConsistency: check(
    'chk_lock_time_consistency',
    sql`
      ${table.lockUntil} IS NULL
      OR
      ${table.lastLoginAt} IS NULL
      OR
      ${table.lockUntil} >= ${table.lastLoginAt}
    `
  ),

  // KYC consistency
  kycConsistency: check(
    'chk_kyc_consistency',
    sql`
      (
        ${table.kycStatus} = 'none' AND ${table.kycUpdatedAt} IS NULL
      )
      OR
      (
        ${table.kycStatus} != 'none' AND ${table.kycUpdatedAt} IS NOT NULL
      )
    `
  ),

}));

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  wallets: many(wallets),
  contracts: many(contracts),
  sessions: many(sessions),
}));

// ======================================================================
// === 2. SESSIONS (HARDENED VERSION)
// ======================================================================

export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // ------------------------------------------------------------------
  // Relationship
  // ------------------------------------------------------------------
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // ------------------------------------------------------------------
  // Security (store HASH, never raw token)
  // ------------------------------------------------------------------
  tokenHash: text('token_hash')
    .notNull()
    .unique(),

  // ------------------------------------------------------------------
  // Expiration & Revocation
  // ------------------------------------------------------------------
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' })
    .notNull(),

  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),

  // ------------------------------------------------------------------
  // Audit Metadata
  // ------------------------------------------------------------------
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  createdAt: timestampsMs.createdAt,

}, (table) => ({

  // ------------------------------------------------------------------
  // INDEXES
  // ------------------------------------------------------------------

  userIdx: index('idx_sessions_user')
    .on(table.userId),

  expiresIdx: index('idx_sessions_expires')
    .on(table.expiresAt),

  tokenIdx: index('idx_sessions_token_hash')
    .on(table.tokenHash),

  activeSessionIdx: index('idx_sessions_active_user')
    .on(table.userId, table.revokedAt, table.expiresAt),

  // ------------------------------------------------------------------
  // CHECK CONSTRAINTS (INTEGRITY HARDENING)
  // ------------------------------------------------------------------

  // Token hash must look like SHA-256 (64 hex chars)
  tokenHashLengthCheck: check(
    'chk_token_hash_length',
    sql`length(${table.tokenHash}) >= 64`
  ),

  // Expiration must be after creation
  expirationAfterCreation: check(
    'chk_expiration_after_creation',
    sql`${table.expiresAt} > ${table.createdAt}`
  ),

  // Revocation must be after creation
  revocationAfterCreation: check(
    'chk_revocation_after_creation',
    sql`
      ${table.revokedAt} IS NULL
      OR
      ${table.revokedAt} >= ${table.createdAt}
    `
  ),

  // IP length safety
  ipLengthCheck: check(
    'chk_ip_length',
    sql`
      ${table.ipAddress} IS NULL
      OR
      length(${table.ipAddress}) <= 45
    `
  ),

  // UserAgent sanity limit
  userAgentLengthCheck: check(
    'chk_user_agent_length',
    sql`
      ${table.userAgent} IS NULL
      OR
      length(${table.userAgent}) <= 500
    `
  ),

}));

// ----------------------------------------------------------------------
// RELATIONS
// ----------------------------------------------------------------------

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ======================================================================
// === 3. PASSWORD RESETS (HARDENED VERSION)
// ======================================================================

export const passwordResets = sqliteTable('password_resets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // ------------------------------------------------------------------
  // Relationship
  // ------------------------------------------------------------------
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // ------------------------------------------------------------------
  // Security (store only HASH)
  // ------------------------------------------------------------------
  tokenHash: text('token_hash')
    .notNull(),

  // ------------------------------------------------------------------
  // Audit Metadata
  // ------------------------------------------------------------------
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // ------------------------------------------------------------------
  // Expiration
  // ------------------------------------------------------------------
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' })
    .notNull(),

  // ------------------------------------------------------------------
  // State Machine
  // ------------------------------------------------------------------
  used: integer('used', { mode: 'boolean' })
    .notNull()
    .default(false),

  usedAt: integer('used_at', { mode: 'timestamp_ms' }),

  createdAt: timestampsMs.createdAt,

}, (table) => ({

  // ------------------------------------------------------------------
  // UNIQUE: Single Active Token per User
  // (prevents multiple valid resets simultaneously)
  // ------------------------------------------------------------------
  singleActiveTokenUnique: uniqueIndex('idx_pwd_reset_single_active')
    .on(table.userId)
    .where(sql`
      ${table.used} = 0
    `),

  // ------------------------------------------------------------------
  // Lookup by token
  // ------------------------------------------------------------------
  tokenIdx: index('idx_pwd_reset_token_hash')
    .on(table.tokenHash),

  // ------------------------------------------------------------------
  // Cleanup expired tokens efficiently
  // ------------------------------------------------------------------
  expiresIdx: index('idx_pwd_reset_expires')
    .on(table.expiresAt),

  // ------------------------------------------------------------------
  // CHECK CONSTRAINTS (INTEGRITY HARDENING)
  // ------------------------------------------------------------------

  // Token hash must look like SHA-256 (64 hex chars)
  tokenHashLengthCheck: check(
    'chk_pwd_reset_token_hash_length',
    sql`length(${table.tokenHash}) >= 64`
  ),

  // Expiration must be after creation
  expirationAfterCreation: check(
    'chk_pwd_reset_exp_after_creation',
    sql`${table.expiresAt} > ${table.createdAt}`
  ),

  // If used = true, usedAt must exist
  usedRequiresTimestamp: check(
    'chk_pwd_reset_used_requires_timestamp',
    sql`
      (${table.used} = 0 AND ${table.usedAt} IS NULL)
      OR
      (${table.used} = 1 AND ${table.usedAt} IS NOT NULL)
    `
  ),

  // usedAt cannot be before creation
  usedAfterCreation: check(
    'chk_pwd_reset_used_after_creation',
    sql`
      ${table.usedAt} IS NULL
      OR
      ${table.usedAt} >= ${table.createdAt}
    `
  ),

  // IP length safety (IPv4 + IPv6)
  ipLengthCheck: check(
    'chk_pwd_reset_ip_length',
    sql`
      ${table.ipAddress} IS NULL
      OR
      length(${table.ipAddress}) <= 45
    `
  ),

  // UserAgent sanity limit
  userAgentLengthCheck: check(
    'chk_pwd_reset_user_agent_length',
    sql`
      ${table.userAgent} IS NULL
      OR
      length(${table.userAgent}) <= 500
    `
  ),

}));

// ======================================================================
// === 4. WALLETS (Web3 Institutional Grade)
// ======================================================================

export const wallets = sqliteTable('wallets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // ------------------------------------------------------------------
  // Ownership
  // ------------------------------------------------------------------
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // ------------------------------------------------------------------
  // Blockchain Identity
  // ------------------------------------------------------------------

  // Endereço original (checksum preservado para exibição)
  address: text('address').notNull(),

  // Endereço normalizado (lowercase) para lookup e unique
  addressNormalized: text('address_normalized').notNull(),

  // Chain EVM ID (1 = Ethereum, 137 = Polygon, etc.)
  chainId: integer('chain_id').notNull(),

  // Wallet primária do usuário
  isPrimary: integer('is_primary', { mode: 'boolean' })
    .notNull()
    .default(false),

  // Controle de concorrência otimista
  version: integer('version')
    .notNull()
    .default(1),

  ...timestampsMs,

}, (table) => ({

  // ------------------------------------------------------------------
  // 🔐 UNIQUE STRATEGY
  // ------------------------------------------------------------------

  // Garante unicidade real multi-chain usando endereço normalizado
  addressChainUnique: uniqueIndex('idx_wallet_address_chain_unique')
    .on(table.addressNormalized, table.chainId),

  // Apenas uma wallet primária ativa por usuário
  primaryWalletUnique: uniqueIndex('idx_wallet_primary_active_unique')
    .on(table.userId)
    .where(sql`
      ${table.isPrimary} = 1
      AND ${table.deletedAt} IS NULL
    `),

  // ------------------------------------------------------------------
  // ⚡ PERFORMANCE INDEXES
  // ------------------------------------------------------------------

  // Lookup rápido por usuário (wallets ativas)
  userActiveIdx: index('idx_wallet_user_active')
    .on(table.userId)
    .where(sql`${table.deletedAt} IS NULL`),

  // Lookup rápido por address (ex: login via wallet)
  addressLookupIdx: index('idx_wallet_address_lookup')
    .on(table.addressNormalized),

  // Chain-based analytics
  chainIdx: index('idx_wallet_chain')
    .on(table.chainId),

  // ------------------------------------------------------------------
  // 🛡 DOMAIN CONSTRAINTS
  // ------------------------------------------------------------------

  // ChainId deve ser positivo
  chainPositiveCheck: check(
    'chk_wallet_chain_positive',
    sql`${table.chainId} > 0`
  ),

  // Endereço EVM deve ter 42 caracteres (0x + 40 hex)
  addressLengthCheck: check(
    'chk_wallet_address_len',
    sql`length(${table.address}) = 42`
  ),

  // Normalizado também deve ter 42
  addressNormalizedLengthCheck: check(
    'chk_wallet_address_normalized_len',
    sql`length(${table.addressNormalized}) = 42`
  ),

  // Impede version negativa
  versionCheck: check(
    'chk_wallet_version_positive',
    sql`${table.version} > 0`
  ),
}));

// ======================================================================
// === 5. TAGS (Scalable & SEO-Ready)
// ======================================================================

export const tags = sqliteTable('tags', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Nome visível da tag
  name: text('name')
    .notNull(),

  // Slug original (para exibição/SEO)
  slug: text('slug')
    .notNull(),

  // Slug normalizado (lowercase, sem espaços)
  slugNormalized: text('slug_normalized')
    .notNull(),

  // Contador de uso (denormalização para ranking)
  usageCount: integer('usage_count')
    .notNull()
    .default(0),

  // Hierarquia opcional (tag pai)
  parentId: text('parent_id')
    .references((): AnySQLiteColumn => tags.id, { onDelete: 'set null' }),

  // Controle de concorrência otimista
  version: integer('version')
    .notNull()
    .default(1),

  ...timestampsMs,

}, (table) => ({

  // ------------------------------------------------------------------
  // 🔐 UNIQUE STRATEGY
  // ------------------------------------------------------------------

  // Slug único apenas entre tags ativas
  slugActiveUnique: uniqueIndex('idx_tags_slug_active_unique')
    .on(table.slugNormalized)
    .where(sql`${table.deletedAt} IS NULL`),

  // ------------------------------------------------------------------
  // ⚡ PERFORMANCE INDEXES
  // ------------------------------------------------------------------

  // Busca por nome (admin / painel)
  nameIdx: index('idx_tags_name')
    .on(table.name),

  // Ranking por uso
  usageIdx: index('idx_tags_usage')
    .on(table.usageCount),

  // Hierarquia
  parentIdx: index('idx_tags_parent')
    .on(table.parentId),

  // ------------------------------------------------------------------
  // 🛡 DOMAIN CONSTRAINTS
  // ------------------------------------------------------------------

  // Nome mínimo 2 caracteres
  nameLengthCheck: check(
    'chk_tags_name_len',
    sql`length(${table.name}) >= 2`
  ),

  // Slug mínimo 2 caracteres
  slugLengthCheck: check(
    'chk_tags_slug_len',
    sql`length(${table.slug}) >= 2`
  ),

  // Slug normalizado apenas lowercase, números e hífen
  slugFormatCheck: check(
    'chk_tags_slug_format',
    sql`${table.slugNormalized} GLOB '[a-z0-9-]*'`
  ),

  // Usage nunca negativo
  usageNonNegativeCheck: check(
    'chk_tags_usage_non_negative',
    sql`${table.usageCount} >= 0`
  ),

  // Version sempre positiva
  versionPositiveCheck: check(
    'chk_tags_version_positive',
    sql`${table.version} > 0`
  ),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  parent: one(tags, {
    fields: [tags.parentId],
    references: [tags.id],
    relationName: 'parent_tag_hierarchy'
  }),
  children: many(tags, {
    relationName: 'parent_tag_hierarchy'
  }),
  posts: many(posts),
}));

// ======================================================================
// === 6. POSTS (Cold Layer - Feed Optimized)
// ======================================================================

export const posts = sqliteTable('posts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // ------------------------------------------------------------------
  // Ownership
  // ------------------------------------------------------------------
  authorId: text('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // ------------------------------------------------------------------
  // Core Content Metadata (Cold)
  // ------------------------------------------------------------------
  title: text('title')
    .notNull(),

  slug: text('slug')
    .notNull(),

  slugNormalized: text('slug_normalized')
    .notNull(),

  description: text('description'),

  // Conteúdo pesado (cold)
  content: text('content')
    .notNull(),

  coverUrl: text('cover_url'),

  // Categoria principal (relacional opcional)
  primaryTagId: text('primary_tag_id')
    .references(() => tags.id, { onDelete: 'set null' }),

  // ------------------------------------------------------------------
  // Publishing State
  // ------------------------------------------------------------------

  status: text('status', {
    enum: ['draft', 'scheduled', 'published', 'archived']
  })
    .notNull()
    .default('draft'),

  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),

  isFeatured: integer('is_featured', { mode: 'boolean' })
    .notNull()
    .default(false),

  timeToRead: integer('time_to_read')
    .notNull()
    .default(5),

  // Controle de concorrência otimista
  version: integer('version')
    .notNull()
    .default(1),

  ...timestampsMs,

}, (table) => ({

  // ------------------------------------------------------------------
  // 🔐 UNIQUE STRATEGY
  // ------------------------------------------------------------------

  slugActiveUnique: uniqueIndex('idx_posts_slug_active_unique')
    .on(table.slugNormalized)
    .where(sql`${table.deletedAt} IS NULL`),

  // ------------------------------------------------------------------
  // ⚡ FEED INDEXES (Critical Path)
  // ------------------------------------------------------------------

  // Feed público principal
  publicFeedIdx: index('idx_posts_public_feed')
    .on(table.status, table.publishedAt, table.createdAt)
    .where(sql`
      ${table.status} = 'published'
      AND ${table.deletedAt} IS NULL
    `),

  // Posts por autor (perfil)
  authorIdx: index('idx_posts_author')
    .on(table.authorId, table.createdAt),

  // Destaques
  featuredIdx: index('idx_posts_featured')
    .on(table.isFeatured, table.publishedAt)
    .where(sql`
      ${table.status} = 'published'
      AND ${table.deletedAt} IS NULL
    `),

  // Categoria (tag principal)
  primaryTagIdx: index('idx_posts_primary_tag')
    .on(table.primaryTagId),

  // ------------------------------------------------------------------
  // 🛡 DOMAIN CONSTRAINTS
  // ------------------------------------------------------------------

  titleLengthCheck: check(
    'chk_posts_title_len',
    sql`length(${table.title}) >= 3`
  ),

  slugLengthCheck: check(
    'chk_posts_slug_len',
    sql`length(${table.slugNormalized}) >= 3`
  ),

  slugFormatCheck: check(
    'chk_posts_slug_format',
    sql`${table.slugNormalized} GLOB '[a-z0-9-]*'`
  ),

  timeToReadCheck: check(
    'chk_posts_time_to_read_positive',
    sql`${table.timeToRead} > 0`
  ),

  versionPositiveCheck: check(
    'chk_posts_version_positive',
    sql`${table.version} > 0`
  ),
}));

// ======================================================================
// === RELATIONS
// ======================================================================

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),

  metrics: one(postMetrics, {
    fields: [posts.id],
    references: [postMetrics.postId],
  }),

  primaryTag: one(tags, {
    fields: [posts.primaryTagId],
    references: [tags.id],
  }),
}));

// ======================================================================
// === 6.1 POST METRICS (HOT-WRITE ISOLATION - Step 1)
// ======================================================================
/**
 * ✅ HIGH-THROUGHPUT ARCHITECTURE
 * Isola contadores voláteis da tabela \`posts\` para:
 * - Evitar lock contention
 * - Reduzir write amplification
 * - Melhorar performance de feed
 * - Permitir recalculo assíncrono de trending
 *
 * Esta tabela representa a camada HOT do sistema.
 */
export const postMetrics = sqliteTable('post_metrics', {
  /**
   * Relação 1:1 com posts
   * Cada post possui exatamente um registro de métricas.
   * Cascade garante consistência ao deletar post.
   */
  postId: text('post_id')
    .primaryKey()
    .references(() => posts.id, { onDelete: 'cascade' }),

  // 🔥 Contadores de alto volume (sempre >= 0)
  totalViews: integer('total_views')
    .notNull()
    .default(0),

  totalShares: integer('total_shares')
    .notNull()
    .default(0),

  totalFavorites: integer('total_favorites')
    .notNull()
    .default(0),

  /**
   * Score pré-calculado via cron/worker
   * Nunca deve ser recalculado em tempo real no request.
   */
  trendingScore: integer('trending_score')
    .notNull()
    .default(0),

  /**
   * Atualizado sempre que métricas forem alteradas
   * Pode ser usado para:
   * - Reprocessamento incremental
   * - Debug
   * - Auditoria
   */
  updatedAt: timestampsMs.updatedAt,

}, (table) => ({

  // 🔎 Índice para ordenação de feed por trending
  trendingIdx: index('idx_post_metrics_trending')
    .on(table.trendingScore),

  // 🔎 Índice para jobs que reprocessam métricas
  updatedIdx: index('idx_post_metrics_updated')
    .on(table.updatedAt),

  // 🔐 Garantias de integridade (nunca negativos)
  viewsPositiveCheck: check(
    'chk_post_metrics_views_positive',
    sql`${table.totalViews} >= 0`
  ),

  sharesPositiveCheck: check(
    'chk_post_metrics_shares_positive',
    sql`${table.totalShares} >= 0`
  ),

  favoritesPositiveCheck: check(
    'chk_post_metrics_favorites_positive',
    sql`${table.totalFavorites} >= 0`
  ),

  trendingPositiveCheck: check(
    'chk_post_metrics_trending_positive',
    sql`${table.trendingScore} >= 0`
  ),

}));

// ======================================================================
// === 6.2 FEED SNAPSHOTS (SCALING LAYER - ENTERPRISE READY)
// ======================================================================
/**
 * ✅ O(1) READS
 * ✅ Snapshot único por tipo
 * ✅ Versionamento de payload
 * ✅ Controle de expiração
 * ✅ Estrutura preparada para multi-ambiente
 */

export const feedSnapshots = sqliteTable('feed_snapshots', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // ENUM forte evita feedTypes arbitrários
  feedType: text('feed_type', {
    enum: ['trending', 'recent', 'weekly_top', 'recommended'],
  }).notNull(),

  // Versão do formato do payload (permite evolução futura sem quebrar leitura)
  version: integer('version').notNull().default(1),

  // JSON tipado - sempre array serializado
  dataPayload: text('data_payload', { mode: 'json' }).notNull(),

  // Quando foi gerado
  generatedAt: integer('generated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),

  // Controle explícito de expiração (evita stale feed)
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),

}, (table) => ({
  // 🔥 Garante apenas 1 snapshot ativo por tipo
  feedTypeUnique: uniqueIndex('idx_feed_snapshot_type_unique')
    .on(table.feedType),

  // ⚡ Busca direta por tipo (lookup O(log n))
  feedTypeIdx: index('idx_feed_snapshot_type')
    .on(table.feedType),

  // 🧠 Evita versões inválidas
  versionCheck: check(
    'chk_feed_snapshot_version_positive',
    sql`${table.version} > 0`
  ),

}));

// ======================================================================
// === 7. CONTRACTS (RWA) – HARDENED FINANCIAL VERSION
// ======================================================================

export const contracts = sqliteTable('contracts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  description: text('description').notNull(),

  /**
   * WEB3 SAFE NUMERIC STORAGE
   * Armazenado como string para suportar uint256.
   * Validado via CHECK constraint (somente números positivos).
   */
  totalValue: text('total_value')
    .notNull()
    .$type<string>(),

  currency: text('currency', {
    enum: ['BRL', 'USD', 'USDT'],
  })
    .notNull()
    .default('BRL'),

  totalInstallments: integer('total_installments')
    .notNull()
    .default(1),

  installmentsPaid: integer('installments_paid')
    .notNull()
    .default(0),

  nextDueAt: integer('next_due_at', { mode: 'timestamp_ms' }),

  /**
   * OPTIMISTIC LOCKING
   */
  version: integer('version')
    .notNull()
    .default(1),

  status: text('status', {
    enum: ['active', 'completed', 'defaulted', 'archived'],
  })
    .notNull()
    .default('active'),

  ...timestampsMs,

}, (table) => ({

  // ============================================================
  // INDEXES
  // ============================================================

  userStatusIdx:
    index('idx_contracts_user_status')
      .on(table.userId, table.status),

  /**
   * Cobrança automática / cron job:
   * SELECT * FROM contracts
   * WHERE status = 'active'
   * AND next_due_at <= now()
   */
  dueDateIdx:
    index('idx_contracts_due_active')
      .on(table.status, table.nextDueAt)
      .where(sql`${table.status} = 'active'`),

  // ============================================================
  // FINANCIAL INTEGRITY CONSTRAINTS
  // ============================================================

  totalValueNumericCheck:
    check(
      'chk_contracts_total_value_numeric',
      sql`${table.totalValue} GLOB '[0-9]*' AND length(${table.totalValue}) > 0`
    ),

  totalInstallmentsCheck:
    check(
      'chk_contracts_installments_positive',
      sql`${table.totalInstallments} >= 1`
    ),

  installmentsPaidCheck:
    check(
      'chk_contracts_installments_paid_valid',
      sql`
        ${table.installmentsPaid} >= 0
        AND ${table.installmentsPaid} <= ${table.totalInstallments}
      `
    ),

  versionCheck:
    check(
      'chk_contracts_version_positive',
      sql`${table.version} >= 1`
    ),
}));

// ============================================================
// RELATIONS
// ============================================================

export const contractsRelations = relations(contracts, ({ one }) => ({
  user: one(users, {
    fields: [contracts.userId],
    references: [users.id],
  }),
}));

// ======================================================================
// === 8. AUDIT LOGS – FORENSIC HARDENED VERSION
// ======================================================================

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  /**
   * Actor principal (pode ser userId, apiKeyId, systemId)
   */
  actorId: text('actor_id').notNull(),

  actorType: text('actor_type', {
    enum: ['user', 'system', 'api_key'],
  })
    .notNull()
    .default('user'),

  /**
   * FK real para users (se aplicável)
   * Não deleta log se usuário for removido.
   */
  actorUserId: text('actor_user_id')
    .references(() => users.id, { onDelete: 'set null' }),

  action: text('action').notNull(),

  status: text('status', {
    enum: ['success', 'fail', 'blocked'],
  })
    .notNull()
    .default('success'),

  entityType: text('entity_type'),
  entityId: text('entity_id'),

  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  /**
   * JSON controlado
   */
  metadata: text('metadata', { mode: 'json' })
    .$type<Record<string, unknown>>(),

  /**
   * Anti-tampering chain
   */
  previousHash: text('previous_hash'),
  currentHash: text('current_hash'),

  createdAt: timestampsMs.createdAt,

}, (table) => ({

  // ============================================================
  // INDEXES
  // ============================================================

  actorTimelineIdx:
    index('idx_audit_actor_timeline')
      .on(table.actorId, table.createdAt),

  entityTimelineIdx:
    index('idx_audit_entity_timeline')
      .on(table.entityType, table.entityId, table.createdAt),

  statusIdx:
    index('idx_audit_status')
      .on(table.status, table.createdAt),

  // ============================================================
  // CONSTRAINTS
  // ============================================================

  actionNotEmpty:
    check(
      'chk_audit_action_not_empty',
      sql`length(${table.action}) > 0`
    ),

  metadataSizeLimit:
    check(
      'chk_audit_metadata_size',
      sql`${table.metadata} IS NULL OR length(${table.metadata}) <= 5000`
    ),

  ipLengthCheck:
    check(
      'chk_audit_ip_length',
      sql`${table.ipAddress} IS NULL OR length(${table.ipAddress}) <= 45`
    ),

  hashIntegrityCheck:
    check(
      'chk_audit_hash_integrity',
      sql`${table.currentHash} IS NULL OR length(${table.currentHash}) >= 32`
    ),
}));
