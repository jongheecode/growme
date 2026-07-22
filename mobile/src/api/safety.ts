import { apiFetch } from './client';

export interface BlockedUser {
  id: string;
  nickname: string;
}

export async function blockUser(userId: string): Promise<void> {
  const res = await apiFetch('/api/safety/block', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error('차단하지 못했어요');
}

export async function unblockUser(userId: string): Promise<void> {
  const res = await apiFetch(`/api/safety/block/${userId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('차단을 해제하지 못했어요');
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const res = await apiFetch('/api/safety/blocked');
  if (!res.ok) throw new Error('차단 목록을 불러오지 못했어요');
  return res.json();
}

export async function reportUser(userId: string, reason: string): Promise<void> {
  const res = await apiFetch('/api/safety/report', {
    method: 'POST',
    body: JSON.stringify({ userId, reason }),
  });
  if (!res.ok) throw new Error('신고를 접수하지 못했어요');
}
