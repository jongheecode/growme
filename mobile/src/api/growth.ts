import { apiFetch } from './client';

export type Species = 'SPECIES_A' | 'SPECIES_B' | 'SPECIES_C';
export type PersonalityType =
  | 'STEADY_EASYGOING'
  | 'STEADY_LASTMINUTE'
  | 'LOOSE_EASYGOING'
  | 'LOOSE_LASTMINUTE';

export interface Personality {
  axisA: 'STEADY' | 'LOOSE';
  axisB: 'EASYGOING' | 'LASTMINUTE';
  type: PersonalityType;
}

export interface GrowthState {
  totalXp: number;
  species: Species | null;
  stage: number;
  xpIntoStage: number;
  xpToNextStage: number | null;
  personality: Personality | null;
  points: number;
}

export async function getGrowth(): Promise<GrowthState> {
  const res = await apiFetch('/api/growth/me');
  if (!res.ok) throw new Error('꾸미 정보를 불러오지 못했어요');
  return res.json();
}
