const API_URL = 'http://127.0.0.1:8787/api';

export const apiFetch = async (
  path: string,
  options: RequestInit = {}
) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const body = await res.json().catch(() => null);

  return { res, body };
};