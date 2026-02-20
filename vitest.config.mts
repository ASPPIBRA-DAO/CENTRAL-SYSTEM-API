/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Vitest Configuration (Cloudflare Pool Workers)
 * Version: 1.3.3 - Drizzle Schema Sync & Stream Optimization
 */

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    /**
     * [1] GESTÃO DE TIMEOUTS
     * 30s é o ideal para permitir que o Miniflare processe as 7 tabelas 
     * (users, posts, wallets, etc) no banco D1 simulado.
     */
    testTimeout: 30000,
    hookTimeout: 30000,

    /**
     * [2] POOL DE WORKERS (Cloudflare Pool)
     */
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          /**
           * 🟢 RESOLUÇÃO DEFINITIVA DO ERRO 500:
           * databaseNames: Deve ser identico ao binding no wrangler.jsonc.
           * databaseMigrationDirectories: Aponta para a pasta onde o 
           * drizzle-kit gerou os arquivos .sql.
           */
          databaseNames: ["DB"],
          databaseMigrationDirectories: ["./drizzle"], // 👈 Ajustado para o padrão Drizzle
          
          // Mapeamento de persistência de estado para Auth e RWA
          kvNamespaces: ["KV_CACHE", "KV_AUTH"],
          r2Buckets: ["STORAGE"],
          
          // Configurações de Compatibilidade (Runtime 2026)
          compatibilityDate: "2025-09-06",
          compatibilityFlags: ["nodejs_compat"],
        }
      },
    },

    /**
     * [3] CONFIGURAÇÕES DE EXECUÇÃO
     * isolate: true -> Garante que o banco inicie do zero para cada suite.
     * globals: true -> Disponibiliza 'describe' e 'test' globalmente.
     */
    isolate: true, 
    globals: true,
    
    /**
     * environment: 'node' é necessário para bibliotecas como bcrypt/jose,
     * mas o pool de workers injeta as APIs da Cloudflare automaticamente.
     */
    environment: 'node', 

    include: ['test/**/*.{test,spec}.ts'],

    /**
     * [4] OTIMIZAÇÃO DE DEPENDÊNCIAS
     * Resolve o erro "Can't read from request stream" ao garantir que
     * as APIs de Web (Request/Response) sejam tratadas nativamente.
     */
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
      },
    },
  },
});