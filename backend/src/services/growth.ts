import { prisma } from '../db';
import { STAGE_THRESHOLDS } from '../constants';

export async function applySessionToGrowth(userId: string, verifiedSeconds: number) {
  const existing = await prisma.growth.findUnique({ where: { userId } });
  const newGauge = (existing?.currentGauge ?? 0) + verifiedSeconds;
  await prisma.growth.upsert({
    where: { userId },
    create: { userId, currentGauge: newGauge, lastActiveDate: new Date() },
    update: { currentGauge: newGauge, lastActiveDate: new Date() },
  });
}

export function getStageForGauge(gaugeSeconds: number): number {
  let stage = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (gaugeSeconds >= STAGE_THRESHOLDS[i]) stage = i;
  }
  return stage;
}

export async function recomputeDominantCategory(userId: string): Promise<string | null> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    include: { activity: { select: { category: true } } },
  });
  if (sessions.length === 0) return null;
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    const cat = s.activity.category;
    totals[cat] = (totals[cat] ?? 0) + s.verifiedSeconds;
  }
  let dominant = Object.keys(totals)[0];
  for (const cat of Object.keys(totals)) {
    if (totals[cat] > totals[dominant]) dominant = cat;
  }
  return dominant;
}
