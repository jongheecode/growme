import { apiFetch } from './client';
import { Category } from './tasks';

export interface Challenge {
  id: string;
  name: string;
  category: Category | null;
  targetXp: number;
  startDate: string;
  endDate: string;
  inviteCode: string;
  createdById: string;
}

export interface MyChallenge extends Challenge {
  achievedXp: number;
  percent: number;
}

export interface ChallengeMemberProgress {
  userId: string;
  nickname: string;
  achievedXp: number;
  percent: number;
}

export interface ChallengeDetail extends Challenge {
  members: ChallengeMemberProgress[];
}

export async function createChallenge(
  name: string,
  targetXp: number,
  startDate: string,
  endDate: string,
  category?: Category
): Promise<Challenge> {
  const res = await apiFetch('/api/challenges', {
    method: 'POST',
    body: JSON.stringify({ name, targetXp, startDate, endDate, category }),
  });
  if (!res.ok) throw new Error('챌린지를 만들지 못했어요');
  return res.json();
}

export async function listMyChallenges(): Promise<MyChallenge[]> {
  const res = await apiFetch('/api/challenges/mine');
  if (!res.ok) throw new Error('챌린지 목록을 불러오지 못했어요');
  return res.json();
}

export async function getChallenge(id: string): Promise<ChallengeDetail> {
  const res = await apiFetch(`/api/challenges/${id}`);
  if (!res.ok) throw new Error('챌린지 정보를 불러오지 못했어요');
  return res.json();
}

export async function joinChallenge(inviteCode: string): Promise<{ id: string }> {
  const res = await apiFetch('/api/challenges/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
  if (!res.ok) throw new Error('챌린지에 참여하지 못했어요');
  return res.json();
}

export async function leaveChallenge(id: string): Promise<void> {
  const res = await apiFetch(`/api/challenges/${id}/leave`, { method: 'DELETE' });
  if (!res.ok) throw new Error('챌린지에서 나가지 못했어요');
}
