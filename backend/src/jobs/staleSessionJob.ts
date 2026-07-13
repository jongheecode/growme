import { prisma } from '../db';
import { applySessionToGrowth } from '../services/growth';
import { MAX_GAP_SECONDS } from '../constants';

export async function closeStaleSessions() {
  const threshold = new Date(Date.now() - MAX_GAP_SECONDS * 1000);
  const staleSessions = await prisma.session.findMany({
    where: { endedAt: null, lastHeartbeatAt: { lt: threshold } },
  });
  for (const session of staleSessions) {
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { endedAt: session.lastHeartbeatAt },
    });
    await applySessionToGrowth(session.userId, updated.verifiedSeconds);
  }
}
