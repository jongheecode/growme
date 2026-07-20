import { apiFetch } from './client';
import { Category, Difficulty } from './tasks';

export interface HistoryEntry {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  status: 'COMPLETED' | 'FAILED';
  xpValue: number;
  occurredAt: string;
  focusSeconds: number;
}

export async function getTaskHistory(): Promise<HistoryEntry[]> {
  const res = await apiFetch('/api/history/tasks');
  if (!res.ok) throw new Error('히스토리를 불러오지 못했어요');
  return res.json();
}
