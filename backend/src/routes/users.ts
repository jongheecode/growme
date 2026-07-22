import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const { nickname, bio, email } = req.body;
  const data: { nickname?: string; bio?: string; email?: string } = {};
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
  if (email !== undefined) {
    if (!isNonEmptyString(email) || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'email must be a valid email address' });
    }
    data.email = email;
  }
  try {
    const user = await prisma.user.update({ where: { id: req.userId! }, data });
    res.json({ id: user.id, email: user.email, nickname: user.nickname, bio: user.bio, createdAt: user.createdAt });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'email already in use' });
    }
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
