# 🕵️ RELATÓRIO DE AUDITORIA - CENTRAL-SYSTEM-API
Data: 12/18/2025, 7:35:41 PM
Diretório Raiz: /home/user/CENTRAL-SYSTEM-API

---

## 1. 🌳 ESTRUTURA DE ARQUIVOS\n```text\n├── .idx/\n│   └── dev.nix\n├── migrations/\n│   ├── meta/\n│   │   ├── _journal.json\n│   │   ├── 0000_snapshot.json\n│   │   └── 0001_snapshot.json\n│   ├── 0000_unique_red_hulk.sql\n│   └── 0001_furry_sunspot.sql\n├── public/\n│   ├── css/\n│   │   └── style.css\n│   ├── icons/\n│   │   ├── android-chrome-192x192.png\n│   │   ├── android-chrome-512x512.png\n│   │   ├── apple-touch-icon.png\n│   │   ├── favicon-16x16.png\n│   │   └── favicon-32x32.png\n│   ├── img/\n│   │   └── social-preview.png\n│   ├── js/\n│   │   └── dashboard.js\n│   ├── favicon.ico\n│   ├── robots.txt\n│   ├── site.webmanifest\n│   └── sitemap.xml\n├── scripts/\n│   ├── audit-project.js\n│   ├── build-seo.mjs\n│   ├── cloudflare-analytics.js\n│   └── fetch-ids.js\n├── src/\n│   ├── db/\n│   │   ├── index.ts\n│   │   └── schema.ts\n│   ├── middlewares/\n│   │   ├── auth-jwt.ts\n│   │   └── rate-limit.ts\n│   ├── routes/\n│   │   ├── core/\n│   │   │   ├── auth/\n│   │   │   │   ├── index.ts\n│   │   │   │   └── session.ts\n│   │   │   ├── health.ts\n│   │   │   └── webhooks.ts\n│   │   ├── platform/\n│   │   │   ├── payments.ts\n│   │   │   └── storage.ts\n│   │   └── products/\n│   │       ├── agro/\n│   │       │   └── index.ts\n│   │       ├── posts/\n│   │       │   └── index.ts\n│   │       └── rwa/\n│   │           └── index.ts\n│   ├── services/\n│   │   ├── audit.ts\n│   │   └── market.ts\n│   ├── types/\n│   │   ├── bindings.d.ts\n│   │   └── manifest.d.ts\n│   ├── utils/\n│   │   ├── auth-guard.ts\n│   │   └── response.ts\n│   ├── validators/\n│   │   └── users.ts\n│   ├── views/\n│   │   └── dashboard.ts\n│   └── index.ts\n├── test/\n│   ├── env.d.ts\n│   ├── index.spec.ts\n│   └── tsconfig.json\n├── .dev.vars\n├── .editorconfig\n├── .gitignore\n├── .prettierrc\n├── drizzle.config.ts\n├── package.json\n├── pnpm-lock.yaml\n├── README.md\n├── tsconfig.json\n├── vitest.config.mts\n├── worker-configuration.d.ts\n└── wrangler.jsonc\n\n```\n\n## 2. ⚙️ CONFIGURAÇÕES CRÍTICAS\n\n### 📄 wrangler.jsonc\n```jsonc\n{
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
  "r2_buckets": [
    {
      "binding": "STORAGE",
      "bucket_name": "gov-assets",
      "preview_bucket_name": "governance-system-assets-dev"
    }
  ],

  // 5. Observabilidade (Logs Totais)
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "persist": true,
      "invocation_logs": true
    },
    "traces": {
      "enabled": true,
      "persist": true,
      "head_sampling_rate": 1
    }
  },

  // 6. Cron Jobs
  "triggers": {
    "crons": ["*/5 * * * *"]
  }
}\n```\n\n### ❌ wrangler.toml (Não encontrado)\n\n### 📄 package.json\n```jsonc\n{
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
        "bcryptjs": "^3.0.3",
        "drizzle-orm": "^0.44.7",
        "hono": "^4.10.7",
        "jsonwebtoken": "^9.0.3",
        "otplib": "^12.0.1",
        "qrcode": "^1.5.4",
        "siwe": "^3.0.0",
        "viem": "^2.42.1",
        "zod": "^4.1.13"
    }
}\n```\n\n### 📄 drizzle.config.ts\n```jsonc\nimport { defineConfig } from "drizzle-kit";

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
\n```\n\n### 📄 tsconfig.json\n```jsonc\n{
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
			"./worker-configuration.d.ts",
			"@cloudflare/workers-types"
		]
	},
	"exclude": ["test"],
	"include": ["worker-configuration.d.ts", "src/**/*.ts"]
}
\n```\n\n### 📄 src/types/bindings.d.ts\n```jsonc\nimport { D1Database, R2Bucket, Fetcher, KVNamespace } from "@cloudflare/workers-types";

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
};\n```\n\n## 3. 🛡️ VERIFICAÇÃO DE AMBIENTE E SEGURANÇA\n- **.dev.vars**: ✅ Existe (OK)\n- **.gitignore**: ✅ Existe. \n  - Ignora .dev.vars? ✅ Sim\n\n## 4. 📝 DÍVIDA TÉCNICA (TODOs/FIXMEs)\n- [ ] **scripts/audit-project.js:17**: \`';
    }

    return output;
}

// 4. SCANNER DE DÍVIDA TÉCNICA (TODOs)
function scanForTodos(dir) {
    let output = '';
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (IGNORE_DIRS.includes(file)) return;

        if (stats.isDirectory()) {
            output += scanForTodos(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsonc')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\\`\n- [ ] **scripts/audit-project.js:18**: \`');
            lines.forEach((line, index) => {
                if (line.includes('TODO') || line.includes('FIXME')) {
                    const relativePath = path.relative(ROOT_DIR, filePath);
                    output += `- [ ] **${relativePath}:${index + 1}**: \\\`${line.trim()}\\\`\\`\n- [ ] **scripts/audit-project.js:23**: \`';

// Bloco 2: Configs
reportContent += readCriticalFiles();

// Bloco 3: Segurança
reportContent += checkEnvironment();

// Bloco 4: TODOs
const todos = scanForTodos(ROOT_DIR);
reportContent += '\\`\n- [ ] **scripts/audit-project.js:24**: \`## 4. 📝 DÍVIDA TÉCNICA (TODOs/FIXMEs)\\`\n- [ ] **scripts/audit-project.js:25**: \`' + (todos ? todos : 'Nenhum TODO encontrado. Código limpo!') + '\\`\n- [ ] **src/services/audit.ts:1**: \`import { D1Database, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { audit_logs } from "../db/schema"; 
import { Bindings } from "../types/bindings";

// Tipos de ações monitoradas
export type AuditAction = 
  | "LOGIN_ATTEMPT" | "LOGIN_SUCCESS" 
  | "VOTE_CAST" | "PROPOSAL_CREATE"
  | "DASHBOARD_VIEW" | "API_REQUEST"
  | "KYC_UPLOAD" | "ADMIN_ACTION";

export type AuditEvent = {
  action: AuditAction;
  actorId?: string;
  resource?: string;
  ip: string;
  country?: string;
  userAgent?: string;
  status: "success" | "failure";
  metadata?: Record<string, any>;
  metrics?: {
    dbWrites?: number;
    dbReads?: number;
    bytesOut?: number;
  }
};

export class AuditService {
  private db: D1Database;
  private kv: KVNamespace;
  private storage: R2Bucket;

  constructor(env: Bindings) {
    this.db = env.DB;
    this.kv = env.KV_CACHE || env.KV_AUTH; 
    this.storage = env.STORAGE;
  }

  /**
   * ⚡ O MOTOR: Grava no DB (Segurança) e no KV (Dashboard)
   */
  async log(event: AuditEvent): Promise<void> {
    const tasks: Promise<any>[] = [];

    // 1. Gravação Forense (D1)
    try {
      tasks.push(drizzle(this.db).insert(audit_logs).values({
        actorId: event.actorId || "anon",
        action: event.action,
        resource: event.resource || null,
        status: event.status,
        ipAddress: event.ip,
        userAgent: event.userAgent,
        country: event.country,
        metadata: event.metadata, 
      }).run());
    } catch (e) {
      console.error("❌ Audit DB Error:", e);
    }

    // 2. Atualização do Dashboard (KV)
    if (event.status === "success" && this.kv) {
      tasks.push(this.incrementKV("stats:requests_24h", 1));
      
      if (event.metrics?.bytesOut) {
        tasks.push(this.incrementKV("stats:bandwidth_24h", event.metrics.bytesOut));
      }

      if (event.metrics?.dbWrites) tasks.push(this.incrementKV("stats:db_writes_24h", event.metrics.dbWrites));
      if (event.metrics?.dbReads) tasks.push(this.incrementKV("stats:db_reads_24h", event.metrics.dbReads));

      if (event.country && event.country.length === 2 && event.country !== 'XX') {
        tasks.push(this.incrementKV(`stats:country:${event.country}`, 1));
      }
      
      if (event.ip) {
        tasks.push(this.trackUniqueVisitor(event.ip));
      }
    }

    await Promise.allSettled(tasks);
  }

  /**
   * 📊 Método para o Dashboard ler os dados
   * [CORRIGIDO] Agora lê o pacote COMPLETO (Preço + Gráfico + Liquidez)
   */
  async getDashboardMetrics() {
    if (!this.kv) return this.getEmptyMetrics();

    // Busca dados em paralelo
    const [reqs, bytes, writes, reads, uniques, marketRaw, countries] = await Promise.all([
      this.kv.get("stats:requests_24h"),
      this.kv.get("stats:bandwidth_24h"),
      this.kv.get("stats:db_writes_24h"),
      this.kv.get("stats:db_reads_24h"),
      this.kv.get("stats:uniques_24h"),
      this.kv.get("market:data"), // <--- Lendo o JSON completo da Moralis!
      this.getTopCountries()
    ]);

    // Processa os dados de mercado
    let marketData = { 
      price: "0.00", 
      change24h: 0, 
      liquidity: 0, 
      marketCap: 0, 
      history: [] 
    };

    if (marketRaw) {
      try {
        const parsed = JSON.parse(marketRaw);
        marketData = {
          price: parseFloat(parsed.price || "0").toFixed(4),
          change24h: parsed.change24h || 0,
          liquidity: parsed.liquidity || 0,
          marketCap: parsed.marketCap || 0,
          history: parsed.history || []
        };
      } catch (e) { console.error("Erro parse market data", e); }
    }

    return {
      networkRequests: parseInt(reqs || "0"),
      processedData: parseInt(bytes || "0"),
      globalUsers: parseInt(uniques || "0"),
      dbStats: {
        queries: parseInt(reads || "0"),
        mutations: parseInt(writes || "0"),
      },
      market: marketData, // Retorna o objeto completo para o Frontend desenhar o gráfico
      countries: countries
    };
  }

  // --- MÉTODOS PRIVADOS ---

  private getEmptyMetrics() {
    return { 
      networkRequests: 0, 
      processedData: 0, 
      globalUsers: 0, 
      dbStats: { queries: 0, mutations: 0 }, 
      market: { price: "0.00", change24h: 0, liquidity: 0, marketCap: 0, history: [] }, 
      countries: [] 
    };
  }

  private async incrementKV(key: string, value: number) {
    const current = await this.kv.get(key);
    const newValue = (parseInt(current || "0") + value).toString();
    await this.kv.put(key, newValue, { expirationTtl: 86400 }); 
  }

  private async trackUniqueVisitor(ip: string) {
    const key = `visitor:${ip}`;
    const exists = await this.kv.get(key);
    if (!exists) {
      await this.kv.put(key, "1", { expirationTtl: 86400 });
      await this.incrementKV("stats:uniques_24h", 1);
    }
  }

  private async getTopCountries() {
    if (!this.kv) return [];
    const list = await this.kv.list({ prefix: "stats:country:" });
    
    const tasks = list.keys.map(async (key) => {
      const val = await this.kv.get(key.name);
      const code = key.name.replace("stats:country:", ""); 
      return { code: code, count: parseInt(val || "0") };
    });

    const results = await Promise.all(tasks);
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    return results
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => {
        let name = item.code;
        try { name = regionNames.of(item.code) || item.code; } catch { name = item.code; }
        return { code: item.code, country: name, count: item.count };
      });
  }
}\`\n- [ ] **test/index.spec.ts:1**: \`import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Governance API Worker', () => {
	describe('General Routes', () => {
		it('GET / returns HTML dashboard', async () => {
			const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			const text = await response.text();
			expect(response.status).toBe(200);
			expect(text).toContain('<!DOCTYPE html>');
			expect(text).toContain('ASPPIBRA DAO');
		});

		it('GET /health-db returns status ok', async () => {
			// Mocking D1 if necessary or relying on integration environment
			// Note: In unit style with cloudflare:test, env.DB is mocked automatically by vitest-pool-workers
			const request = new Request('http://example.com/health-db');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			// Expect 200 OK
			expect(response.status).toBe(200);
			const json = await response.json() as any;
			expect(json.success).toBe(true);
			expect(json.data.status).toBe('ok');
		});
	});

    // TODO: Add more tests for Auth and Posts using mock DB or integration tests
});\`\n\n