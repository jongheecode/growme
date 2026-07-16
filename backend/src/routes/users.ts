import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const router = Router();

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json({ id: user.id, email: user.email, nickname: user.nickname, bio: user.bio, createdAt: user.createdAt });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const { nickname, bio } = req.body;
  const data: { nickname?: string; bio?: string } = {};
  if (nickname !== undefined) {
    if (!isNonEmptyString(nickname)) {
      return res.status(400).json({ error: 'nickname must be a non-empty string' });
    }
    data.nickname = nickname;
  }
  if (bio !== undefined) {
    if (typeof bio !== 'string' || bio.length > 60) {
      return res.status(400).json({ error: 'bio must be a string of at most 60 characters' });
    }
    data.bio = bio;
  }
  try {
    const user = await prisma.user.update({ where: { id: req.userId! }, data });
    res.json({ id: user.id, email: user.email, nickname: user.nickname, bio: user.bio, createdAt: user.createdAt });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await prisma.user.delete({ where: { id: req.userId! } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
