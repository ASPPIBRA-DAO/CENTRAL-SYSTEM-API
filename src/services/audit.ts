/**
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
import { D1Database, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { auditLogs as audit_logs } from "../db/schema"; 
import { Bindings } from "../types/bindings";

/**
 * 📝 Interface para garantir que o TypeScript reconheça todas as métricas
 * Resolve o erro TS2339 no index.ts
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
    history: any[];
  };
  countries: any[];
}

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
  isCacheHit?: boolean; // Novo: Identifica se a requisição foi servida pelo cache
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

  async log(event: AuditEvent): Promise<void> {
    const tasks: Promise<any>[] = [];

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

    if (event.status === "success" && this.kv) {
      tasks.push(this.incrementKV("stats:requests_24h", 1));
      
      // Lógica de Cache Ratio: Incrementa total e hits se aplicável
      tasks.push(this.incrementKV("stats:cache_total", 1));
      if (event.isCacheHit) {
        tasks.push(this.incrementKV("stats:cache_hits", 1));
      }

      if (event.metrics?.bytesOut) tasks.push(this.incrementKV("stats:bandwidth_24h", event.metrics.bytesOut));
      if (event.metrics?.dbWrites) tasks.push(this.incrementKV("stats:db_writes_24h", event.metrics.dbWrites));
      if (event.metrics?.dbReads) tasks.push(this.incrementKV("stats:db_reads_24h", event.metrics.dbReads));
      if (event.country && event.country.length === 2 && event.country !== 'XX') {
        tasks.push(this.incrementKV(`stats:country:${event.country}`, 1));
      }
      if (event.ip) tasks.push(this.trackUniqueVisitor(event.ip));
    }

    await Promise.allSettled(tasks);
  }

  async computeGlobalStats(): Promise<void> {
    if (!this.kv) return;

    try {
      const [reqs, bytes, writes, reads, uniques, hits, total] = await Promise.all([
        this.kv.get("stats:requests_24h"),
        this.kv.get("stats:bandwidth_24h"),
        this.kv.get("stats:db_writes_24h"),
        this.kv.get("stats:db_reads_24h"),
        this.kv.get("stats:uniques_24h"),
        this.kv.get("stats:cache_hits"),
        this.kv.get("stats:cache_total")
      ]);

      // Cálculo Dinâmico do Ratio
      const h = parseInt(hits || "0");
      const t = parseInt(total || "1");
      const ratio = ((h / t) * 100).toFixed(1) + "%";

      const countries = await this.getInternalTopCountries();

      const snapshot = {
        networkRequests: parseInt(reqs || "0"),
        processedData: parseInt(bytes || "0"),
        globalUsers: parseInt(uniques || "0"),
        cacheRatio: ratio,
        dbStats: {
          queries: parseInt(reads || "0"),
          mutations: parseInt(writes || "0"),
        },
        countries: countries
      };

      await this.kv.put("dashboard:snapshot", JSON.stringify(snapshot));
      console.log("📊 Telemetria consolidada com sucesso.");
    } catch (e) {
      console.error("❌ Falha ao consolidar snapshot:", e);
    }
  }

  /**
   * 📊 Retorna métricas tipadas para o Dashboard
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    if (!this.kv) return this.getEmptyMetrics();

    const [marketRaw, snapshotRaw] = await Promise.all([
      this.kv.get("market:data"),
      this.kv.get("dashboard:snapshot")
    ]);

    const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : {};
    let marketData = { price: "0.00", change24h: 0, liquidity: 0, marketCap: 0, history: [] };

    if (marketRaw) {
      try {
        const parsed = JSON.parse(marketRaw);
        marketData = {
          price: Number(parsed.price || 0).toFixed(4),
          change24h: parsed.change24h || 0,
          liquidity: parsed.liquidity || 0,
          marketCap: parsed.marketCap || 0,
          history: parsed.history || []
        };
      } catch (e) { console.error("❌ Erro parse market data:", e); }
    }

    return {
      networkRequests: snapshot.networkRequests || 0,
      processedData: snapshot.processedData || 0,
      globalUsers: snapshot.globalUsers || 0,
      cacheRatio: snapshot.cacheRatio || "0%",
      dbStats: snapshot.dbStats || { queries: 0, mutations: 0 },
      market: marketData,
      countries: snapshot.countries || []
    };
  }

  private getEmptyMetrics(): DashboardMetrics {
    return { 
      networkRequests: 0, processedData: 0, globalUsers: 0, cacheRatio: "0%",
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
    if (!(await this.kv.get(key))) {
      await this.kv.put(key, "1", { expirationTtl: 86400 });
      await this.incrementKV("stats:uniques_24h", 1);
    }
  }

  private async getInternalTopCountries() {
    const list = await this.kv.list({ prefix: "stats:country:" });
    const results = await Promise.all(list.keys.map(async (key) => {
      const val = await this.kv.get(key.name);
      return { code: key.name.replace("stats:country:", ""), count: parseInt(val || "0") };
    }));

    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return results
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => {
        let name = item.code;
        try { name = regionNames.of(item.code) || item.code; } catch { }
        return { code: item.code, country: name, count: item.count };
      });
  }
}