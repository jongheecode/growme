import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getTotalXp, ensureHatched, getGrowthStageInfo, computePersonality } from '../services/growth';

const router = Router();

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const totalXp = await getTotalXp(req.userId!);
    const species = await ensureHatched(req.userId!, totalXp);
    const personality = await computePersonality(req.userId!);
    const profile = await prisma.growthProfile.findUnique({ where: { userId: req.userId! } });
    const points = profile?.points ?? 0;

    if (!species) {
      return res.json({
        totalXp,
        species: null,
        stage: 0,
        xpIntoStage: 0,
        xpToNextStage: null,
        personality,
        points,
      });
    }

    const { stage, xpIntoStage, xpToNextStage } = getGrowthStageInfo(species, totalXp);
    res.json({ totalXp, species, stage, xpIntoStage, xpToNextStage, personality, points });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
