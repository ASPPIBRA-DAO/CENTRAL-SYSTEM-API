/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Audit & Telemetry Service (Forensics)
 * Version: 1.2.1 - Fix: KV Type Conflict & Drizzle Schema Alignment
 */

import { drizzle } from "drizzle-orm/d1";
import { auditLogs as audit_logs } from "../db/schema"; 
import { Bindings } from "../types/bindings";

/**
 * Interface de Métricas para o Dashboard
 * Centraliza os indicadores de performance, rede e mercado.
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

/**
 * Ações Auditáveis
 * Define rigorosamente quais eventos podem ser registrados para manter a integridade dos relatórios.
 */
export type AuditAction = 
  | "LOGIN_ATTEMPT" | "LOGIN_SUCCESS" 
  | "VOTE_CAST" | "PROPOSAL_CREATE"
  | "DASHBOARD_VIEW" | "API_REQUEST" 
  | "KYC_UPLOAD" | "ADMIN_ACTION"
  | "PRODUCT_UPDATE";

/**
 * Estrutura do Evento de Auditoria
 */
export type AuditEvent = {
  action: AuditAction;
  actorId?: string;
  resource?: string;
  ip: string;
  country?: string;
  userAgent?: string;
  status: "success" | "failure";
  isCacheHit?: boolean;
  metadata?: Record<string, any>;
  metrics?: {
    dbWrites?: number;
    dbReads?: number;
    bytesOut?: number;
  }
};

export class AuditService {
  private env: Bindings;
  // 🟢 FIX TS2322: Usamos 'any' para evitar conflitos entre diferentes versões do SDK da Cloudflare
  private kv: any; 

  constructor(env: Bindings) {
    this.env = env;
    // Prioriza KV_CACHE para telemetria de performance
    this.kv = env.KV_CACHE;
  }

  /**
   * Registra um evento de auditoria
   * Utiliza processamento assíncrono paralelo para minimizar impacto na latência da API.
   */
  async log(event: AuditEvent): Promise<void> {
    const tasks: Promise<any>[] = [];

    // 1. Registro Permanente no D1 (Persistência Forense)
    try {
      // 🟢 FIX TS2769: Mapeamento explícito para satisfazer as restrições do Drizzle ORM
      const logValue: any = {
        action: event.action,
        actorId: event.actorId || "anon",
        resource: event.resource || null,
        status: event.status,
        ipAddress: event.ip,
        userAgent: event.userAgent || "Unknown",
        country: event.country || "XX",
        // Garantimos que o metadata seja uma string JSON se o banco for SQLite puro
        metadata: JSON.stringify(event.metadata || {}), 
      };

      tasks.push(
        drizzle(this.env.DB).insert(audit_logs).values(logValue).run()
      );
    } catch (e) {
      console.error("❌ Audit Persistence Error:", e);
    }

    // 2. Telemetria Volátil no KV (Real-time Stats)
    if (event.status === "success" && this.kv) {
      tasks.push(this.incrementKV("stats:requests_24h", 1));
      tasks.push(this.incrementKV("stats:cache_total", 1));
      
      if (event.isCacheHit) {
        tasks.push(this.incrementKV("stats:cache_hits", 1));
      }

      // Registro de métricas técnicas
      if (event.metrics?.bytesOut) tasks.push(this.incrementKV("stats:bandwidth_24h", event.metrics.bytesOut));
      if (event.metrics?.dbWrites) tasks.push(this.incrementKV("stats:db_writes_24h", event.metrics.dbWrites));
      if (event.metrics?.dbReads) tasks.push(this.incrementKV("stats:db_reads_24h", event.metrics.dbReads));
      
      // Geolocalização de Tráfego
      if (event.country && event.country !== 'XX') {
        tasks.push(this.incrementKV(`stats:country:${event.country}`, 1));
      }

      // Rastreador de Visitantes Únicos (Baseado em IP)
      if (event.ip) tasks.push(this.trackUniqueVisitor(event.ip));
    }

    // Aguarda todas as tarefas sem bloquear o fluxo principal (uso com waitUntil no index.ts)
    await Promise.allSettled(tasks);
  }

  /**
   * Consolida métricas globais (Snapshotting)
   * Executado periodicamente via Cron Job (Scheduled Event).
   */
  async computeGlobalStats(): Promise<void> {
    if (!this.kv) return;

    try {
      const keys = [
        "stats:requests_24h", "stats:bandwidth_24h", "stats:db_writes_24h", 
        "stats:db_reads_24h", "stats:uniques_24h", "stats:cache_hits", "stats:cache_total"
      ];
      
      const values = await Promise.all(keys.map(k => this.kv.get(k)));
      const [reqs, bytes, writes, reads, uniques, hits, total] = values.map(v => parseInt(v || "0"));

      // Cálculo de Eficiência de Cache
      const ratio = total > 0 ? ((hits / total) * 100).toFixed(1) + "%" : "0%";
      const countries = await this.getInternalTopCountries();

      const snapshot = {
        networkRequests: reqs,
        processedData: bytes,
        globalUsers: uniques,
        cacheRatio: ratio,
        dbStats: { queries: reads, mutations: writes },
        countries: countries
      };

      await this.kv.put("dashboard:snapshot", JSON.stringify(snapshot));
      console.log("📊 Snapshot de telemetria gerado.");
    } catch (e) {
      console.error("❌ Erro ao computar snapshot:", e);
    }
  }

  /**
   * Recupera métricas para o Dashboard
   * Prioriza o cache de snapshot para performance máxima.
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
        history: marketData.history || []
      },
      countries: snapshot.countries || []
    };
  }

  /**
   * Incremento Atômico Simulado (KV)
   */
  private async incrementKV(key: string, value: number) {
    const current = await this.kv.get(key);
    const newValue = (parseInt(current || "0") + value).toString();
    await this.kv.put(key, newValue, { expirationTtl: 86400 }); 
  }

  /**
   * Controle de Visitantes Únicos (24h)
   */
  private async trackUniqueVisitor(ip: string) {
    const key = `visitor:${ip}`;
    const exists = await this.kv.get(key);
    if (!exists) {
      await this.kv.put(key, "1", { expirationTtl: 86400 });
      await this.incrementKV("stats:uniques_24h", 1);
    }
  }

  /**
   * Ranking Geográfico
   */
  private async getInternalTopCountries() {
    const list = await this.kv.list({ prefix: "stats:country:" });
    const results = await Promise.all(list.keys.map(async (key: any) => {
      const val = await this.kv.get(key.name);
      return { code: key.name.replace("stats:country:", ""), count: parseInt(val || "0") };
    }));

    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return results
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({
        code: item.code,
        country: regionNames.of(item.code) || item.code,
        count: item.count
      }));
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