import { apiFetch } from './client';

export interface HistoryEntry {
  date: string;
  category: string;
  verifiedSeconds: number;
}

export async function getHistory(range: 'daily' | 'weekly'): Promise<HistoryEntry[]> {
  const res = await apiFetch(`/api/history?range=${range}`);
  if (!res.ok) throw new Error('히스토리를 불러오지 못했어요');
  return res.json();
}
