/**
 * Copyright 2026 ASPPIBRA – Associação dos Proprietários e Possuidores de Imóveis no Brasil.
 * Project: Governance System (ASPPIBRA DAO)
 * Role: Authentication Test Helper (Resilient Flow)
 * Version: 1.2.1 - Fix: Strict Type Alignment & Error Handling
 */

import { apiFetch } from './api';

/**
 * Interface simples para evitar erros de 'unknown' dentro do helper
 */
interface AuthResponse {
  success: boolean;
  data?: {
    accessToken: string;
    user?: any;
  };
  message?: string;
}

export const registerAndAuthenticate = async () => {
  /**
   * [1] GERAÇÃO DE CREDENCIAIS ÚNICAS
   * O timestamp garante que cada execução de teste use um usuário novo,
   * evitando erros de 'Email already exists' no banco D1.
   */
  const timestamp = Date.now();
  const testUser = {
    email: `admin.test.${timestamp}@asppibra.com`,
    password: 'Password123!',
    name: 'Vitest Admin'
  };

  /**
   * [2] TENTATIVA DE REGISTRO
   * O helper apiFetch já cuida do prefixo /api e do SELF.fetch interno.
   */
  const registration = await apiFetch('/core/auth/register', {
    method: 'POST',
    body: JSON.stringify(testUser)
  });

  const regBody = registration.body as AuthResponse;
  let token = regBody?.data?.accessToken;

  /**
   * [3] LÓGICA DE RESILIÊNCIA (FALLBACK)
   * Se o registro falhar (status != 201), tentamos o login direto.
   * Isso é vital se o banco D1 persistir dados entre testes rápidos.
   */
  if (registration.res.status !== 201 || !token) {
    const login = await apiFetch('/core/auth/login', {
      method: 'POST',
      body: JSON.stringify({ 
        email: testUser.email, 
        password: testUser.password 
      })
    });

    const loginBody = login.body as AuthResponse;

    if (login.res.status !== 200 || !loginBody?.data?.accessToken) {
      // Log detalhado para debug em caso de falha no D1
      console.error('❌ Erro Crítico na Auth de Teste:', loginBody?.message || 'Erro Desconhecido');
      throw new Error(`Falha na autenticação: Status ${login.res.status}`);
    }

    token = loginBody.data.accessToken;
  }

  return {
    token: token as string,
    user: testUser
  };
};