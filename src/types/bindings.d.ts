import { D1Database, R2Bucket, Fetcher } from "@cloudflare/workers-types";

export type Bindings = {
  // 1. Banco de Dados (D1)
  DB: D1Database;

  // 2. Armazenamento de Arquivos (R2)
  // Mudamos de "ASSETS" para "STORAGE" no wrangler.jsonc para liberar o nome "ASSETS".
  STORAGE: R2Bucket;

  // 3. Arquivos Estáticos (Pasta Public)
  // Este é o binding reservado que o Cloudflare cria automaticamente para a configuração "assets".
  ASSETS: Fetcher;

  // 4. Variáveis de Ambiente e Segredos
  JWT_SECRET: string;
  ZERO_EX_API_KEY: string; 
  
  // ✅ ADICIONADO: Chave para a API da Moralis (RWA/Token Data)
  MORALIS_API_KEY: string; 

  // 5. Variáveis do Cloudflare Analytics
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};