import { apiFetch } from './client';

export interface Me {
  id: string;
  email: string | null;
  nickname: string;
  bio: string | null;
  createdAt: string;
}

export async function getMe(): Promise<Me> {
  const res = await apiFetch('/api/users/me');
  if (!res.ok) throw new Error('내 정보를 불러오지 못했어요');
  return res.json();
}

export async function updateEmail(email: string): Promise<Me> {
  const res = await apiFetch('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ email }),
  });
  if (res.status === 409) throw new Error('이미 사용 중인 이메일이에요');
  if (!res.ok) throw new Error('이메일을 변경하지 못했어요');
  return res.json();
}

export async function deleteAccount(): Promise<void> {
  const res = await apiFetch('/api/users/me', { method: 'DELETE' });
  if (!res.ok) throw new Error('회원 탈퇴에 실패했어요');
}
