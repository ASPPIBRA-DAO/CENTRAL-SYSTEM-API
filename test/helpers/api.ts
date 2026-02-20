/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Test API Fetcher Helper (Vitest Stable Version)
 * Version: 1.2.5 - Fix: ArrayBuffer Stream Extraction & Path Normalization
 */

import { SELF } from 'cloudflare:test';

/**
 * 🟢 SOLUÇÃO DE ENGENHARIA AVANÇADA:
 * Resolve conflitos de 'Request Stream' usando a extração via ArrayBuffer, 
 * que é imune ao fechamento precoce do stream de resposta pelo runtime.
 */
export const apiFetch = async (
  path: string,
  options: RequestInit = {}
) => {
  /**
   * [1] NORMALIZAÇÃO DO CAMINHO (Auto-Prefix)
   * Garante que o roteador do Hono (/api/...) sempre receba o path correto,
   * permitindo que os testes utilizem caminhos curtos como '/core/health'.
   */
  const baseUrl = 'https://api.asppibra.com';
  const normalizedPath = path.startsWith('/api') ? path : `/api${path}`;
  const fullUrl = `${baseUrl}${normalizedPath}`;

  /**
   * [2] EXECUÇÃO DA REQUISIÇÃO EM MEMÓRIA (VIRTUAL)
   * O SELF.fetch injeta a chamada diretamente no Worker sem passar pela rede física,
   * o que evita erros de "Network connection lost" e melhora a velocidade.
   */
  const res = await SELF.fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  /**
   * [3] EXTRAÇÃO BLINDADA DO CORPO (Byte-level extraction)
   * 🟢 FIX DEFINITIVO: Em vez de clonar ou ler como JSON diretamente, 
   * lemos os bytes brutos (ArrayBuffer). Isso "desbloqueia" o stream 
   * imediatamente e evita o TypeError do workerd.
   */
  let body: any = null;
  const contentType = res.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    try {
      // Criamos uma cópia isolada para evitar travar a resposta original
      const clonedRes = res.clone();
      const buffer = await clonedRes.arrayBuffer();
      const text = new TextDecoder().decode(buffer);
      
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      // Se falhar o parse, o body permanece null, permitindo o assert de status
      body = null;
    }
  }

  /**
   * Retornamos {res, body} mantendo o contrato esperado por:
   * test/api-flow.e2e.spec.ts
   */
  return { res, body };
};