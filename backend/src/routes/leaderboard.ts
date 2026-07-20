import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const scope = req.query.scope === 'friends' ? 'friends' : 'global';
    const range = req.query.range === 'weekly' ? 'weekly' : 'alltime';

    let userIds: string[] | undefined;
    if (scope === 'friends') {
      const friendships = await prisma.friendship.findMany({
        where: { status: 'ACCEPTED', OR: [{ requesterId: req.userId! }, { addresseeId: req.userId! }] },
      });
      userIds = [
        req.userId!,
        ...friendships.map((f) => (f.requesterId === req.userId ? f.addresseeId : f.requesterId)),
      ];
    }

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const grouped = await prisma.task.groupBy({
      by: ['userId'],
      where: {
        status: 'COMPLETED',
        ...(userIds ? { userId: { in: userIds } } : {}),
        ...(range === 'weekly' ? { completedAt: { gte: since } } : {}),
      },
      _sum: { xpValue: true },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, nickname: true },
    });
    const nicknameById = new Map(users.map((u) => [u.id, u.nickname]));

    const entries = grouped
      .map((g) => ({ userId: g.userId, nickname: nicknameById.get(g.userId)!, totalXp: g._sum.xpValue ?? 0 }))
      .sort((a, b) => b.totalXp - a.totalXp || (a.userId < b.userId ? -1 : 1))
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    res.json(entries);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
