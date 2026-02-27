/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Database Connection Factory (Drizzle ORM + D1)
 * Version: 2.0.0 - Production Hardened
 */

import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { Logger } from 'drizzle-orm/logger';
import * as schema from './schema';

/**
 * Interface estendida para configurações da Factory.
 * Permite o controle de logs (boolean ou custom Logger) e comportamentos de depuração.
 */
export interface DbOptions {
  logger?: boolean | Logger;
}

/**
 * Factory para instanciar a conexão com o Cloudflare D1 através do Drizzle ORM.
 * * DESIGN PATTERN: Factory Function.
 * Por que não uma instância global? 
 * No Cloudflare Workers, o binding 'env.DB' só é acessível dentro do ciclo de vida 
 * de uma requisição (fetch handler). Esta função permite criar a instância no 
 * momento exato em que o Hono recebe o contexto.
 * * @param d1 - O binding nativo do D1Database (c.env.DB)
 * @param options - Configurações opcionais como ativação de logs SQL
 * @throws Error se o binding D1 não for fornecido (segurança em runtime)
 * @returns Instância do Drizzle configurada com o Schema ASPPIBRA
 */
export const createDb = (d1: D1Database, options: DbOptions = {}) => {
  // ✅ SAFETY: Fail fast if D1 binding is undefined (common config error)
  if (!d1) {
    throw new Error('❌ FATAL: D1 Binding is missing. Check your wrangler.toml [[d1_databases]] config.');
  }

  return drizzle(d1, { 
    schema, 
    // Ativa o logger para visualizar as queries SQL ou usa um logger customizado (ex: Datadog)
    logger: options.logger ?? false 
  });
};

/**
 * Exportação de Tipo Global para injeção de dependência.
 * Essencial para tipar o Middleware do Hono e garantir Autocomplete em:
 * const db = c.get('db');
 * * O uso do 'typeof schema' vincula automaticamente todas as tabelas, relações 
 * e novas colunas (como deletedAt e auditLogs) ao objeto de banco de dados.
 */
export type Database = DrizzleD1Database<typeof schema>;