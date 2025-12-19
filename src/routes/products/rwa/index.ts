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
import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';
import { ContentfulStatusCode } from 'hono/utils/http-status';

const rwa = new Hono<{ Bindings: Bindings }>();

// --- CONFIGURAÇÕES ---
const TOKEN_ADDRESS = '0x0697AB2B003FD2Cbaea2dF1ef9b404E45bE59d4C';
// Endereço do Par de Liquidez (Validado no Terminal)
const PAIR_ADDRESS = '0xf1961269D193f6511A1e24aaC93FBCA4E815e4Ca'; 
const CHAIN = 'bsc';

// ROTA 1: Dados Atuais (Snapshot)
// Cache curto de 15s para manter o preço "vivo"
rwa.get('/token-data', async (c) => {
  const apiKey = c.env.MORALIS_API_KEY;
  if (!apiKey) return c.json({ error: 'Config Error' }, 500);

  c.header('Cache-Control', 'public, max-age=15');

  const url = `https://deep-index.moralis.io/api/v2.2/erc20/${TOKEN_ADDRESS}/price?chain=${CHAIN}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
    });

    if (!response.ok) {
       return c.json({ success: false, error: 'Moralis Error' }, 500);
    }
    const data = await response.json();
    return c.json({ success: true, data: data });

  } catch (e) { return c.json({ error: 'Internal Error' }, 500); }
});

// ROTA 2: Histórico Real de 1 Ano (OHLCV do Par)
// ✅ CACHE: 6 Horas (21600 segundos) - Economia Extrema para Plano Free
rwa.get('/token-history', async (c) => {
  const apiKey = c.env.MORALIS_API_KEY;
  if (!apiKey) return c.json({ error: 'Config Error' }, 500);

  c.header('Cache-Control', 'public, max-age=21600');

  // 1. Calcula datas dinâmicas (Hoje e 1 Ano atrás)
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const toDate = today.toISOString().split('T')[0];
  const fromDate = oneYearAgo.toISOString().split('T')[0];

  // 2. Parâmetros validados no teste via Terminal
  const params = new URLSearchParams({
    chain: CHAIN,
    timeframe: '1d',     // Velas Diárias
    currency: 'usd',
    limit: '365',        // 1 Ano
    fromDate: fromDate,  // Obrigatório para endpoint de pares
    toDate: toDate       // Obrigatório para endpoint de pares
  });

  // Usa endpoint de PARES (/pairs/address/ohlcv) em vez de token
  const url = `https://deep-index.moralis.io/api/v2.2/pairs/${PAIR_ADDRESS}/ohlcv?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
    });

    if (!response.ok) {
       const err = await response.text();
       console.error("Moralis History Error:", err);
       // Retorna array vazio em vez de erro 500 para não quebrar o site visualmente
       return c.json({ success: true, data: [] }); 
    }

    const json = await response.json();
    // @ts-ignore
    const history = json.result || [];
    
    // 3. Ordenação: Garante que os dados estejam do Antigo -> Novo
    // (Importante para o gráfico SVG desenhar na direção certa)
    const sortedHistory = history.sort((a: any, b: any) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return c.json({ success: true, data: sortedHistory });

  } catch (e) { 
      console.error("History Fetch Error:", e);
      return c.json({ error: 'History Error' }, 500); 
  }
});

export default rwa;