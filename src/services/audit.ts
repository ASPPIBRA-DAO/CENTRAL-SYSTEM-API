import { D1Database, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
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
  
  // Métricas de Performance (KV)
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
    // Fallback de segurança para KV
    this.kv = env.KV_CACHE || env.KV_AUTH; 
    this.storage = env.STORAGE;
  }

  /**
   * ⚡ O MOTOR: Grava no DB (Segurança) e no KV (Dashboard)
   */
  async log(event: AuditEvent): Promise<void> {
    const tasks: Promise<any>[] = [];

    // 1. Gravação Forense (D1 via Drizzle)
    try {
      const dbTask = drizzle(this.db).insert(audit_logs).values({
        actorId: event.actorId || "anon",
        action: event.action,
        resource: event.resource || null,
        status: event.status,
        ipAddress: event.ip,
        userAgent: event.userAgent,
        country: event.country,
        metadata: event.metadata, 
      }).run();
      
      tasks.push(dbTask);
    } catch (e) {
      console.error("❌ Audit DB Error:", e);
    }

    // 2. Atualização do Dashboard (KV)
    if (event.status === "success" && this.kv) {
      // Requests Totais
      tasks.push(this.incrementKV("stats:requests_24h", 1));
      
      // Bandwidth
      if (event.metrics?.bytesOut) {
        tasks.push(this.incrementKV("stats:bandwidth_24h", event.metrics.bytesOut));
      }

      // DB Workload
      if (event.metrics?.dbWrites) tasks.push(this.incrementKV("stats:db_writes_24h", event.metrics.dbWrites));
      if (event.metrics?.dbReads) tasks.push(this.incrementKV("stats:db_reads_24h", event.metrics.dbReads));

      // [CORREÇÃO] Origem do Tráfego
      // Filtra 'XX' (localhost) e garante que temos um código de país válido
      if (event.country && event.country.length === 2 && event.country !== 'XX') {
        tasks.push(this.incrementKV(`stats:country:${event.country}`, 1));
      }
      
      // Visitantes Únicos
      if (event.ip) {
        tasks.push(this.trackUniqueVisitor(event.ip));
      }
    }

    await Promise.allSettled(tasks);
  }

  /**
   * 📊 Método para o Dashboard ler os dados
   */
  async getDashboardMetrics() {
    if (!this.kv) return this.getEmptyMetrics();

    // Busca dados em paralelo
    const [reqs, bytes, writes, reads, uniques, price, countries] = await Promise.all([
      this.kv.get("stats:requests_24h"),
      this.kv.get("stats:bandwidth_24h"),
      this.kv.get("stats:db_writes_24h"),
      this.kv.get("stats:db_reads_24h"),
      this.kv.get("stats:uniques_24h"),
      this.kv.get("market:price_usd"),
      this.getTopCountries() // [NOVO] Chamada para buscar países
    ]);

    return {
      networkRequests: parseInt(reqs || "0"),
      processedData: parseInt(bytes || "0"),
      globalUsers: parseInt(uniques || "0"),
      dbStats: {
        queries: parseInt(reads || "0"),
        mutations: parseInt(writes || "0"),
      },
      market: {
        price: parseFloat(price || "0").toFixed(4)
      },
      countries: countries // Agora retorna a lista real!
    };
  }

  // --- MÉTODOS PRIVADOS ---

  private getEmptyMetrics() {
    return { 
      networkRequests: 0, 
      processedData: 0, 
      globalUsers: 0, 
      dbStats: { queries: 0, mutations: 0 }, 
      market: { price: "0.00" }, 
      countries: [] 
    };
  }

  private async incrementKV(key: string, value: number) {
    const current = await this.kv.get(key);
    const newValue = (parseInt(current || "0") + value).toString();
    // Mantemos os dados por 24h para um dashboard "ao vivo"
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

  /**
   * [NOVO] Lê e processa a lista de países do KV
   */
  private async getTopCountries() {
    if (!this.kv) return [];

    // 1. Lista chaves que começam com "stats:country:"
    const list = await this.kv.list({ prefix: "stats:country:" });
    
    // 2. Busca valores
    const tasks = list.keys.map(async (key) => {
      const val = await this.kv.get(key.name);
      const code = key.name.replace("stats:country:", ""); 
      return {
        code: code,
        count: parseInt(val || "0")
      };
    });

    const results = await Promise.all(tasks);

    // 3. Traduz códigos para nomes (Ex: BR -> Brazil)
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    return results
      .sort((a, b) => b.count - a.count) // Ordena do maior para o menor
      .slice(0, 10) // Pega top 10
      .map(item => {
        let name = item.code;
        try {
          name = regionNames.of(item.code) || item.code;
        } catch { 
          name = item.code; 
        }
        return {
          code: item.code,
          country: name,
          count: item.count
        };
      });
  }
}