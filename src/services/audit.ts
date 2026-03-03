/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Audit & Telemetry Service (Absolute Bank-Grade 10/10)
 * Version: 2.0.1 - Zero-Latency Telemetry, Strict Typings & Safe KV Abstractions
 */

import { drizzle } from "drizzle-orm/d1";
import { auditLogs as audit_logs } from "../db/schema"; 
import { Bindings } from "../types/bindings";

// 🛡️ SRE UTILITY: Compatibilidade de contexto sem violar strict mode
type WaitUntilCtx = { waitUntil(promise: Promise<any>): void };

// 🛡️ SRE UTILITY: Structural Interface for KV to safely bypass @cloudflare/workers-types collisions (TS2322)
interface TelemetryKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Interface de Métricas para o Dashboard
 */
export interface DashboardMetrics {
  networkRequests: number;
  processedData: number;
  globalUsers: number;
  cacheRatio: string;
  dbStats: {
    queries: number;
    mutations: number;
  };
  market: {
    price: string;
    change24h: number;
    liquidity: number;
    marketCap: number;
    history: { date: string; val: number }[];
  };
  countries: { code: string; country: string; count: number }[];
}

export type AuditAction = 
  | "LOGIN_ATTEMPT" | "LOGIN_SUCCESS" 
  | "VOTE_CAST" | "PROPOSAL_CREATE"
  | "DASHBOARD_VIEW" | "API_REQUEST" 
  | "KYC_UPLOAD" | "ADMIN_ACTION"
  | "PRODUCT_UPDATE"
  | "PASSWORD_RESET_REQUESTED" 
  | "PASSWORD_RESET_COMPLETED" 
  | "PASSWORD_RESET_INVALID_TOKEN" 
  | "PASSWORD_RESET_ANOMALY";

export type AuditEvent = {
  action: AuditAction;
  actorId?: string;
  resource?: string;
  ip: string;
  country?: string;
  userAgent?: string;
  status: "success" | "failure" | "blocked";
  isCacheHit?: boolean;
  metadata?: Record<string, unknown>;
  metrics?: {
    dbWrites?: number;
    dbReads?: number;
    bytesOut?: number;
  }
};

export class AuditService {
  private env: Bindings;
  private kv: TelemetryKV | undefined; 

  constructor(env: Bindings) {
    this.env = env;
    // O cast via 'unknown' resolve o conflito TS2322 entre as diferentes assinaturas de KVNamespace do Cloudflare
    this.kv = env.KV_CACHE as unknown as TelemetryKV;
  }

  /**
   * Registra um evento de auditoria com Zero-Latency
   * 🛡️ SRE: Envia tarefas para o background via `ctx.waitUntil` em vez de bloquear o worker com `await`.
   */
  log(event: AuditEvent, ctx?: WaitUntilCtx): void {
    const execute = async () => {
      const tasks: Promise<unknown>[] = [];

      // 1. Registro Permanente no D1 (ACID)
      try {
        const logValue = {
          action: event.action,
          actorId: event.actorId || "anon",
          actorType: event.actorId ? "user" : "system",
          resource: event.resource || null,
          status: event.status,
          ipAddress: event.ip,
          userAgent: event.userAgent || "Unknown",
          country: event.country || "XX",
          metadata: event.metadata ? JSON.stringify(event.metadata) : null, 
        };

        tasks.push(
          drizzle(this.env.DB).insert(audit_logs).values(logValue as any).run()
        );
      } catch (e) {
        console.error("[AUDIT_PERSISTENCE_ERROR]", e);
      }

      // 2. Telemetria Volátil (Eventual Consistency)
      if (event.status === "success" && this.kv) {
        tasks.push(this.incrementKV("stats:requests_24h", 1));
        tasks.push(this.incrementKV("stats:cache_total", 1));
        
        if (event.isCacheHit) {
          tasks.push(this.incrementKV("stats:cache_hits", 1));
        }

        if (event.metrics?.bytesOut) tasks.push(this.incrementKV("stats:bandwidth_24h", event.metrics.bytesOut));
        if (event.metrics?.dbWrites) tasks.push(this.incrementKV("stats:db_writes_24h", event.metrics.dbWrites));
        if (event.metrics?.dbReads) tasks.push(this.incrementKV("stats:db_reads_24h", event.metrics.dbReads));
        
        if (event.country && event.country !== 'XX') {
          tasks.push(this.trackCountry(event.country));
        }

        if (event.ip) tasks.push(this.trackUniqueVisitor(event.ip));
      }

      await Promise.allSettled(tasks);
    };

    // Fogo-e-esquece real no Edge
    if (ctx) {
      ctx.waitUntil(execute());
    } else {
      execute().catch(e => console.error('[AUDIT_BACKGROUND_ERROR]', e));
    }
  }

  /**
   * Consolida métricas globais (Snapshotting Cron Job)
   */
  async computeGlobalStats(): Promise<void> {
    if (!this.kv) return;

    try {
      const keys = [
        "stats:requests_24h", "stats:bandwidth_24h", "stats:db_writes_24h", 
        "stats:db_reads_24h", "stats:uniques_24h", "stats:cache_hits", "stats:cache_total"
      ];
      
      const values = await Promise.all(keys.map(k => this.kv!.get(k)));
      const [reqs, bytes, writes, reads, uniques, hits, total] = values.map(v => parseInt(v || "0", 10));

      const ratio = total > 0 ? ((hits / total) * 100).toFixed(1) + "%" : "0%";
      
      // Recupera o JSON consolidado de países (O(1) request em vez de O(N))
      const countriesRaw = await this.kv.get("stats:countries_json");
      
      // 🛡️ SRE: Correção TS7034 & TS7005 (Evita inferência implícita de 'any[]')
      let countries: { code: string; country: string; count: number }[] = [];
      
      if (countriesRaw) {
         try {
           const cmap = JSON.parse(countriesRaw) as Record<string, number>;
           const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
           countries = Object.entries(cmap)
             .sort((a, b) => b[1] - a[1])
             .slice(0, 10)
             .map(([code, count]) => ({
               code,
               country: regionNames.of(code) || code,
               count
             }));
         } catch (e) {}
      }

      const snapshot = {
        networkRequests: reqs,
        processedData: bytes,
        globalUsers: uniques,
        cacheRatio: ratio,
        dbStats: { queries: reads, mutations: writes },
        countries
      };

      await this.kv.put("dashboard:snapshot", JSON.stringify(snapshot));
    } catch (e) {
      console.error("[TELEMETRY_SNAPSHOT_ERROR]", e);
    }
  }

  /**
   * Recupera métricas O(1) para o Dashboard
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    if (!this.kv) return this.getEmptyMetrics();

    const [marketRaw, snapshotRaw] = await Promise.all([
      this.kv.get("market:data"),
      this.kv.get("dashboard:snapshot")
    ]);

    const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : {};
    const marketData = marketRaw ? JSON.parse(marketRaw) : {};

    return {
      networkRequests: snapshot.networkRequests || 0,
      processedData: snapshot.processedData || 0,
      globalUsers: snapshot.globalUsers || 0,
      cacheRatio: snapshot.cacheRatio || "0%",
      dbStats: snapshot.dbStats || { queries: 0, mutations: 0 },
      market: {
        price: Number(marketData.price || 0).toFixed(4),
        change24h: marketData.change24h || 0,
        liquidity: marketData.liquidity || 0,
        marketCap: marketData.marketCap || 0,
        history: Array.isArray(marketData.history) ? marketData.history : []
      },
      countries: Array.isArray(snapshot.countries) ? snapshot.countries : []
    };
  }

  /**
   * 🛡️ SRE: Tolerância a Concorrência (Fuzzy Counter)
   * Nota: Usar KV para contadores sofre de Read-Modify-Write data loss em alta concorrência.
   * Para exatidão financeira usaríamos Durable Objects, mas para telemetria visual, a latência salva vale a margem de erro.
   */
  private async incrementKV(key: string, value: number) {
    if (!this.kv) return;
    try {
      const current = await this.kv.get(key);
      const newValue = (parseInt(current || "0", 10) + value).toString();
      await this.kv.put(key, newValue, { expirationTtl: 86400 }); 
    } catch (e) {}
  }

  /**
   * Controle de Visitantes Únicos 
   */
  private async trackUniqueVisitor(ip: string) {
    if (!this.kv) return;
    const key = `sys:visitor:${ip}`;
    try {
      const exists = await this.kv.get(key);
      if (!exists) {
        await this.kv.put(key, "1", { expirationTtl: 86400 });
        await this.incrementKV("stats:uniques_24h", 1);
      }
    } catch (e) {}
  }

  /**
   * 🛡️ SRE: Mitigação de Subrequest Exhaustion
   * Em vez de salvar 1 key por país e usar kv.list() (que gasta dezenas de subrequests),
   * condensamos todos os países em um único JSON (1 Read, 1 Write).
   */
  private async trackCountry(countryCode: string) {
    if (!this.kv) return;
    try {
      const raw = await this.kv.get("stats:countries_json");
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[countryCode] = (map[countryCode] || 0) + 1;
      await this.kv.put("stats:countries_json", JSON.stringify(map), { expirationTtl: 86400 });
    } catch (e) {}
  }

  private getEmptyMetrics(): DashboardMetrics {
    return { 
      networkRequests: 0, processedData: 0, globalUsers: 0, cacheRatio: "0%",
      dbStats: { queries: 0, mutations: 0 }, 
      market: { price: "0.00", change24h: 0, liquidity: 0, marketCap: 0, history: [] }, 
      countries: [] 
    };
  }
}