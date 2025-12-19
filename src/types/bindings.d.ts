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
import { D1Database, R2Bucket, Fetcher, KVNamespace } from "@cloudflare/workers-types";

export type Bindings = {
  // 1. Banco de Dados (D1)
  DB: D1Database;

  // 2. Armazenamento de Arquivos (R2)
  STORAGE: R2Bucket;

  // 3. Arquivos Estáticos (Pasta Public)
  ASSETS: Fetcher;

  // 4. Armazenamento de Chave-Valor (KV)
  KV_AUTH: KVNamespace;
  KV_CACHE: KVNamespace;

  // 5. Variáveis de Ambiente e Segredos
  JWT_SECRET: string;
  ZERO_EX_API_KEY: string;
  MORALIS_API_KEY: string;

  // 6. Variáveis do Cloudflare Analytics
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};