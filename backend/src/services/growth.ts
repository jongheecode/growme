import { prisma } from '../db';

// Task 12에서 성장/퇴화 로직 전체로 확장 예정. 지금은 최소 구현만 제공.
export async function applySessionToGrowth(userId: string, verifiedSeconds: number) {
  const existing = await prisma.growth.findUnique({ where: { userId } });
  const newGauge = (existing?.currentGauge ?? 0) + verifiedSeconds;
  await prisma.growth.upsert({
    where: { userId },
    create: { userId, currentGauge: newGauge, lastActiveDate: new Date() },
    update: { currentGauge: newGauge, lastActiveDate: new Date() },
  });
}
