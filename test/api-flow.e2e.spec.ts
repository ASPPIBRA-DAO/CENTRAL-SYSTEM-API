import { describe, test, expect } from 'vitest';
import { apiFetch } from './helpers/api';
import { registerAndAuthenticate } from './helpers/auth';
import { createTestPost } from './helpers/data-factory';
import { expectValidPost } from './contracts/post.contract';

describe('🚀 Governance System – End-to-End Flow', () => {
  let authToken: string;
  let postId: number;

  test('Auth → Deve registrar e autenticar admin', async () => {
    const auth = await registerAndAuthenticate();
    authToken = auth.token;

    expect(authToken).toBeTruthy();
  });

  test('Health → DB deve estar conectado', async () => {
    const { res, body } = await apiFetch('/core/health/db');

    expect(res.status).toBe(200);
    expect(body.message).toBe('DB Connected');
  });

  test('SocialFi → Deve criar post institucional', async () => {
    const postPayload = createTestPost();

    const { res, body } = await apiFetch('/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(postPayload)
    });

    expect(res.status).toBe(201);
    expectValidPost(body.data);
    expect(body.data.slug).toBe(postPayload.slug);

    postId = body.data.id;
  });

  test('Engajamento → Deve registrar favorito', async () => {
    const { res } = await apiFetch(`/posts/${postId}/favorite`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    expect(res.status).toBe(200);
  });

  test('RWA → Deve retornar dados reais do ativo', async () => {
    const { res, body } = await apiFetch('/products/rwa/token-data');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});