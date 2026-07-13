import { apiFetch } from './client';

export interface GrowthState {
  currentGauge: number;
  stage: number;
  dominantCategory: 'EXERCISE' | 'STUDY' | 'READING' | 'ETC';
}

export async function getMyGrowth(): Promise<GrowthState> {
  const res = await apiFetch('/api/growth/me');
  if (!res.ok) throw new Error('failed to fetch growth');
  return res.json();
}
