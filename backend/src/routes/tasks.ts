import { Router } from 'express';
import { Category, Difficulty } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const router = Router();

export const DIFFICULTY_XP: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 35,
};

export function computeDueAt(dueChoice: 'TODAY' | 'THIS_WEEK', now: Date): Date {
  const due = new Date(now);
  if (dueChoice === 'THIS_WEEK') {
    const day = due.getDay(); // 0 = Sunday
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    due.setDate(due.getDate() + daysUntilSunday);
  }
  due.setHours(23, 59, 59, 999);
  return due;
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (Object.values(Category) as string[]).includes(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (Object.values(Difficulty) as string[]).includes(value);
}

function isDueChoice(value: unknown): value is 'TODAY' | 'THIS_WEEK' {
  return value === 'TODAY' || value === 'THIS_WEEK';
}

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { title, category, difficulty, dueChoice, goalId } = req.body;
  if (!isNonEmptyString(title) || !isNonEmptyString(category) || !isNonEmptyString(difficulty) || !isNonEmptyString(dueChoice)) {
    return res.status(400).json({ error: 'title, category, difficulty and dueChoice are required' });
  }
  if (!isCategory(category)) {
    return res.status(400).json({ error: 'category must be one of ' + Object.values(Category).join(', ') });
  }
  if (!isDifficulty(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be one of ' + Object.values(Difficulty).join(', ') });
  }
  if (!isDueChoice(dueChoice)) {
    return res.status(400).json({ error: 'dueChoice must be TODAY or THIS_WEEK' });
  }
  if (goalId !== undefined && !isNonEmptyString(goalId)) {
    return res.status(400).json({ error: 'goalId must be a string' });
  }
  try {
    if (goalId) {
      const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: req.userId! } });
      if (!goal) {
        return res.status(400).json({ error: 'invalid goalId' });
      }
    }
    const task = await prisma.task.create({
      data: {
        userId: req.userId!,
        goalId: goalId ?? null,
        title,
        category,
        difficulty,
        xpValue: DIFFICULTY_XP[difficulty],
        dueAt: computeDueAt(dueChoice, new Date()),
      },
    });
    res.status(201).json(task);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const now = new Date();
    await prisma.task.updateMany({
      where: { userId: req.userId!, status: 'PENDING', dueAt: { lt: now } },
      data: { status: 'FAILED' },
    });
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.patch('/:id/complete', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!task) {
      return res.status(404).json({ error: 'task not found' });
    }
    if (task.status !== 'PENDING') {
      return res.status(409).json({ error: 'task is not pending' });
    }
    if (task.dueAt.getTime() < Date.now()) {
      await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED' } });
      return res.status(409).json({ error: 'task expired' });
    }
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!task) {
      return res.status(404).json({ error: 'task not found' });
    }
    if (task.status !== 'PENDING') {
      return res.status(400).json({ error: 'only pending tasks can be deleted' });
    }
    await prisma.task.delete({ where: { id: task.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
