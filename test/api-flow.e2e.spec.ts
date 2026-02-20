/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: End-to-End (E2E) Integration Testing
 * Version: 1.2.1 - Fix: TS18046 Strict Typing for API Responses
 */

import { describe, test, expect } from 'vitest';
import { apiFetch } from './helpers/api';
import { registerAndAuthenticate } from './helpers/auth';
import { createTestPost } from './helpers/data-factory';
import { expectValidPost } from './contracts/post.contract';

/**
 * 🛠️ INTERFACE DE RESPOSTA PADRONIZADA
 * Elimina o erro de tipo 'unknown' ao definir a estrutura de dados da API.
 */
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

describe('🚀 Governance System – End-to-End Flow', () => {
  // Variáveis de estado para persistência entre os steps do fluxo
  let authToken: string;
  let postId: string | number;

  /**
   * [1] TESTE DE AUTENTICAÇÃO
   * Valida o ciclo completo de registro e geração de JWT.
   */
  test('Auth → Deve registrar e autenticar admin', async () => {
    const auth = await registerAndAuthenticate();
    authToken = auth.token;

    // Garante que o token foi gerado e possui um tamanho mínimo de segurança
    expect(authToken).toBeDefined();
    expect(authToken.length).toBeGreaterThan(20);
  });

  /**
   * [2] TESTE DE INFRAESTRUTURA (D1)
   * Valida se a rota de health check responde com o status do banco.
   */
  test('Health → DB deve estar conectado', async () => {
    const response = await apiFetch('/api/core/health/db');
    
    // Casting seguro para ApiResponse
    const body = response.body as ApiResponse;

    expect(response.res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  /**
   * [3] TESTE DE NEGÓCIO (SocialFi)
   * Valida a persistência de posts institucionais.
   */
  test('SocialFi → Deve criar post institucional', async () => {
    const postPayload = createTestPost();

    const response = await apiFetch('/api/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(postPayload)
    });

    const body = response.body as ApiResponse;

    expect(response.res.status).toBe(201);
    
    // Validação profunda via contrato (zod/schema)
    expectValidPost(body.data);
    expect(body.data.slug).toBe(postPayload.slug);

    // Captura o ID para o próximo teste de engajamento
    postId = body.data.id;
  });

  /**
   * [4] TESTE DE ENGAJAMENTO
   * Valida operações dependentes de contexto (Post ID + Auth Token).
   */
  test('Engajamento → Deve registrar favorito', async () => {
    const response = await apiFetch(`/api/posts/${postId}/favorite`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    // Aceita 200 (OK) ou 201 (Created)
    expect([200, 201]).toContain(response.res.status);
  });

  /**
   * [5] TESTE DE ATIVOS REAIS (RWA)
   * Valida a entrega de dados públicos do ecossistema financeiro.
   */
  test('RWA → Deve retornar dados reais do ativo', async () => {
    const response = await apiFetch('/api/products/rwa/list');
    
    // Casting seguro para ApiResponse
    const body = response.body as ApiResponse;

    expect(response.res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    
    // Verifica se a lista não está nula e é um array
    expect(Array.isArray(body.data)).toBe(true);
  });
});