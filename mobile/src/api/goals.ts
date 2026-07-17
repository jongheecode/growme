import { apiFetch } from './client';
import { Category } from './tasks';

export interface Goal {
  id: string;
  title: string;
  category: Category;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
  goalSet: boolean;
  goal?: Goal;
}

export async function listGoals(): Promise<Goal[]> {
  const res = await apiFetch('/api/goals');
  if (!res.ok) throw new Error('목표 목록을 불러오지 못했어요');
  return res.json();
}

export async function sendGoalChatMessage(messages: ChatMessage[]): Promise<ChatResult> {
  const res = await apiFetch('/api/goals/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error('메시지를 보내지 못했어요');
  return res.json();
}
