import { apiFetch } from './client';

export type Category = 'EXERCISE' | 'STUDY' | 'READING' | 'ETC';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type TaskStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type DueChoice = 'TODAY' | 'THIS_WEEK';

export interface Task {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  xpValue: number;
  dueAt: string;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
}

export async function listTasks(): Promise<Task[]> {
  const res = await apiFetch('/api/tasks');
  if (!res.ok) throw new Error('할일 목록을 불러오지 못했어요');
  return res.json();
}

export async function createTask(
  title: string,
  category: Category,
  difficulty: Difficulty,
  dueChoice: DueChoice
): Promise<Task> {
  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, category, difficulty, dueChoice }),
  });
  if (!res.ok) throw new Error('할일을 추가하지 못했어요');
  return res.json();
}

export async function completeTask(id: string): Promise<Task> {
  const res = await apiFetch(`/api/tasks/${id}/complete`, { method: 'PATCH' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    if (body.error === 'task expired') throw new Error('이미 기한이 지났습니다');
    throw new Error('할일을 완료하지 못했어요');
  }
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('할일을 삭제하지 못했어요');
}
