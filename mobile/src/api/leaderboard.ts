import { apiFetch } from './client';

export type LeaderboardScope = 'friends' | 'global';
export type LeaderboardRange = 'weekly' | 'alltime';

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  totalXp: number;
  rank: number;
}

export async function getLeaderboard(
  scope: LeaderboardScope,
  range: LeaderboardRange
): Promise<LeaderboardEntry[]> {
  const res = await apiFetch(`/api/leaderboard?scope=${scope}&range=${range}`);
  if (!res.ok) throw new Error('랭킹을 불러오지 못했어요');
  return res.json();
}
