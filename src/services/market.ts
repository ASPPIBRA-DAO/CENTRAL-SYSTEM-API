// ARQUIVO: src/services/market.ts
import { Bindings } from '../types/bindings';

export async function getTokenMarketData(env: Bindings) {
  // Seus Contratos
  const TOKEN_ADDRESS = "0x0697AB2B003FD2Cbaea2dF1ef9b404E45bE59d4C";
  const PAIR_ADDRESS  = "0xf1961269D193f6511A1e24aaC93FBCA4E815e4Ca";
  const CHAIN = "bsc"; 

  const headers = {
    "Accept": "application/json",
    "X-API-Key": env.MORALIS_API_KEY // Isso vai ler do .dev.vars localmente
  };

  try {
    console.log(`🔍 [TESTE LOCAL] Buscando dados para ${TOKEN_ADDRESS}...`);

    // Busca Preço
    const priceReq = await fetch(
      `https://deep-index.moralis.io/api/v2.2/erc20/${TOKEN_ADDRESS}/price?chain=${CHAIN}`,
      { headers }
    );

    if (!priceReq.ok) {
      const err = await priceReq.text();
      throw new Error(`Erro Moralis API: ${priceReq.status} - ${err}`);
    }

    const priceData: any = await priceReq.json();
    
    // Retorna o resultado simplificado para teste
    return {
      source: "Moralis Local Test",
      price: priceData.usdPrice,
      exchange: priceData.exchangeName,
      address: priceData.tokenAddress
    };

  } catch (error: any) {
    console.error("❌ Falha no teste:", error.message);
    return { error: error.message };
  }
}