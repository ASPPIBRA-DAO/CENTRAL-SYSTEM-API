import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Definindo a tabela 'users'
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // === IDENTIDADE (WEB2) ===
  // 🔄 CORREÇÃO: Substituímos 'name' por firstName e lastName
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Hash da senha

  // === IDENTIDADE (WEB3) ===
  walletAddress: text('wallet_address').unique(),
  walletProvider: text('wallet_provider').default('system'), // metamask, phantom, etc
  nonce: text('nonce'), // Para desafios de assinatura (Login com Carteira)

  // === CONTROLE DE ACESSO ===
  credentialStatus: text('credential_status').default('pending'), 
  credentialId: text('credential_id'),
  credentialIssuedAt: integer('credential_issued_at', { mode: 'timestamp' }),

  // === PODER DE VOTO ===
  votingPower: integer('voting_power').default(0), 
  tokenBalanceSyncedAt: integer('token_balance_synced_at', { mode: 'timestamp' }),

  // === COMPLIANCE ===
  termsAcceptedAt: integer('terms_accepted_at', { mode: 'timestamp' }),
  role: text('role').default('citizen'), // Mudei default para 'citizen' (mais adequado ao Gov)

  // === AUDITORIA ===
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    emailIdx: index('idx_users_email').on(table.email),
    walletIdx: index('idx_users_wallet').on(table.walletAddress),
    credentialIdx: index('idx_users_credential').on(table.credentialStatus),
  };
});