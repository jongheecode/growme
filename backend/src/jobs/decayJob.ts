import { prisma } from '../db';
import { computeDecayedGauge } from '../services/decay';

export async function runDecayJob() {
  const growths = await prisma.growth.findMany();
  const now = new Date();
  for (const g of growths) {
    const decayed = computeDecayedGauge(g.currentGauge, g.lastActiveDate, now);
    if (decayed !== g.currentGauge) {
      await prisma.growth.update({ where: { id: g.id }, data: { currentGauge: decayed } });
    }
  }
}
