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

export async function forgotPassword(email: string): Promise<void> {
  const res = await apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('요청을 처리하지 못했어요');
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) throw new Error('비밀번호를 재설정하지 못했어요');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error('비밀번호를 변경하지 못했어요');
}
