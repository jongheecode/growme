import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import { closeStaleSessions } from './staleSessionJob';

describe('closeStaleSessions', () => {
  it('closes sessions with no heartbeat for over 5 minutes', async () => {
    const user = await prisma.user.create({
      data: { email: 'stale@example.com', passwordHash: 'x', nickname: '방치테스터' },
    });
    const activity = await prisma.activity.create({
      data: { userId: user.id, name: '방치활동', category: 'ETC' },
    });
    const staleTime = new Date(Date.now() - 10 * 60_000);
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        activityId: activity.id,
        verifiedSeconds: 120,
        lastHeartbeatAt: staleTime,
        startedAt: staleTime,
      },
    });

    await closeStaleSessions();

    const updated = await prisma.session.findUnique({ where: { id: session.id } });
    expect(updated?.endedAt).not.toBeNull();

    const growth = await prisma.growth.findUnique({ where: { userId: user.id } });
    expect(growth?.currentGauge).toBe(120);
  });
});
