import { Species } from '@prisma/client';
import { prisma } from '../db';

export const SPECIES_STAGE_THRESHOLDS: Record<Species, number[]> = {
  SPECIES_A: [0, 50, 150, 400, 900],
  SPECIES_B: [0, 60, 180, 450, 1000],
  SPECIES_C: [0, 40, 130, 350, 800],
};

const SPECIES_LIST: Species[] = ['SPECIES_A', 'SPECIES_B', 'SPECIES_C'];

export async function getTotalXp(userId: string): Promise<number> {
  const result = await prisma.task.aggregate({
    where: { userId, status: 'COMPLETED' },
    _sum: { xpValue: true },
  });
  return result._sum.xpValue ?? 0;
}

export async function ensureHatched(
  userId: string,
  totalXp: number,
  rand: () => number = Math.random
): Promise<Species | null> {
  if (totalXp <= 0) return null;
  const profile = await prisma.growthProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  if (profile.species) return profile.species;
  const species = SPECIES_LIST[Math.floor(rand() * SPECIES_LIST.length)];
  const updated = await prisma.growthProfile.update({
    where: { userId },
    data: { species },
  });
  return updated.species;
}

export function getGrowthStageInfo(
  species: Species,
  totalXp: number
): { stage: number; xpIntoStage: number; xpToNextStage: number } {
  const thresholds = SPECIES_STAGE_THRESHOLDS[species];
  let stage = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (totalXp >= thresholds[i]) stage = i;
  }
  const xpIntoStage = totalXp - thresholds[stage];
  const nextThreshold = thresholds[stage + 1];
  const xpToNextStage = nextThreshold !== undefined ? nextThreshold - totalXp : 0;
  return { stage, xpIntoStage, xpToNextStage };
}

export interface Personality {
  axisA: 'STEADY' | 'LOOSE';
  axisB: 'EASYGOING' | 'LASTMINUTE';
  type: string;
}

export async function computePersonality(userId: string): Promise<Personality | null> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ['COMPLETED', 'FAILED'] } },
  });
  if (tasks.length < 3) return null;

  const completed = tasks.filter((t) => t.status === 'COMPLETED');
  const completionRate = completed.length / tasks.length;
  const axisA: Personality['axisA'] = completionRate >= 0.7 ? 'STEADY' : 'LOOSE';

  const early = completed.filter((t) => {
    if (!t.completedAt) return false;
    const totalWindow = t.dueAt.getTime() - t.createdAt.getTime();
    if (totalWindow <= 0) return true;
    const elapsed = t.completedAt.getTime() - t.createdAt.getTime();
    return elapsed <= totalWindow * 0.5;
  });
  const earlyRate = completed.length > 0 ? early.length / completed.length : 0;
  const axisB: Personality['axisB'] = earlyRate >= 0.5 ? 'EASYGOING' : 'LASTMINUTE';

  return { axisA, axisB, type: `${axisA}_${axisB}` };
}
