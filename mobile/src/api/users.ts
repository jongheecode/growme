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
