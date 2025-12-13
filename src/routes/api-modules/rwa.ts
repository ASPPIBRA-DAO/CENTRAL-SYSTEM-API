import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';

const rwa = new Hono<{ Bindings: Bindings }>();

// --- CONFIGURAÇÃO DA BNB SMART CHAIN (BSC) ---

// 1. Chain ID da BSC (Binance Smart Chain) é 56
const CHAIN_ID = '56'; 

// 2. Seu Token (ASPPBR) - Token que queremos saber o preço
const BUY_TOKEN = '0x55d398326f99059fF775485246999027B3197955';

// 3. USDT na BSC (BEP-20) - Token que estamos "vendendo" para simular o preço em Dólar
// Endereço oficial do Tether USD na BSC
const SELL_TOKEN = '0x0697AB2B003FD2Cbaea2dF1ef9b404E45bE59d4C'; 

rwa.get('/price', async (c) => {
  const apiKey = c.env.ZERO_EX_API_KEY;

  if (!apiKey) {
    // Retorna erro se a chave não estiver configurada no Cloudflare
    return c.json({ error: 'API Key not configured' }, 500);
  }

  // Lógica: "Quanto custa comprar 1 ASPPBR pagando em USDT?"
  // A API vai nos dizer quantos USDT precisamos para levar 1 ASPPBR.
  // Isso é o preço direto do token.

  const params = new URLSearchParams({
    sellToken: SELL_TOKEN, // Pagamos com USDT
    buyToken: BUY_TOKEN,   // Recebemos ASPPBR
    buyAmount: '1000000000000000000', // 1 ASPPBR (considerando 18 decimais)
  });

  try {
    const response = await fetch(`https://bsc.api.0x.org/swap/v1/price?${params.toString()}`, {
      headers: {
        '0x-api-key': apiKey,
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('0x API Error:', errText);
      return c.json({ error: 'Failed to fetch price' }, response.status as any);
    }

    const data: any = await response.json();

    // A resposta 'sellAmount' diz quantos USDT custa comprar aquele 1 ASPPBR.
    // O USDT na BSC tem 18 decimais (diferente da Ethereum que tem 6).
    const usdtCostRaw = parseFloat(data.sellAmount);
    const usdtDecimals = 18; 
    
    // Preço final formatado
    const priceInUsd = usdtCostRaw / Math.pow(10, usdtDecimals);

    return c.json({ 
      price: priceInUsd,
      timestamp: Date.now(),
      network: 'BSC'
    });

  } catch (e) {
    console.error(e);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default rwa;