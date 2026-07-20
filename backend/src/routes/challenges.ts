import { Router } from 'express';
import crypto from 'crypto';
import { Category } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const router = Router();

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (Object.values(Category) as string[]).includes(value);
}

async function computeAchievedXp(
  userId: string,
  challenge: { startDate: Date; endDate: Date; category: Category | null }
) {
  const result = await prisma.task.aggregate({
    where: {
      userId,
      status: 'COMPLETED',
      completedAt: { gte: challenge.startDate, lte: challenge.endDate },
      ...(challenge.category ? { category: challenge.category } : {}),
    },
    _sum: { xpValue: true },
  });
  return result._sum.xpValue ?? 0;
}

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { name, category, targetXp, startDate, endDate } = req.body;
  if (!isNonEmptyString(name) || typeof targetXp !== 'number' || !startDate || !endDate) {
    return res.status(400).json({ error: 'invalid challenge payload' });
  }
  if (category !== undefined && category !== null && !isCategory(category)) {
    return res.status(400).json({ error: 'invalid category' });
  }
  try {
    const inviteCode = crypto.randomBytes(4).toString('hex');
    const challenge = await prisma.challenge.create({
      data: {
        name,
        category: category ?? null,
        targetXp,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        inviteCode,
        createdById: req.userId!,
        members: { create: { userId: req.userId! } },
      },
    });
    res.status(201).json(challenge);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const memberships = await prisma.challengeMember.findMany({
      where: { userId: req.userId! },
      include: { challenge: true },
    });
    const result = await Promise.all(
      memberships.map(async (m) => {
        const achievedXp = await computeAchievedXp(req.userId!, m.challenge);
        return {
          ...m.challenge,
          achievedXp,
          percent: m.challenge.targetXp > 0 ? (achievedXp / m.challenge.targetXp) * 100 : 0,
        };
      })
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const membership = await prisma.challengeMember.findFirst({
      where: { challengeId: req.params.id, userId: req.userId! },
    });
    if (!membership) return res.status(404).json({ error: 'challenge not found' });

    const challenge = await prisma.challenge.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { members: { include: { user: true } } },
    });

    const members = await Promise.all(
      challenge.members.map(async (m) => {
        const achievedXp = await computeAchievedXp(m.userId, challenge);
        return {
          userId: m.userId,
          nickname: m.user.nickname,
          achievedXp,
          percent: challenge.targetXp > 0 ? (achievedXp / challenge.targetXp) * 100 : 0,
        };
      })
    );
    members.sort((a, b) => b.achievedXp - a.achievedXp);

    res.json({
      id: challenge.id,
      name: challenge.name,
      category: challenge.category,
      targetXp: challenge.targetXp,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      inviteCode: challenge.inviteCode,
      createdById: challenge.createdById,
      members,
    });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/join', requireAuth, async (req: AuthedRequest, res) => {
  const { inviteCode } = req.body;
  if (!isNonEmptyString(inviteCode)) return res.status(400).json({ error: 'inviteCode is required' });
  try {
    const challenge = await prisma.challenge.findUnique({ where: { inviteCode } });
    if (!challenge) return res.status(404).json({ error: 'challenge not found' });
    const existing = await prisma.challengeMember.findFirst({
      where: { challengeId: challenge.id, userId: req.userId! },
    });
    if (existing) return res.status(409).json({ error: 'already a member' });
    await prisma.challengeMember.create({ data: { challengeId: challenge.id, userId: req.userId! } });
    res.status(201).json({ id: challenge.id });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id/leave', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const challenge = await prisma.challenge.findUnique({ where: { id: req.params.id } });
    if (!challenge) return res.status(404).json({ error: 'challenge not found' });
    if (challenge.createdById === req.userId) {
      return res.status(400).json({ error: 'creator cannot leave the challenge' });
    }
    const membership = await prisma.challengeMember.findFirst({
      where: { challengeId: req.params.id, userId: req.userId! },
    });
    if (!membership) return res.status(404).json({ error: 'not a member' });
    await prisma.challengeMember.delete({ where: { id: membership.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
