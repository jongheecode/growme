import { apiFetch } from './client';

export async function login(email: string, password: string) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('login failed');
  return res.json();
}

export async function signup(email: string, password: string, nickname: string) {
  const res = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
  });
  if (!res.ok) throw new Error('signup failed');
  return res.json();
}
