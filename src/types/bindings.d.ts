/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Type Definitions for Cloudflare Bindings & Hono Variables
 * Version: 1.1.1 - Strict Sync with AuthProvider & D1 Factory
 */

import { D1Database, R2Bucket, Fetcher, KVNamespace } from "@cloudflare/workers-types";

/**
 * [BINDINGS]
 * Representam os recursos físicos e variáveis de ambiente injetadas pelo Cloudflare.
 * Devem ser espelhados exatamente como definidos no seu wrangler.jsonc.
 */
export type Bindings = {
  // --- Infraestrutura de Dados ---
  DB: D1Database;          // Banco de Dados Principal (Contratos RWA/Usuários)
  STORAGE: R2Bucket;       // Bucket R2 (Documentos e Imagens)
  KV_AUTH: KVNamespace;    // Gestão de Sessões e Tokens de Password Reset
  KV_CACHE: KVNamespace;   // Cache de Performance e Rate Limit

  // --- Assets e Proxy ---
  ASSETS: Fetcher;         // Binding para arquivos estáticos (Frontend Assets)

  // --- Segredos e Chaves de API (Configurados via wrangler secret) ---
  JWT_SECRET: string;
  ZERO_EX_API_KEY: string;
  MORALIS_API_KEY: string;

  // --- Variáveis de Ambiente e Gestão ---
  ENVIRONMENT: 'development' | 'production' | 'staging';
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  NEXT_PUBLIC_HOST_API: string;
};

/**
 * [VARIABLES]
 * Dados injetados no ciclo de vida da requisição (Contexto Hono).
 * Utilizados pelos middlewares requireAuth e Audit para manter a rastreabilidade.
 */
export type Variables = {
  /**
   * Usuário Autenticado:
   * Sincronizado com a interface User do Frontend para garantir que
   * logs de auditoria e permissões de UI coincidam.
   */
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: 'citizen' | 'partner' | 'admin' | 'system';
  };

  /**
   * Instância de Banco Injetada:
   * Referencia o tipo de retorno da sua factory createDb(c.env.DB).
   */
  db: ReturnType<typeof import("../db").createDb>;
};