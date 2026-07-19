import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { MAX_GAP_SECONDS } from '../constants';
import { isNonEmptyString } from './auth';

const router = Router();

router.post('/start', requireAuth, async (req: AuthedRequest, res) => {
  const { activityId, taskId } = req.body;
  const hasActivityId = isNonEmptyString(activityId);
  const hasTaskId = isNonEmptyString(taskId);
  if (hasActivityId === hasTaskId) {
    return res.status(400).json({ error: 'exactly one of activityId or taskId is required' });
  }
  try {
    if (hasTaskId) {
      const task = await prisma.task.findFirst({ where: { id: taskId, userId: req.userId! } });
      if (!task) {
        return res.status(404).json({ error: 'task not found' });
      }
      if (task.status !== 'PENDING') {
        return res.status(409).json({ error: 'task is not pending' });
      }
      const session = await prisma.session.create({
        data: { taskId, userId: req.userId!, lastHeartbeatAt: new Date() },
      });
      return res.status(201).json({ id: session.id, startedAt: session.startedAt });
    }
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId: req.userId!, deletedAt: null },
    });
    if (!activity) {
      return res.status(404).json({ error: 'activity not found' });
    }
    const session = await prisma.session.create({
      data: { activityId, userId: req.userId!, lastHeartbeatAt: new Date() },
    });
    res.status(201).json({ id: session.id, startedAt: session.startedAt });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/:id/heartbeat', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId!, endedAt: null },
    });
    if (!session) {
      return res.status(404).json({ error: 'session not found' });
    }
    const now = new Date();
    const gapSeconds = Math.min(
      (now.getTime() - session.lastHeartbeatAt.getTime()) / 1000,
      MAX_GAP_SECONDS
    );
    const verifiedSeconds = session.verifiedSeconds + Math.round(gapSeconds);
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { verifiedSeconds, lastHeartbeatAt: now },
    });
    res.json({ verifiedSeconds: updated.verifiedSeconds });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/:id/end', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId!, endedAt: null },
    });
    if (!session) {
      return res.status(404).json({ error: 'session not found or already ended' });
    }
    const now = new Date();
    const gapSeconds = Math.min(
      (now.getTime() - session.lastHeartbeatAt.getTime()) / 1000,
      MAX_GAP_SECONDS
    );
    const verifiedSeconds = session.verifiedSeconds + Math.round(gapSeconds);
    const result = await prisma.session.updateMany({
      where: { id: req.params.id, userId: req.userId!, endedAt: null },
      data: { endedAt: now, verifiedSeconds, lastHeartbeatAt: now },
    });
    if (result.count === 0) {
      return res.status(404).json({ error: 'session not found or already ended' });
    }
    res.json({ verifiedSeconds });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
