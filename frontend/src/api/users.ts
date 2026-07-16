import { apiFetch } from './client';

export interface UserProfile {
  id: string;
  email: string | null;
  nickname: string;
  bio: string | null;
  createdAt: string;
}

export async function getMe(): Promise<UserProfile> {
  const res = await apiFetch('/api/users/me');
  if (!res.ok) throw new Error('failed to fetch profile');
  return res.json();
}

export async function updateMe(data: { nickname?: string; bio?: string }): Promise<UserProfile> {
  const res = await apiFetch('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('failed to update profile');
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error('failed to change password');
}

export async function deleteMe(): Promise<void> {
  const res = await apiFetch('/api/users/me', { method: 'DELETE' });
  if (!res.ok) throw new Error('failed to delete account');
}
