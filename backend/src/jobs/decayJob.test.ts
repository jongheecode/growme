import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import { runDecayJob } from './decayJob';

describe('runDecayJob', () => {
  it('decays gauges for inactive users', async () => {
    const user = await prisma.user.create({
      data: { email: 'decayjob@example.com', passwordHash: 'x', nickname: '테스터' },
    });
    await prisma.growth.create({
      data: {
        userId: user.id,
        currentGauge: 1000,
        lastActiveDate: new Date(Date.now() - 5 * 86_400_000),
      },
    });

    await runDecayJob();

    const growth = await prisma.growth.findUnique({ where: { userId: user.id } });
    expect(growth!.currentGauge).toBeLessThan(1000);
  });
});
