import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const range = req.query.range === 'weekly' ? 'weekly' : 'daily';
    const since = new Date();
    since.setDate(since.getDate() - (range === 'weekly' ? 7 * 4 : 7));

    const sessions = await prisma.session.findMany({
      where: { userId: req.userId!, endedAt: { gte: since } },
      include: { activity: { select: { category: true } } },
    });

    const buckets: Record<string, number> = {};
    for (const s of sessions) {
      if (!s.endedAt) continue;
      const dateKey = s.endedAt.toISOString().slice(0, 10);
      const key = `${dateKey}::${s.activity.category}`;
      buckets[key] = (buckets[key] ?? 0) + s.verifiedSeconds;
    }

    const result = Object.entries(buckets).map(([key, verifiedSeconds]) => {
      const [date, category] = key.split('::');
      return { date, category, verifiedSeconds };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
