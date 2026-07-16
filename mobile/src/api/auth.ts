import { apiFetch } from './client';

interface AuthResponse {
  token: string;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('로그인에 실패했어요');
  const data = (await res.json()) as AuthResponse;
  return data.token;
}

export async function signup(
  email: string,
  password: string,
  nickname: string
): Promise<string> {
  const res = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
  });
  if (!res.ok) throw new Error('회원가입에 실패했어요');
  const data = (await res.json()) as AuthResponse;
  return data.token;
}
