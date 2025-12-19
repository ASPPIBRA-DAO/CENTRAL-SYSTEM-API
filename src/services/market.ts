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
import { Bindings } from '../types/bindings';

export async function getTokenMarketData(env: Bindings, mode: 'full' | 'price_only' = 'full') {
  // --- CONFIGURAÇÃO ---
  // Endereço do Pool ASPPBR/USDT na BSC (GeckoTerminal)
  const POOL_ADDRESS = "0xf1961269d193f6511a1e24aac93fbca4e815e4ca"; 
  const NETWORK = "bsc";

  try {
    // =================================================================
    // 1. DADOS FINANCEIROS (Preço, Liq, FDV, Variação)
    // =================================================================
    // Fonte: GeckoTerminal Pool API (Gratuito e Completo)
    const poolUrl = `https://api.geckoterminal.com/api/v2/networks/${NETWORK}/pools/${POOL_ADDRESS}`;
    
    const poolRes = await fetch(poolUrl);
    
    if (!poolRes.ok) {
      throw new Error(`Erro GeckoTerminal Pool API: ${poolRes.status}`);
    }
    
    const poolJson: any = await poolRes.json();
    
    // Proteção contra resposta vazia
    if (!poolJson.data || !poolJson.data.attributes) {
      throw new Error("Dados do pool inválidos ou vazios");
    }

    const attr = poolJson.data.attributes;

    // Extração Direta dos Dados
    const price = parseFloat(attr.base_token_price_usd || "0");
    const change24h = parseFloat(attr.price_change_percentage?.h24 || "0");
    const liquidity = parseFloat(attr.reserve_in_usd || "0");
    const marketCap = parseFloat(attr.fdv_usd || "0");

    // MODO RÁPIDO (Cron de 5 min): 
    // Retorna os dados financeiros e encerra para economizar tempo de execução
    if (mode === 'price_only') {
      return {
        price,
        change24h,
        marketCap,
        liquidity,
        type: 'partial'
      };
    }

    // =================================================================
    // 2. MODO FULL (Cron de 1h): GRÁFICO (Histórico OHLCV)
    // =================================================================
    let history: any[] = [];
    
    try {
      // Busca velas DIÁRIAS (day) dos últimos 30 dias
      const ohlcvUrl = `https://api.geckoterminal.com/api/v2/networks/${NETWORK}/pools/${POOL_ADDRESS}/ohlcv/day?limit=30`;
      
      const histRes = await fetch(ohlcvUrl);
      const histData: any = await histRes.json();
      const candles = histData.data?.attributes?.ohlcv_list;

      if (candles && Array.isArray(candles)) {
        // O Gecko devolve array: [time, open, high, low, close, volume]
        // Mapeamos para nosso formato leve: { t: timestamp, p: close_price }
        history = candles.map((item: any) => ({
          t: item[0], // Timestamp (seconds)
          p: item[4]  // Close Price
        })).sort((a: any, b: any) => a.t - b.t); // Garante ordem cronológica
      }
    } catch (e) {
      console.warn("⚠️ Falha ao buscar gráfico GeckoTerminal (usando fallback):", e);
    }

    // Fallback de Segurança: Se a API de gráfico falhar, cria linha reta baseada no preço atual
    // Isso impede que o gráfico no frontend fique vazio/quebrado
    if (history.length === 0 && price > 0) {
        const now = Math.floor(Date.now() / 1000);
        history = [
            { t: now - (86400 * 30), p: price }, // 30 dias atrás
            { t: now, p: price }                 // Hoje
        ];
    }

    return {
      price,
      change24h,
      marketCap,
      liquidity,
      history,
      lastUpdated: new Date().toISOString(),
      type: 'full'
    };

  } catch (error: any) {
    console.error("❌ Erro Market Service:", error.message);
    // Retorna null para que o Cron saiba que falhou e não substitua o cache com lixo
    return null;
  }
}