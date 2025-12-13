import { Hono } from 'hono';
import { Bindings } from '../../types/bindings';

const rwa = new Hono<{ Bindings: Bindings }>();

// Token ASPPIBRA (BSC)
const TOKEN_ADDRESS = '0x0697AB2B003FD2Cbaea2dF1ef9b404E45bE59d4C';

rwa.get('/price', async (c) => {
  // DexScreener API (Gratuita, Sem Key, Dados Completos)
  const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch price' }, 500);
    }

    const data: any = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      return c.json({ error: 'No liquidity found' }, 404);
    }

    // Pega o par principal (o mais líquido)
    const mainPair = data.pairs[0];
    
    return c.json({ 
      // 1. Preço
      price: parseFloat(mainPair.priceUsd),
      
      // 2. Variação 24h
      change24h: mainPair.priceChange ? parseFloat(mainPair.priceChange.h24) : 0,
      
      // 3. Liquidez
      liquidity: mainPair.liquidity ? parseFloat(mainPair.liquidity.usd) : 0,
      
      // 4. Market Cap (Novo)
      // Se marketCap for null, usamos o FDV (Fully Diluted Valuation) como fallback
      marketCap: mainPair.marketCap ? parseFloat(mainPair.marketCap) : (mainPair.fdv ? parseFloat(mainPair.fdv) : 0),
      
      timestamp: Date.now(),
      network: 'BSC',
      url: mainPair.url 
    });

  } catch (e) {
    console.error("DexScreener Error:", e);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default rwa;