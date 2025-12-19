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
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// Esta função transforma o banco cru (D1Database) em um banco inteligente (Drizzle)
// Permite que você faça: db.query.users.findMany()
export const createDb = (d1: D1Database) => {
  return drizzle(d1, { schema });
};

// Tipo utilitário para usarmos em outros lugares se precisar
export type Database = ReturnType<typeof createDb>;