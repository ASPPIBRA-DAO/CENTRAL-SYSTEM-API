import { apiFetch } from './api';
import { createTestUser } from './data-factory';

export const registerAndAuthenticate = async () => {
  const user = createTestUser();

  const { res, body } = await apiFetch('/core/auth/register', {
    method: 'POST',
    body: JSON.stringify(user)
  });

  if (res.status !== 201 || !body?.data?.accessToken) {
    throw new Error('Falha ao registrar usuário de teste');
  }

  return {
    token: body.data.accessToken,
    user
  };
};