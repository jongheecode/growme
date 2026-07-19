import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { runGoalChat, ChatMessage } from '../services/goalChat';
import { suggestTasks } from '../services/taskSuggestions';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(goals);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

router.post('/chat', requireAuth, async (req: AuthedRequest, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isChatMessage)) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  try {
    const result = await runGoalChat(messages);
    if (result.goalInput) {
      const goal = await prisma.goal.create({
        data: { userId: req.userId!, title: result.goalInput.title, category: result.goalInput.category },
      });
      return res.json({ reply: result.reply, goalSet: true, goal });
    }
    res.json({ reply: result.reply, goalSet: false });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/:id/suggest-tasks', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const goal = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!goal) {
      return res.status(404).json({ error: 'goal not found' });
    }
    const suggestions = await suggestTasks({ title: goal.title, category: goal.category });
    res.json({ suggestions });
  } catch {
    res.status(502).json({ error: 'failed to generate suggestions' });
  }
});

export default router;
