import { apiFetch } from './client';
import { Species } from './growth';

export interface FriendRequest {
  id: string;
  requesterId: string;
  requesterNickname: string;
}

export interface Friend {
  id: string;
  nickname: string;
  species: Species | null;
  stage: number;
  totalXp: number;
}

export async function requestFriend(nickname: string): Promise<{ id: string }> {
  const res = await apiFetch('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error('친구 요청을 보내지 못했어요');
  return res.json();
}

export async function listFriendRequests(): Promise<FriendRequest[]> {
  const res = await apiFetch('/api/friends/requests');
  if (!res.ok) throw new Error('친구 요청 목록을 불러오지 못했어요');
  return res.json();
}

export async function acceptFriendRequest(id: string): Promise<void> {
  const res = await apiFetch(`/api/friends/${id}/accept`, { method: 'POST' });
  if (!res.ok) throw new Error('친구 요청을 수락하지 못했어요');
}

export async function removeFriendship(id: string): Promise<void> {
  const res = await apiFetch(`/api/friends/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('처리하지 못했어요');
}

export async function listFriends(): Promise<Friend[]> {
  const res = await apiFetch('/api/friends');
  if (!res.ok) throw new Error('친구 목록을 불러오지 못했어요');
  return res.json();
}
