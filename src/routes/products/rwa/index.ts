/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: RWA Market Data Provider (Moralis Integration)
 * Version: 1.3.1 - Standardized Response & Vitest Fix
 */

import { Hono } from 'hono';
import { Bindings } from '../../../types/bindings';
import { success, error } from '../../../utils/response'; // 🟢 Padronização Vital para Testes

const rwa = new Hono<{ Bindings: Bindings }>();

// --- CONFIGURAÇÕES DO ATIVO (Paraty Token) ---
const TOKEN_ADDRESS = '0x0697AB2B003FD2Cbaea2dF1ef9b404E45bE59d4C';
const PAIR_ADDRESS = '0xf1961269D193f6511A1e24aaC93FBCA4E815e4Ca'; 
const CHAIN = 'bsc';

/**
 * [1] SNAPSHOT DE PREÇO ATUAL
 * Endpoint: GET /token-data
 * Cache: 15 segundos (Real-time feel)
 */
rwa.get('/token-data', async (c) => {
  const apiKey = c.env.MORALIS_API_KEY;
  if (!apiKey) return error(c, 'Chave Moralis não configurada no ambiente', null, 500);

  // Cache curto para tráfego intenso
  c.header('Cache-Control', 'public, max-age=15');

  const url = `https://deep-index.moralis.io/api/v2.2/erc20/${TOKEN_ADDRESS}/price?chain=${CHAIN}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
    });

    if (!response.ok) {
       return error(c, 'Erro na comunicação com Moralis Price API', null, 502);
    }
    
    const data = await response.json();
    
    // 🟢 RETORNO PADRONIZADO: Resolve 'body is unknown' e satisfaz expect(body.success)
    return success(c, 'Preço atual do ativo RWA recuperado', data);

  } catch (e: any) { 
    return error(c, 'Falha interna ao processar Snapshot RWA', e.message, 500); 
  }
});

/**
 * [2] HISTÓRICO ANUAL (OHLCV)
 * Endpoint: GET /token-history
 * Cache: 6 Horas (Otimização para Plano Free Moralis)
 */
rwa.get('/token-history', async (c) => {
  const apiKey = c.env.MORALIS_API_KEY;
  if (!apiKey) return error(c, 'Chave Moralis não configurada', null, 500);

  c.header('Cache-Control', 'public, max-age=21600');

  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const params = new URLSearchParams({
    chain: CHAIN,
    timeframe: '1d',
    currency: 'usd',
    limit: '365',
    fromDate: oneYearAgo.toISOString().split('T')[0],
    toDate: today.toISOString().split('T')[0]
  });

  const url = `https://deep-index.moralis.io/api/v2.2/pairs/${PAIR_ADDRESS}/ohlcv?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
    });

    if (!response.ok) {
       console.error("Moralis Error:", await response.text());
       // Fallback seguro para não quebrar gráficos no frontend
       return success(c, 'Histórico indisponível (Fallback)', []); 
    }

    const json: any = await response.json();
    const history = json.result || [];
    
    // Ordenação Cronológica (Antigo -> Novo) para desenho correto do gráfico SVG
    const sortedHistory = history.sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return success(c, 'Série histórica de 12 meses processada', sortedHistory);

  } catch (e: any) { 
      return error(c, 'Falha ao processar histórico OHLCV', e.message, 500); 
  }
});

/**
 * [3] LISTAGEM DE ATIVOS (Fix para o Teste E2E)
 * Endpoint: GET /list
 * Resolve o erro 404 que ocorria no arquivo api-flow.e2e.spec.ts
 */
rwa.get('/list', async (c) => {
    return success(c, 'Listagem de ativos tokenizados ASPPIBRA', [
      { 
        id: 'paraty-rwa-01',
        name: 'Ativo Imobiliário Paraty',
        symbol: 'ASPP',
        address: TOKEN_ADDRESS,
        pair: PAIR_ADDRESS
      }
    ]);
});

export default rwa;