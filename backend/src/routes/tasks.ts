import { Router } from 'express';
import { Category, Difficulty } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';
import { computePersonality } from '../services/growth';
import { generateReaction, pickFallbackReaction } from '../services/reactions';
import { RECOMMENDED_MINUTES, TIMER_BONUS_MULTIPLIER } from '../constants';

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

    const needsReaction = tasks.filter((t) => t.status === 'FAILED' && t.reactionText === null);
    if (needsReaction.length > 0) {
      const personality = await computePersonality(req.userId!);
      for (const t of needsReaction) {
        let reactionText: string;
        try {
          reactionText = await generateReaction(t, personality, 'FAILED');
        } catch {
          // AI 호출 실패(크레딧 소진/장애 등) 시 프리셋 문구로 대체 —
          // reactionText가 계속 null로 남으면 다음 GET마다 AI를 재호출하게 되므로
          // 여기서 확정지어 재시도를 멈춘다.
          reactionText = pickFallbackReaction('FAILED');
        }
        const updated = await prisma.task.update({ where: { id: t.id }, data: { reactionText } });
        const idx = tasks.findIndex((x) => x.id === t.id);
        tasks[idx] = updated;
      }
    }

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

    // 집중 타이머로 카테고리별 권장 시간 이상을 채웠으면 XP 보너스.
    const sessionAgg = await prisma.session.aggregate({
      where: { taskId: task.id },
      _sum: { verifiedSeconds: true },
    });
    const focusSeconds = sessionAgg._sum.verifiedSeconds ?? 0;
    const recommendedSeconds = RECOMMENDED_MINUTES[task.category] * 60;
    const bonusApplied = focusSeconds >= recommendedSeconds;
    const xpValue = bonusApplied ? Math.round(task.xpValue * TIMER_BONUS_MULTIPLIER) : task.xpValue;

    let updated = await prisma.task.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', completedAt: new Date(), xpValue },
    });
    await prisma.growthProfile.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, points: xpValue },
      update: { points: { increment: xpValue } },
    });
    let reactionText: string;
    try {
      const personality = await computePersonality(req.userId!);
      reactionText = await generateReaction(updated, personality, 'COMPLETED');
    } catch {
      // AI 호출 실패 시에도 완료 처리 자체와 리액션 표시는 끊기지 않도록 프리셋으로 대체.
      reactionText = pickFallbackReaction('COMPLETED');
    }
    updated = await prisma.task.update({
      where: { id: task.id },
      data: { reactionText, reactionShownAt: new Date() },
    });
    res.json({ ...updated, bonusApplied });
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

router.patch('/:id/ack-reaction', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!task) {
      return res.status(404).json({ error: 'task not found' });
    }
    if (!task.reactionText || task.reactionShownAt) {
      return res.status(409).json({ error: 'no pending reaction' });
    }
    await prisma.task.update({ where: { id: task.id }, data: { reactionShownAt: new Date() } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
