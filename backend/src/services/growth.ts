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

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

// 하루라도 완료한 태스크가 있으면 그 날은 "streak 유지"로 친다. 오늘 아직
// 아무것도 완료 안 했어도 어제까지 이어져 있었다면 스트릭은 끊긴 게 아니라
// "오늘 아직 진행 중"인 상태로 본다 — 자정 넘기자마자 스트릭이 사라지는
// 것을 막기 위함.
export async function computeStreak(userId: string, now: Date = new Date()): Promise<StreakInfo> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: 'COMPLETED', completedAt: { not: null } },
    select: { completedAt: true },
  });
  const days = new Set(tasks.map((t) => dateKey(t.completedAt!)));
  if (days.size === 0) return { currentStreak: 0, longestStreak: 0 };

  let currentStreak = 0;
  if (days.has(dateKey(now)) || days.has(dateKey(addDays(now, -1)))) {
    let day = days.has(dateKey(now)) ? now : addDays(now, -1);
    while (days.has(dateKey(day))) {
      currentStreak++;
      day = addDays(day, -1);
    }
  }

  const sortedDays = [...days]
    .map((key) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m, d);
    })
    .sort((a, b) => a.getTime() - b.getTime());

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const isConsecutive = dateKey(addDays(sortedDays[i - 1], 1)) === dateKey(sortedDays[i]);
    run = isConsecutive ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}
