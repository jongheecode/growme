import { apiFetch } from './client';

export interface Activity {
  id: string;
  name: string;
  category: 'EXERCISE' | 'STUDY' | 'READING' | 'ETC';
}

export async function listActivities(): Promise<Activity[]> {
  const res = await apiFetch('/api/activities');
  return res.json();
}

export async function createActivity(name: string, category: Activity['category']): Promise<Activity> {
  const res = await apiFetch('/api/activities', {
    method: 'POST',
    body: JSON.stringify({ name, category }),
  });
  return res.json();
}
