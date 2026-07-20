import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';
import { getTotalXp, ensureHatched, getGrowthStageInfo } from '../services/growth';

const router = Router();

router.post('/request', requireAuth, async (req: AuthedRequest, res) => {
  const { nickname } = req.body;
  if (!isNonEmptyString(nickname)) return res.status(400).json({ error: 'nickname is required' });
  try {
    const target = await prisma.user.findFirst({ where: { nickname } });
    if (!target) return res.status(404).json({ error: 'user not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'cannot friend yourself' });

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: req.userId!, addresseeId: target.id },
          { requesterId: target.id, addresseeId: req.userId! },
        ],
      },
    });
    if (existing) return res.status(409).json({ error: 'friendship already exists' });

    const friendship = await prisma.friendship.create({
      data: { requesterId: req.userId!, addresseeId: target.id },
    });
    res.status(201).json({ id: friendship.id });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/requests', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.friendship.findMany({
      where: { addresseeId: req.userId!, status: 'PENDING' },
      include: { requester: { select: { nickname: true } } },
    });
    res.json(
      requests.map((r) => ({ id: r.id, requesterId: r.requesterId, requesterNickname: r.requester.nickname }))
    );
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/:id/accept', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const friendship = await prisma.friendship.findFirst({
      where: { id: req.params.id, addresseeId: req.userId!, status: 'PENDING' },
    });
    if (!friendship) return res.status(404).json({ error: 'request not found' });
    await prisma.friendship.update({ where: { id: friendship.id }, data: { status: 'ACCEPTED' } });
    res.json({ id: friendship.id, status: 'ACCEPTED' });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const friendship = await prisma.friendship.findFirst({
      where: { id: req.params.id, OR: [{ requesterId: req.userId! }, { addresseeId: req.userId! }] },
    });
    if (!friendship) return res.status(404).json({ error: 'friendship not found' });
    await prisma.friendship.delete({ where: { id: friendship.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: req.userId! }, { addresseeId: req.userId! }] },
      include: { requester: true, addressee: true },
    });
    const friends = await Promise.all(
      friendships.map(async (f) => {
        const other = f.requesterId === req.userId ? f.addressee : f.requester;
        const totalXp = await getTotalXp(other.id);
        const species = await ensureHatched(other.id, totalXp);
        const stage = species ? getGrowthStageInfo(species, totalXp).stage : 0;
        return { id: other.id, nickname: other.nickname, species, stage, totalXp };
      })
    );
    res.json(friends);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
