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