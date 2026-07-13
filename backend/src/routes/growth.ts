import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getStageForGauge, recomputeDominantCategory } from '../services/growth';

const router = Router();

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const growth = await prisma.growth.findUnique({ where: { userId: req.userId! } });
  const currentGauge = growth?.currentGauge ?? 0;
  const dominantCategory = await recomputeDominantCategory(req.userId!);
  res.json({
    currentGauge,
    stage: getStageForGauge(currentGauge),
    dominantCategory: dominantCategory ?? 'ETC',
  });
});

export default router;
