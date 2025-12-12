import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// Esta função transforma o banco cru (D1Database) em um banco inteligente (Drizzle)
// Permite que você faça: db.query.users.findMany()
export const createDb = (d1: D1Database) => {
  return drizzle(d1, { schema });
};

// Tipo utilitário para usarmos em outros lugares se precisar
export type Database = ReturnType<typeof createDb>;