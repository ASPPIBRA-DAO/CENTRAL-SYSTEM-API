# 🕵️ RELATÓRIO DE ARQUITETURA - GOVERNANCE SYSTEM
**Data:** 12/19/2025, 9:57:49 PM
**Natureza Detectada:** Backend (Cloudflare Worker / Hono)
**Diretório:** `/home/user/CENTRAL-SYSTEM-API`

---

## 🏗️ ESTADO DA TECNOLOGIA
- **Banco de Dados (Drizzle):** ✅ Implementado
- **Autenticação/Segurança:** 🛡️ Configurada
- **Infraestrutura Cloudflare:** ☁️ Ativa (Worker/D1/R2)
- **Interface Frontend:** 🔌 Somente API

---

## 🌳 ESTRUTURA DE DIRETÓRIOS
```text
├── .dev.vars\n├── .editorconfig\n├── .gitignore\n├── .prettierrc\n├── .wrangler/\n│   ├── state/\n│   │   └── v3/\n│   │       ├── cache/\n│   │       │   └── miniflare-CacheObject/\n│   │       │       └── ... (limite de profundidade)\n│   │       ├── d1/\n│   │       │   └── miniflare-D1DatabaseObject/\n│   │       │       └── ... (limite de profundidade)\n│   │       ├── kv/\n│   │       │   ├── bd8db7b5217e42e49fb65e611b28ce74/\n│   │       │   │   └── ... (limite de profundidade)\n│   │       │   └── miniflare-KVNamespaceObject/\n│   │       │       └── ... (limite de profundidade)\n│   │       ├── r2/\n│   │       │   └── miniflare-R2BucketObject/\n│   │       │       └── ... (limite de profundidade)\n│   │       └── workflows/\n│   └── tmp/\n├── LICENSE\n├── README.md\n├── drizzle.config.ts\n├── package.json\n├── pnpm-lock.yaml\n├── public/\n│   ├── css/\n│   │   └── style.css\n│   ├── favicon.ico\n│   ├── icons/\n│   │   ├── android-chrome-192x192.png\n│   │   ├── android-chrome-512x512.png\n│   │   ├── apple-touch-icon.png\n│   │   ├── favicon-16x16.png\n│   │   └── favicon-32x32.png\n│   ├── img/\n│   │   └── social-preview.png\n│   ├── js/\n│   │   └── dashboard.js\n│   ├── robots.txt\n│   ├── site.webmanifest\n│   └── sitemap.xml\n├── scripts/\n│   ├── audit-project.js\n│   ├── build-seo.mjs\n│   ├── cloudflare-analytics.js\n│   └── fetch-ids.js\n├── src/\n│   ├── db/\n│   │   ├── index.ts\n│   │   └── schema.ts\n│   ├── index.ts\n│   ├── middlewares/\n│   │   ├── auth-jwt.ts\n│   │   └── rate-limit.ts\n│   ├── routes/\n│   │   ├── core/\n│   │   │   ├── auth/\n│   │   │   │   ├── index.ts\n│   │   │   │   ├── password.ts\n│   │   │   │   └── session.ts\n│   │   │   ├── health.ts\n│   │   │   └── webhooks.ts\n│   │   ├── platform/\n│   │   │   ├── payments.ts\n│   │   │   └── storage.ts\n│   │   └── products/\n│   │       ├── agro/\n│   │       │   └── index.ts\n│   │       ├── posts/\n│   │       │   └── index.ts\n│   │       └── rwa/\n│   │           └── index.ts\n│   ├── services/\n│   │   ├── audit.ts\n│   │   ├── auth.ts\n│   │   ├── email.ts\n│   │   └── market.ts\n│   ├── types/\n│   │   ├── bindings.d.ts\n│   │   └── manifest.d.ts\n│   ├── utils/\n│   │   ├── auth-guard.ts\n│   │   └── response.ts\n│   ├── validators/\n│   │   └── auth.ts\n│   └── views/\n│       └── dashboard.ts\n├── test/\n│   ├── env.d.ts\n│   ├── index.spec.ts\n│   └── tsconfig.json\n├── tsconfig.json\n├── vitest.config.mts\n├── worker-configuration.d.ts\n└── wrangler.jsonc\n
```

\n## ⚙️ ANÁLISE DE CONFIGURAÇÃO\n### ✅ package.json\n```json\n{
    "name": "gov-system-backend",
    "version": "0.0.0",
    "private": true,
    "scripts": {
        "test": "vitest",
        "dev": "wrangler dev",
        "build": "pnpm run build:seo",
        "build:seo": "node scripts/build-seo.mjs",
        "deploy": "pnpm run build:seo && wrangler deploy",
        "cf-typegen": "wrangler types"
    },
    "devDependencies": {
        "@cloudflare/vitest-pool-workers": "^0.8.19",
        "@cloudflare/workers-types": "^4.20251217.0",
        "@types/bcryptjs": "^3.0.0",
        "@types/jsonwebtoken": "^9.0.10",
        "@types/qrcode": "^1.5.6",
        "dotenv": "^17.2.3",
        "drizzle-kit": "^0.31.8",
        "typescript": "^5.5.2",
        "vitest": "~3.2.0",
        "wrangler": "^4.52.1"
    },
    "dependencies": {
        "@aws-sdk/client-s3": "^3.946.0",
        "@hono/zod-validator": "^0.7.5",
        "argon2": "^0.40.3",
        "drizzle-orm": "^0.44.7",
        "hono": "^4.10.7",
        "jsonwebtoken": "^9.0.3",
        "otplib": "^12.0.1",
        "qrcode": "^1.5.4",
        "siwe": "^3.0.0",
        "viem": "^2.42.1",
        "zod": "^4.1.13"
    }
}\n```\n### ✅ tsconfig.json\n```json\n{
	"compilerOptions": {
		/* Visit https://aka.ms/tsconfig.json to read more about this file */

    /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
		"target": "es2021",
    /* Specify a set of bundled library declaration files that describe the target runtime environment. */
		"lib": ["es2021"],
    /* Specify what JSX code is generated. */
		"jsx": "react-jsx",

    /* Specify what module code is generated. */
		"module": "es2022",
    /* Specify how TypeScript looks up a file from a given module specifier. */
		"moduleResolution": "Bundler",
    /* Enable importing .json files */
		"resolveJsonModule": true,

    /* Allow JavaScript files to be a part of your program. Use the `checkJS` option to get errors from these files. */
		"allowJs": true,
    /* Enable error reporting in type-checked JavaScript files. */
		"checkJs": false,

    /* Disable emitting files from a compilation. */
		"noEmit": true,

    /* Ensure that each file can be safely transpiled without relying on other imports. */
		"isolatedModules": true,
    /* Allow 'import x from y' when a module doesn't have a default export. */
		"allowSyntheticDefaultImports": true,
    /* Ensure that casing is correct in imports. */
		"forceConsistentCasingInFileNames": true,

    /* Enable all strict type-checking options. */
		"strict": true,

    /* Skip type checking all .d.ts files. */
		"skipLibCheck": true,
		"types": [
			"./worker-configuration.d.ts\n... (truncado)\n```\n### ✅ README.md\n```json\n# 🚀 Governance System: Identidade e Governança Institucional

![Project Status](https://img.shields.io/badge/status-active_development-yellow)
![Version](https://img.shields.io/badge/version-v1.2.0-blue)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

![Edge Computing](https://img.shields.io/badge/edge-Cloudflare_Workers-orange)
![D1 Database](https://img.shields.io/badge/persistence-Cloudflare_D1-blue)
![Workers KV](https://img.shields.io/badge/cache-Workers_KV-orange)
![R2 Storage](https://img.shields.io/badge/storage-Cloudflare_R2-darkblue)
![IPFS Decentralized](https://img.shields.io/badge/decentralized-IPFS-7b78e8)

O Governance System é uma plataforma de governança institucional e identidade digital, projetada para operar em cenários de DAO, Web3 e RWA (Real World Assets).

---

## 📑 Índice da Documentação

* **1. Introdução**
    * [1.1. Governance System](#11-governance-system)
    * [1.2. Objetivo do Projeto](#12-objetivo-do-projeto)
    * [1.3. Contextos de Uso](#13-contextos-de-uso)
* **2. Visão Geral do Sistema**
    * [2.1. Princípios de Design](#21-princípios-de-design)
    * [2.2. Escopo Institucional](#22-escopo-institucional)
    * [2.3. Execução em Edge Computing](#23-execução-em-edge-computing)
* **3. Arquitetura Geral**
    * [3.1. Padrão Arquitetural](#31-padrão-arquitetural)
    * [3.2. Separação de Camadas](#32-separação-de-camadas)
* **4. Stack Tecnológica**
    * [4.\n... (truncado)\n```\n### ✅ .gitignore\n```json\n# ------------------------------------------------------
# 🔒 ARQUIVOS DE CONFIGURAÇÃO SENSÍVEIS (BLOQUEADOS)
# ------------------------------------------------------
# Contém Account ID, Zone ID e KV IDs. 
# O usuário optou por não versionar.
wrangler.jsonc
wrangler.toml

# Segredos e Variáveis de Ambiente (CRÍTICO - NUNCA REMOVA)
.dev.vars
.dev.vars.*
.env
.env.*
*.pem
*.key

# ------------------------------------------------------
# ⚡ Cloudflare Workers
# ------------------------------------------------------
.wrangler/
.mf/

# ------------------------------------------------------
# 📦 Dependências & Node.js
# ------------------------------------------------------
node_modules/
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
.pnpm-store/

# ------------------------------------------------------
# 💾 Banco de Dados & Logs
# ------------------------------------------------------
.d1/
*.sqlite
*.sqlite3
*.db
*.db-journal
logs/
*.log

# ------------------------------------------------------
# 🏗️ Build & Output
# ------------------------------------------------------
dist/
build/
coverage/
.nyc_output/

# ------------------------------------------------------
# 🖥️ Sistema
# ------------------------------------------------------
.DS_Store
Thumbs.db
.vscode/
.idea/\n```\n### ✅ .dev.vars\n`Arquivo de ambiente detectado (Conteúdo oculto por segurança)`\n### ✅ wrangler.jsonc\n```json\n{
  "name": "gov-system-api",
  "main": "src/index.ts",
  
  // [AUTENTICAÇÃO AUTOMÁTICA]
  // Como está no .gitignore, podemos deixar fixo aqui.
  // Isso elimina a necessidade de passar CLOUDFLARE_ACCOUNT_ID no terminal.
  "account_id": "5d91807e648c183cb7833caa06dbcbdb",

  "compatibility_date": "2025-12-17",
  "compatibility_flags": ["nodejs_compat"],

  // Roteamento para seu Domínio Oficial
  "routes": [
    {
      "pattern": "api.asppibra.com",
      "custom_domain": true
    }
  ],

  // Variáveis de Ambiente
  // Nota: Não coloquei a R2_ACCESS_KEY_ID aqui porque o binding "STORAGE" (abaixo)
  // já autentica automaticamente sem precisar da chave explícita!
  "vars": {
    "CLOUDFLARE_ZONE_ID": "60681ad827e114d9e51add1f079dd5d2",
    "NEXT_PUBLIC_HOST_API": "https://api.asppibra.com"
  },

  // 1. Arquivos Estáticos (Frontend)
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  },

  // 2. Banco de Dados D1
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "gov-db",
      "database_id": "fbdff5ac-2fcc-4182-9cbf-be6c1d08e287"
    }
  ],

  // 3. KV Namespaces (Cache e Sessão)
  "kv_namespaces": [
    {
      "binding": "KV_CACHE",
      "id": "bd8db7b5217e42e49fb65e611b28ce74",
      "preview_id": "bd8db7b5217e42e49fb65e611b28ce74"
    },
    {
      "binding": "KV_AUTH",
      "id": "5671ab27c24d4c828b9a5fe7f0b0267a",
      "preview_id": "5671ab27c24d4c828b9a5fe7f0b0267a"
    }
  ],

  // 4. R2 Storage (Arquivos)
  "r2_buckets":\n... (truncado)\n```\n### ✅ drizzle.config.ts\n```typescript\nimport { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Onde está o arquivo TypeScript com a definição das tabelas
  schema: "./src/db/schema.ts",
  
  // Onde os arquivos .sql gerados serão salvos
  out: "./migrations",
  
  // O D1 usa dialeto SQLite
  dialect: "sqlite",
  
  // Driver específico para Cloudflare D1
  driver: "d1-http", 

  // Credenciais para conectar ao D1 (lê do wrangler.jsonc)
  dbCredentials: {
    accountId: "5d91807e648c183cb7833caa06dbcbdb", // Seu Account ID real
    databaseId: "fbdff5ac-2fcc-4182-9cbf-be6c1d08e287", // Seu Database ID real
    token: "", // Deixe vazio para rodar localmente com npx wrangler
  },
  
  // Opções extras para desenvolvimento seguro
  verbose: true,
  strict: true,
});
\n```\n### ✅ src/index.ts\n```typescript\n/**
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
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from './types/bindings';
import { createDb, Database } from './db';
import { error } from './utils/response';
import { DashboardTemplate } from './views/dashboard';
import { AuditService } from './services/audit';
import { getTokenMarketData } from './services/market';

// --- CORE MODULES ---
import authRouter from './routes/core/auth';
import sessionRouter from './routes/core/auth/session';
import healthRouter from './routes/core/health';
import webhooksRouter from './routes/core/webhooks';

// --- PLATFORM MODULES ---
import paymentsRouter from './routes/platform/payments';
import storageRouter from './routes/platform/storage';

// --- PRODUCT MODULES --\n... (truncado)\n```\n

## 📝 DÍVIDA TÉCNICA E TAREFAS (TODOs)
✅ Nenhum TODO pendente encontrado.

---
*Gerado automaticamente pelo Auditor de Arquitetura v4.*
