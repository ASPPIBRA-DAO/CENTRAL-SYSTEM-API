import { D1Database, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { audit_logs } from "../db/schema"; // Importando a tabela correta
import { Bindings } from "../types/bindings";

// Tipos de ações monitoradas
export type AuditAction = 
  | "LOGIN_ATTEMPT" | "LOGIN_SUCCESS" 
  | "VOTE_CAST" | "PROPOSAL_CREATE"
  | "DASHBOARD_VIEW" | "API_REQUEST"
  | "KYC_UPLOAD" | "ADMIN_ACTION";

export type AuditEvent = {
  action: AuditAction;
  actorId?: string; // CORRIGIDO: Era userId, agora é actorId para bater com o schema
  resource?: string; // NOVO: Para preencher a coluna 'resource' do schema
  ip: string;
  country?: string;
  userAgent?: string;
  status: "success" | "failure"; // CORRIGIDO: Lowercase para bater com o enum do schema
  metadata?: Record<string, any>; // Objeto puro (Drizzle converte p/ JSON sozinho)
  
  // Métricas de Performance (Apenas para o KV, não vai pro D1)
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
    // Tenta pegar o KV_CACHE, se falhar usa KV_AUTH como fallback para não quebrar
    this.kv = env.KV_CACHE || env.KV_AUTH; 
    this.storage = env.STORAGE;
  }

  /**
   * ⚡ O MOTOR: Grava no DB (Segurança) e no KV (Dashboard)
   */
  async log(event: AuditEvent): Promise<void> {
    const tasks: Promise<any>[] = [];

    // 1. Gravação Forense (D1)
    // O try/catch garante que falhas de log não derrubem a API principal
    try {
      const dbTask = drizzle(this.db).insert(audit_logs).values({
        actorId: event.actorId || "anon",
        action: event.action,
        resource: event.resource || null,
        status: event.status,
        ipAddress: event.ip,
        userAgent: event.userAgent,
        country: event.country, // Nota: Se o schema não tiver 'country', isso será ignorado ou precisa ser removido
        // IMPORTANTE: Como seu schema tem { mode: 'json' }, passamos o objeto direto!
        metadata: event.metadata, 
      }).run();
      
      tasks.push(dbTask);
    } catch (e) {
      console.error("❌ Audit DB Error:", e);
    }

    // 2. Atualização do Dashboard (KV)
    // Só atualizamos estatísticas se a operação foi um sucesso
    if (event.status === "success" && this.kv) {
      // Requests Totais
      tasks.push(this.incrementKV("stats:requests_24h", 1));
      
      // Bandwidth (Data Throughput)
      if (event.metrics?.bytesOut) {
        tasks.push(this.incrementKV("stats:bandwidth_24h", event.metrics.bytesOut));
      }

      // DB Workload (Ledger Mutations / State Queries)
      if (event.metrics?.dbWrites) tasks.push(this.incrementKV("stats:db_writes_24h", event.metrics.dbWrites));
      if (event.metrics?.dbReads) tasks.push(this.incrementKV("stats:db_reads_24h", event.metrics.dbReads));

      // Origem do Tráfego (Traffic Origin)
      if (event.country) {
        tasks.push(this.incrementKV(`stats:country:${event.country}`, 1));
      }
      
      // Visitantes Únicos (Global Users)
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

    const [reqs, bytes, writes, reads, uniques, price] = await Promise.all([
      this.kv.get("stats:requests_24h"),
      this.kv.get("stats:bandwidth_24h"),
      this.kv.get("stats:db_writes_24h"),
      this.kv.get("stats:db_reads_24h"),
      this.kv.get("stats:uniques_24h"),
      this.kv.get("market:price_usd"),
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
        price: price || "0.00"
      },
      // Aqui você pode implementar a lógica para retornar o Top 5 países
      countries: [] 
    };
  }

  private getEmptyMetrics() {
    return { 
      networkRequests: 0, 
      processedData: 0, 
      globalUsers: 0, 
      dbStats: { queries: 0, mutations: 0 }, 
      market: { price: "0" }, 
      countries: [] 
    };
  }

  private async incrementKV(key: string, value: number) {
    const current = await this.kv.get(key);
    const newValue = (parseInt(current || "0") + value).toString();
    await this.kv.put(key, newValue, { expirationTtl: 86400 }); // Expira em 24h
  }

  private async trackUniqueVisitor(ip: string) {
    const key = `visitor:${ip}`;
    const exists = await this.kv.get(key);
    if (!exists) {
      await this.kv.put(key, "1", { expirationTtl: 86400 });
      await this.incrementKV("stats:uniques_24h", 1);
    }
  }
}