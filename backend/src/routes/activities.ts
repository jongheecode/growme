import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const router = Router();

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { name, category } = req.body;
  if (!isNonEmptyString(name) || !isNonEmptyString(category)) {
    return res.status(400).json({ error: 'name and category are required' });
  }
  try {
    const activity = await prisma.activity.create({
      data: { userId: req.userId!, name, category },
    });
    res.status(201).json(activity);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { userId: req.userId!, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json(activities);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const activity = await prisma.activity.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!activity) {
      return res.status(404).json({ error: 'activity not found' });
    }
    await prisma.activity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
