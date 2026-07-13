import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import { getStageForGauge, recomputeDominantCategory, applySessionToGrowth } from './growth';

describe('getStageForGauge', () => {
  it('returns stage 0 for a fresh gauge', () => {
    expect(getStageForGauge(0)).toBe(0);
  });
  it('returns stage 1 at 1 hour', () => {
    expect(getStageForGauge(3600)).toBe(1);
  });
  it('returns stage 4 at 30+ hours', () => {
    expect(getStageForGauge(30 * 3600)).toBe(4);
  });
  it('returns the highest stage below the gauge', () => {
    expect(getStageForGauge(3 * 3600 - 1)).toBe(1);
  });
});

describe('recomputeDominantCategory', () => {
  it('picks the category with the most verified seconds', async () => {
    const user = await prisma.user.create({
      data: { email: 'dom@example.com', passwordHash: 'x', nickname: '테스터' },
    });
    const studyActivity = await prisma.activity.create({
      data: { userId: user.id, name: '공부', category: 'STUDY' },
    });
    const exerciseActivity = await prisma.activity.create({
      data: { userId: user.id, name: '운동', category: 'EXERCISE' },
    });
    await prisma.session.create({
      data: { userId: user.id, activityId: studyActivity.id, verifiedSeconds: 100, endedAt: new Date() },
    });
    await prisma.session.create({
      data: { userId: user.id, activityId: exerciseActivity.id, verifiedSeconds: 500, endedAt: new Date() },
    });

    const dominant = await recomputeDominantCategory(user.id);
    expect(dominant).toBe('EXERCISE');
  });

  it('returns null when there are no sessions', async () => {
    const user = await prisma.user.create({
      data: { email: 'nodom@example.com', passwordHash: 'x', nickname: '테스터2' },
    });
    const dominant = await recomputeDominantCategory(user.id);
    expect(dominant).toBeNull();
  });
});

describe('applySessionToGrowth', () => {
  it('creates a Growth row on first call', async () => {
    const user = await prisma.user.create({
      data: { email: 'growth1@example.com', passwordHash: 'x', nickname: '테스터3' },
    });
    await applySessionToGrowth(user.id, 42);
    const growth = await prisma.growth.findUnique({ where: { userId: user.id } });
    expect(growth?.currentGauge).toBe(42);
  });
});
