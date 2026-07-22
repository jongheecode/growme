import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const router = Router();

router.post('/block', requireAuth, async (req: AuthedRequest, res) => {
  const { userId } = req.body;
  if (!isNonEmptyString(userId)) return res.status(400).json({ error: 'userId is required' });
  if (userId === req.userId) return res.status(400).json({ error: 'cannot block yourself' });
  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'user not found' });

    await prisma.$transaction([
      prisma.blockedUser.upsert({
        where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: userId } },
        create: { blockerId: req.userId!, blockedId: userId },
        update: {},
      }),
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: req.userId!, addresseeId: userId },
            { requesterId: userId, addresseeId: req.userId! },
          ],
        },
      }),
    ]);
    res.status(201).json({ blockedId: userId });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/block/:userId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await prisma.blockedUser.deleteMany({
      where: { blockerId: req.userId!, blockedId: req.params.userId },
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/blocked', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: req.userId! },
      include: { blocked: { select: { id: true, nickname: true } } },
    });
    res.json(blocks.map((b) => ({ id: b.blocked.id, nickname: b.blocked.nickname })));
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/report', requireAuth, async (req: AuthedRequest, res) => {
  const { userId, reason } = req.body;
  if (!isNonEmptyString(userId) || !isNonEmptyString(reason)) {
    return res.status(400).json({ error: 'userId and reason are required' });
  }
  if (userId === req.userId) return res.status(400).json({ error: 'cannot report yourself' });
  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ error: 'user not found' });

    const report = await prisma.report.create({
      data: { reporterId: req.userId!, reportedUserId: userId, reason },
    });
    res.status(201).json({ id: report.id });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
