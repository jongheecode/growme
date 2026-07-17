import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import {
  getTotalXp,
  ensureHatched,
  getGrowthStageInfo,
  computePersonality,
  SPECIES_STAGE_THRESHOLDS,
} from './growth';

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: 'x', nickname: '테스터' } });
}

describe('getTotalXp', () => {
  it('returns 0 when there are no completed tasks', async () => {
    const user = await makeUser('xp1@example.com');
    expect(await getTotalXp(user.id)).toBe(0);
  });

  it('sums only COMPLETED task XP, ignoring PENDING and FAILED', async () => {
    const user = await makeUser('xp2@example.com');
    await prisma.task.create({
      data: { userId: user.id, title: 'a', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', dueAt: new Date() },
    });
    await prisma.task.create({
      data: { userId: user.id, title: 'b', category: 'ETC', difficulty: 'MEDIUM', xpValue: 20, status: 'COMPLETED', dueAt: new Date() },
    });
    await prisma.task.create({
      data: { userId: user.id, title: 'c', category: 'ETC', difficulty: 'HARD', xpValue: 35, status: 'PENDING', dueAt: new Date() },
    });
    await prisma.task.create({
      data: { userId: user.id, title: 'd', category: 'ETC', difficulty: 'HARD', xpValue: 35, status: 'FAILED', dueAt: new Date() },
    });
    expect(await getTotalXp(user.id)).toBe(30);
  });
});

describe('ensureHatched', () => {
  it('returns null when totalXp is 0', async () => {
    const user = await makeUser('hatch1@example.com');
    expect(await ensureHatched(user.id, 0)).toBeNull();
  });

  it('assigns a species deterministically via the injected rand function', async () => {
    const user = await makeUser('hatch2@example.com');
    const species = await ensureHatched(user.id, 10, () => 0);
    expect(species).toBe('SPECIES_A');
  });

  it('keeps the species fixed on subsequent calls even if rand changes', async () => {
    const user = await makeUser('hatch3@example.com');
    const first = await ensureHatched(user.id, 10, () => 0);
    const second = await ensureHatched(user.id, 50, () => 0.99);
    expect(second).toBe(first);
  });
});

describe('getGrowthStageInfo', () => {
  it('returns stage 0 with correct progress below the first threshold', () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS.SPECIES_A;
    const info = getGrowthStageInfo('SPECIES_A', 10);
    expect(info.stage).toBe(0);
    expect(info.xpIntoStage).toBe(10);
    expect(info.xpToNextStage).toBe(thresholds[1] - 10);
  });

  it('returns the max stage with 0 xpToNextStage once XP exceeds the last threshold', () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS.SPECIES_A;
    const info = getGrowthStageInfo('SPECIES_A', thresholds[thresholds.length - 1] + 1000);
    expect(info.stage).toBe(thresholds.length - 1);
    expect(info.xpToNextStage).toBe(0);
  });
});

describe('computePersonality', () => {
  it('returns null when fewer than 3 completed+failed tasks exist', async () => {
    const user = await makeUser('personality1@example.com');
    await prisma.task.create({
      data: { userId: user.id, title: 'a', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', dueAt: new Date(), completedAt: new Date() },
    });
    expect(await computePersonality(user.id)).toBeNull();
  });

  it('classifies STEADY when completion rate is high', async () => {
    const user = await makeUser('personality2@example.com');
    for (let i = 0; i < 4; i++) {
      const createdAt = new Date(Date.now() - 10_000);
      const dueAt = new Date(Date.now() + 10_000);
      await prisma.task.create({
        data: { userId: user.id, title: `a${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt: new Date(createdAt.getTime() + 1) },
      });
    }
    await prisma.task.create({
      data: { userId: user.id, title: 'fail', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'FAILED', dueAt: new Date() },
    });
    const result = await computePersonality(user.id);
    expect(result?.axisA).toBe('STEADY');
  });

  it('classifies LOOSE when completion rate is low', async () => {
    const user = await makeUser('personality3@example.com');
    await prisma.task.create({
      data: { userId: user.id, title: 'ok', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', dueAt: new Date(), completedAt: new Date() },
    });
    for (let i = 0; i < 3; i++) {
      await prisma.task.create({
        data: { userId: user.id, title: `fail${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'FAILED', dueAt: new Date() },
      });
    }
    const result = await computePersonality(user.id);
    expect(result?.axisA).toBe('LOOSE');
  });

  it('classifies EASYGOING when tasks are completed early in their window', async () => {
    const user = await makeUser('personality4@example.com');
    for (let i = 0; i < 3; i++) {
      const createdAt = new Date(Date.now() - 100_000);
      const dueAt = new Date(Date.now() + 100_000);
      const completedAt = new Date(createdAt.getTime() + 1_000); // very early
      await prisma.task.create({
        data: { userId: user.id, title: `early${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt },
      });
    }
    const result = await computePersonality(user.id);
    expect(result?.axisB).toBe('EASYGOING');
  });

  it('classifies LASTMINUTE when tasks are completed near their deadline', async () => {
    const user = await makeUser('personality5@example.com');
    for (let i = 0; i < 3; i++) {
      const createdAt = new Date(Date.now() - 100_000);
      const dueAt = new Date(Date.now() + 100_000);
      const completedAt = new Date(dueAt.getTime() - 1_000); // very late
      await prisma.task.create({
        data: { userId: user.id, title: `late${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt },
      });
    }
    const result = await computePersonality(user.id);
    expect(result?.axisB).toBe('LASTMINUTE');
  });
});
