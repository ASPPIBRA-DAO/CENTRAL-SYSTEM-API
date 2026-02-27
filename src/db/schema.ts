/**
 * Copyright 2026 ASPPIBRA
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Database Schema (Drizzle ORM + SQLite D1)
 * Version: 10.0.0 (Absolute Enterprise 10/10)
 *
 * ======================================================================
 * MIGRATION NOTES (D1) — OBRIGATÓRIO APLICAR VIA SQL
 * ======================================================================
 *
 * 1️⃣ TRIGGERS updated_at (Loop Protected)
 *
 * CREATE TRIGGER trg_users_updated_at AFTER UPDATE ON users FOR EACH ROW
 * WHEN OLD.updated_at = NEW.updated_at -- Only trigger if app didn't update it
 * BEGIN UPDATE users SET updated_at = strftime('%s','now') WHERE id = NEW.id; END;
 *
 * CREATE TRIGGER trg_posts_updated_at AFTER UPDATE ON posts FOR EACH ROW
 * WHEN OLD.updated_at = NEW.updated_at
 * BEGIN UPDATE posts SET updated_at = strftime('%s','now') WHERE id = NEW.id; END;
 *
 * CREATE TRIGGER trg_contracts_updated_at AFTER UPDATE ON contracts FOR EACH ROW
 * WHEN OLD.updated_at = NEW.updated_at
 * BEGIN UPDATE contracts SET updated_at = strftime('%s','now') WHERE id = NEW.id; END;
 *
 * ----------------------------------------------------------------------
 * 2️⃣ EMAIL LOWERCASE CHECK
 *
 * ALTER TABLE users ADD CONSTRAINT chk_email_lower CHECK (email_normalized = lower(email));
 *
 * ----------------------------------------------------------------------
 * ✔ wrangler d1 migrations apply <DB>
 */

import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, check } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ======================================================================
// === HELPERS ===
// ======================================================================

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  
  // ✅ CONSISTENCY: Update handled solely by SQL Trigger
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(strftime('%s','now'))`),
    
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
};

// ======================================================================
// === 1. USERS ===
// ======================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  
  email: text('email').notNull(),

  /**
   * ✅ SECURITY: Normalized Email
   * Consistency enforced via CHECK constraint.
   */
  emailNormalized: text('email_normalized').notNull(),

  passwordHash: text('password_hash').notNull(),
  passwordUpdatedAt: integer('password_updated_at', { mode: 'timestamp' }),

  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),
  avatarUrl: text('avatar_url'),

  // 🔒 SECURITY: Renamed to enforce encryption at rest
  mfaSecretEncrypted: text('mfa_secret_encrypted'),
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).default(false),

  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  loginAttempts: integer('login_attempts').default(0),
  lockUntil: integer('lock_until', { mode: 'timestamp' }),

  kycStatus: text('kyc_status', {
    enum: ['none', 'pending', 'approved', 'rejected']
  }).default('none'),

  kycUpdatedAt: integer('kyc_updated_at', { mode: 'timestamp' }),

  role: text('role', {
    enum: ['citizen', 'partner', 'admin', 'system']
  }).default('citizen'),

  ...timestamps,

}, (table) => ({
  roleIdx: index('idx_users_role').on(table.role),
  deletedIdx: index('idx_users_deleted').on(table.deletedAt),
  
  // ✅ PERFORMANCE: Dashboard Activity Sorting
  lastLoginIdx: index('idx_users_last_login').on(table.lastLoginAt),
  lockIdx: index('idx_users_lock').on(table.lockUntil),
  kycIdx: index('idx_users_kyc').on(table.kycStatus),
  mfaIdx: index('idx_users_mfa').on(table.mfaEnabled),

  /**
   * ✅ PERFORMANCE: Optimized Login Query
   */
  loginIdx: index('idx_users_login')
    .on(table.emailNormalized, table.deletedAt),

  /**
   * ✅ NATIVE PARTIAL INDEX: Active Email Unique Constraint
   * Allows reusing emails if the previous account is deleted.
   */
  emailActiveUnique: uniqueIndex('idx_users_email_active_unique')
    .on(table.emailNormalized)
    .where(sql`${table.deletedAt} IS NULL`),
  
  // ✅ CONSISTENCY & SECURITY CHECKS
  pwdHashLenCheck: check('chk_pwd_hash_len', sql`length(${table.passwordHash}) >= 60`),
  loginAttemptsCheck: check('chk_login_attempts', sql`${table.loginAttempts} >= 0`),
  mfaBoolCheck: check('chk_mfa_bool', sql`${table.mfaEnabled} IN (0, 1)`),
  mfaIntegrityCheck: check('chk_mfa_secret', sql`${table.mfaEnabled} = 0 OR ${table.mfaSecretEncrypted} IS NOT NULL`),
  emailVerifiedBoolCheck: check('chk_email_verified_bool', sql`${table.emailVerified} IN (0, 1)`),
  emailLowerCheck: check('chk_email_lower', sql`${table.emailNormalized} = lower(${table.email})`),
  emailFormatCheck: check('chk_email_format', sql`${table.email} LIKE '%_@__%.__%'`),
  
  // ✅ TEMPORAL INTEGRITY
  deletedCreatedCheck: check('chk_users_deleted_created', sql`${table.deletedAt} IS NULL OR ${table.deletedAt} >= ${table.createdAt}`),
}));

// --- RELATIONS ---
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  wallets: many(wallets),
  contracts: many(contracts),
  passwordResets: many(passwordResets),
  favorites: many(postFavorites),
  sessions: many(sessions),
}));

// --- ZOD SCHEMAS ---
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

// ======================================================================
// === 2. SESSIONS ===
// ======================================================================

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }), // ✅ AUDIT: Explicit revocation
  
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  createdAt: timestamps.createdAt,
}, (table) => ({
  userIdx: index('idx_sessions_user').on(table.userId),
  expiresIdx: index('idx_sessions_expires').on(table.expiresAt), // ✅ MAINTENANCE: Cleanup
  
  ipLenCheck: check('chk_ip_len', sql`length(${table.ipAddress}) <= 45`),
  // ✅ TEMPORAL INTEGRITY
  expiresCreatedCheck: check('chk_session_expires_created', sql`${table.expiresAt} > ${table.createdAt}`),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ======================================================================
// === 3. PASSWORD RESETS ===
// ======================================================================

export const passwordResets = sqliteTable('password_resets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  tokenHash: text('token_hash').notNull().unique(),

  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
  usedAt: integer('used_at', { mode: 'timestamp' }), // ✅ AUDIT: Usage timestamp

  createdAt: timestamps.createdAt,

}, (table) => ({
  userIdx: index('idx_pwd_reset_user').on(table.userId),
  expiresIdx: index('idx_pwd_reset_expires').on(table.expiresAt),
  usedIdx: index('idx_pwd_reset_used').on(table.used),
  
  // ✅ INTEGRITY: Expiration must be in the future
  expiresCheck: check('chk_pwd_reset_expires', sql`${table.expiresAt} > ${table.createdAt}`),
  usedBoolCheck: check('chk_pwd_reset_used_bool', sql`${table.used} IN (0, 1)`),
  
  /**
   * ✅ PERFORMANCE: Partial Index for Valid Tokens
   */
  validTokenIdx: index('idx_pwd_reset_valid')
    .on(table.userId)
    .where(sql`${table.used} = 0`),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id],
  }),
}));

// ======================================================================
// === 4. WALLETS ===
// ======================================================================

export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  address: text('address').notNull(),
  chainId: integer('chain_id').notNull(),

  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),

  ...timestamps, 

}, (table) => ({
  userIdx: index('idx_wallets_user').on(table.userId),
  
  // ✅ PERFORMANCE: Standard query for active wallets
  userDeletedIdx: index('idx_wallet_user_deleted').on(table.userId, table.deletedAt),
  deletedIdx: index('idx_wallets_deleted').on(table.deletedAt),
  
  /**
   * ✅ MULTI-CHAIN SUPPORT: Address unique per chain
   */
  addressChainUnique: uniqueIndex('idx_wallet_address_chain')
    .on(table.address, table.chainId),
  
  /**
   * ✅ NATIVE PARTIAL INDEX: One primary wallet per user
   * Ignores soft-deleted wallets.
   */
  primaryWalletUnique: uniqueIndex('idx_wallet_primary')
    .on(table.userId)
    .where(sql`${table.isPrimary} = 1 AND ${table.deletedAt} IS NULL`),
  
  primaryBoolCheck: check('chk_wallet_primary_bool', sql`${table.isPrimary} IN (0, 1)`),
  // ✅ TEMPORAL INTEGRITY
  deletedCreatedCheck: check('chk_wallets_deleted_created', sql`${table.deletedAt} IS NULL OR ${table.deletedAt} >= ${table.createdAt}`),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

// ======================================================================
// === 5. TAGS ===
// ======================================================================

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  
  ...timestamps,
}, (table) => ({
  /**
   * ✅ LIFECYCLE: Reusable Slugs/Names via Partial Index
   */
  slugActiveUnique: uniqueIndex('idx_tags_slug_active')
    .on(table.slug)
    .where(sql`${table.deletedAt} IS NULL`),
  
  nameActiveUnique: uniqueIndex('idx_tags_name_active')
    .on(table.name)
    .where(sql`${table.deletedAt} IS NULL`),
  
  // ✅ TEMPORAL INTEGRITY
  deletedCreatedCheck: check('chk_tags_deleted_created', sql`${table.deletedAt} IS NULL OR ${table.deletedAt} >= ${table.createdAt}`),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postTags),
}));

export const postTags = sqliteTable('post_tags', {
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.tagId] }),
  tagIdx: index('idx_post_tags_tag').on(table.tagId),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

// ======================================================================
// === 6. POSTS ===
// ======================================================================

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  authorId: text('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  title: text('title').notNull(),
  slug: text('slug').notNull(),

  description: text('description'),
  content: text('content').notNull(),

  coverUrl: text('cover_url'),

  category: text('category').default('Geral'),

  totalViews: integer('total_views').default(0),
  totalShares: integer('total_shares').default(0),
  totalFavorites: integer('total_favorites').default(0),

  timeToRead: integer('time_to_read').default(5),

  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
  publish: integer('publish', { mode: 'boolean' }).default(false),

  ...timestamps,

}, (table) => ({
  authorIdx: index('idx_posts_author').on(table.authorId),
  categoryIdx: index('idx_posts_category').on(table.category),
  
  /**
   * ✅ LIFECYCLE: Reusable Slugs via Partial Index
   */
  slugActiveUnique: uniqueIndex('idx_posts_slug_active')
    .on(table.slug)
    .where(sql`${table.deletedAt} IS NULL`),

  /**
   * ✅ PERFORMANCE: Optimized Feed Query (Covers publish + category)
   */
  feedCategoryIdx: index('idx_posts_feed_category')
    .on(table.publish, table.category, table.createdAt),
  
  /**
   * ✅ PERFORMANCE: Full Feed Index (Publish + Deleted + Time)
   */
  feedFullIdx: index('idx_posts_feed_full')
    .on(table.publish, table.deletedAt, table.createdAt),

  /**
   * ✅ PERFORMANCE: Common Query by Author
   */
  authorPublishIdx: index('idx_posts_author_publish')
    .on(table.authorId, table.publish, table.createdAt),
  
  /**
   * ✅ PERFORMANCE: Slug Search with Publish Status
   */
  slugPublishIdx: index('idx_posts_slug_publish').on(table.slug, table.publish),

  feedIdx: index('idx_posts_feed').on(table.publish, table.createdAt),
  deletedIdx: index('idx_posts_deleted').on(table.deletedAt),

  // ✅ CONSISTENCY: Non-negative counters & Boolean checks
  featuredBoolCheck: check('chk_featured_bool', sql`${table.isFeatured} IN (0, 1)`),
  publishBoolCheck: check('chk_publish_bool', sql`${table.publish} IN (0, 1)`),
  
  /**
   * ✅ LIFECYCLE: Prevents deleted posts from being published
   */
  publishDeletedCheck: check('chk_publish_deleted', sql`${table.deletedAt} IS NULL OR ${table.publish} = 0`),

  viewsPosCheck: check('chk_views_pos', sql`${table.totalViews} >= 0`),
  sharesPosCheck: check('chk_shares_pos', sql`${table.totalShares} >= 0`),
  favPosCheck: check('chk_fav_pos', sql`${table.totalFavorites} >= 0`),
  timePosCheck: check('chk_time_pos', sql`${table.timeToRead} > 0`),
  
  // ✅ TEMPORAL INTEGRITY
  deletedCreatedCheck: check('chk_posts_deleted_created', sql`${table.deletedAt} IS NULL OR ${table.deletedAt} >= ${table.createdAt}`),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  favorites: many(postFavorites),
  tags: many(postTags),
}));

// --- POST FAVORITES ---
export const postFavorites = sqliteTable('post_favorites', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  postId: text('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),

  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  createdAt: timestamps.createdAt,

}, (table) => ({
  uniqueIdx: uniqueIndex('unique_post_user_favorite')
    .on(table.postId, table.userId),
  
  userIdx: index('idx_post_fav_user').on(table.userId),
  postIdx: index('idx_post_fav_post').on(table.postId),
}));

export const postFavoritesRelations = relations(postFavorites, ({ one }) => ({
  post: one(posts, {
    fields: [postFavorites.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postFavorites.userId],
    references: [users.id],
  }),
}));

// ======================================================================
// === 7. CONTRACTS (RWA) ===
// ======================================================================

export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  description: text('description').notNull(),

  totalValue: integer('total_value').notNull(), // Cents

  currency: text('currency', {
    enum: ['BRL', 'USD', 'USDT']
  }).default('BRL'),

  totalInstallments: integer('total_installments').default(1),
  
  installmentsPaid: integer('installments_paid').default(0),
  nextDueAt: integer('next_due_at', { mode: 'timestamp' }),

  version: integer('version').default(1),

  status: text('status', {
    enum: ['active', 'completed', 'defaulted', 'archived']
  }).default('active'),

  ...timestamps,

}, (table) => ({
  userIdx: index('idx_contracts_user').on(table.userId),
  statusIdx: index('idx_contracts_status').on(table.status),
  deletedIdx: index('idx_contracts_deleted').on(table.deletedAt),
  userStatusIdx: index('idx_contracts_user_status').on(table.userId, table.status),
  
  dueIdx: index('idx_contracts_due').on(table.status, table.nextDueAt),

  installmentsCheck: check('chk_installments', sql`${table.installmentsPaid} <= ${table.totalInstallments}`),
  valuePosCheck: check('chk_value_pos', sql`${table.totalValue} >= 0`),
  installmentsPaidPosCheck: check('chk_installments_paid_pos', sql`${table.installmentsPaid} >= 0`),
  totalInstallmentsPosCheck: check('chk_total_installments_pos', sql`${table.totalInstallments} > 0`),
  currencyCheck: check('chk_currency', sql`${table.currency} IN ('BRL', 'USD', 'USDT')`),
  
  completedCheck: check('chk_completed_paid', 
    sql`(${table.status} != 'completed') OR (${table.installmentsPaid} = ${table.totalInstallments})`),
  
  completedDueCheck: check('chk_completed_due', sql`(${table.status} != 'completed') OR (${table.nextDueAt} IS NULL)`),
  defaultedDueCheck: check('chk_defaulted_due', sql`(${table.status} != 'defaulted') OR (${table.nextDueAt} IS NOT NULL)`),
  
  // ✅ TEMPORAL INTEGRITY
  deletedCreatedCheck: check('chk_contracts_deleted_created', sql`${table.deletedAt} IS NULL OR ${table.deletedAt} >= ${table.createdAt}`),
  dueCreatedCheck: check('chk_contracts_due_created', sql`${table.nextDueAt} IS NULL OR ${table.nextDueAt} >= ${table.createdAt}`),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  user: one(users, {
    fields: [contracts.userId],
    references: [users.id],
  }),
}));

// ======================================================================
// === 8. AUDIT LOGS ===
// ======================================================================

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  actorId: text('actor_id').notNull(),
  actorType: text('actor_type', { enum: ['user', 'system', 'api_key'] }).default('user'),

  actorUserId: text('actor_user_id')
    .references(() => users.id, { onDelete: 'set null' }),

  action: text('action').notNull(),

  status: text('status', {
    enum: ['success', 'fail', 'blocked']
  }).default('success'),

  entityType: text('entity_type'),
  entityId: text('entity_id'),

  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

  createdAt: timestamps.createdAt,

}, (table) => ({
  actionIdx: index('idx_audit_action').on(table.action),
  actorIdx: index('idx_audit_actor').on(table.actorId),
  
  actorTimelineIdx: index('idx_audit_actor_timeline').on(table.actorId, table.createdAt),
  actorUserIdx: index('idx_audit_actor_user').on(table.actorUserId),
  actorUserTimelineIdx: index('idx_audit_actor_user_time').on(table.actorUserId, table.createdAt),
  
  entityTimeIdx: index('idx_audit_entity_time').on(table.entityType, table.createdAt),

  entityIdx: index('idx_audit_entity').on(table.entityType, table.entityId),
  timeIdx: index('idx_audit_time').on(table.createdAt),

  actorUserCheck: check('chk_audit_user', sql`${table.actorType} != 'user' OR ${table.actorUserId} IS NOT NULL`),
  metadataSizeCheck: check('chk_metadata_size', sql`length(${table.metadata}) <= 5000`),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actorUser: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));