/**
 * Copyright 2025 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Database Connection Factory (Drizzle ORM + D1)
 * Version: 1.2.0 - Enhanced Factory with Debugging Support
 */

import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Interface estendida para configurações da Factory.
 * Permite o controle de logs e comportamentos de depuração.
 */
interface DbOptions {
  logger?: boolean;
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
 * @returns Instância do Drizzle configurada com o Schema ASPPIBRA
 */
export const createDb = (d1: D1Database, options: DbOptions = {}) => {
  return drizzle(d1, { 
    schema, 
    // Ativa o logger para visualizar as queries SQL no console do Wrangler (útil em dev)
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