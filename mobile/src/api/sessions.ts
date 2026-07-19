import { apiFetch } from './client';

export async function startTaskSession(taskId: string): Promise<{ id: string; startedAt: string }> {
  const res = await apiFetch('/api/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
  if (!res.ok) throw new Error('타이머를 시작하지 못했어요');
  return res.json();
}

export async function sendHeartbeat(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/heartbeat`, { method: 'POST' });
  if (!res.ok) throw new Error('하트비트 전송에 실패했어요');
  return res.json();
}

export async function endSession(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
  if (!res.ok) throw new Error('타이머를 종료하지 못했어요');
  return res.json();
}
