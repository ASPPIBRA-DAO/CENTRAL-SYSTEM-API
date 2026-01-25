/**
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Type Definitions for Cloudflare Bindings & Hono Variables
 * Version: 1.1.0
 */
import { D1Database, R2Bucket, Fetcher, KVNamespace } from "@cloudflare/workers-types";

/**
 * Bindings: Representam os recursos externos da Cloudflare definidos no wrangler.toml
 */
export type Bindings = {
  // 1. Banco de Dados (D1) - Onde residem os usuários e contratos
  DB: D1Database;

  // 2. Armazenamento de Arquivos (R2) - Para imagens de capa e documentos
  STORAGE: R2Bucket;

  // 3. Arquivos Estáticos - Gerenciados pelo Cloudflare Pages/Workers Assets
  ASSETS: Fetcher;

  // 4. Armazenamento de Chave-Valor (KV)
  KV_AUTH: KVNamespace;
  KV_CACHE: KVNamespace;

  // 5. Segredos e Chaves de API
  JWT_SECRET: string;
  ZERO_EX_API_KEY: string;
  MORALIS_API_KEY: string;

  // 6. Analytics e Gestão Cloudflare
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};

/**
 * Variables: Representam os dados injetados no contexto da requisição (c.set / c.get)
 * Essencial para o funcionamento do requireAuth e das rotas protegidas.
 */
export type Variables = {
  user: {
    id: number;
    email: string;
    role: 'citizen' | 'partner' | 'admin' | 'system';
  };
  // Instância do banco injetada no middleware global
  db: import("../db").Database; 
};