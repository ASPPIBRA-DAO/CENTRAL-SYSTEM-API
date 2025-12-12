import { D1Database, R2Bucket, Fetcher } from "@cloudflare/workers-types";

export type Bindings = {
  // 1. Banco de Dados (D1)
  DB: D1Database;

  // 2. Armazenamento de Arquivos (R2) - RENOMEADO
  // Mudamos de "ASSETS" para "STORAGE" no wrangler.jsonc para liberar o nome "ASSETS".
  STORAGE: R2Bucket;

  // 3. Arquivos Estáticos (Pasta Public) - NOVO TIPO
  // Este é o binding reservado que o Cloudflare cria automaticamente para a configuração "assets".
  // Ele é do tipo 'Fetcher', não 'R2Bucket'.
  ASSETS: Fetcher;

  // 4. Variáveis de Ambiente e Segredos
  JWT_SECRET: string;

  // 5. Variáveis do Cloudflare Analytics
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};