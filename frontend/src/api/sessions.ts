import { apiFetch } from './client';

export async function startSession(activityId: string): Promise<{ id: string }> {
  const res = await apiFetch('/api/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ activityId }),
  });
  if (!res.ok) throw new Error('failed to start session');
  return res.json();
}

export async function sendHeartbeat(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/heartbeat`, { method: 'POST' });
  if (!res.ok) throw new Error('failed to send heartbeat');
  return res.json();
}

export async function endSession(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
  if (!res.ok) throw new Error('failed to end session');
  return res.json();
}
