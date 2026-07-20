import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const CATALOG = [
  { key: 'ribbon', name: '리본', slot: 'HAT' as const, price: 50 },
  { key: 'crown', name: '왕관', slot: 'HAT' as const, price: 200 },
  { key: 'round_glasses', name: '동그란 안경', slot: 'FACE' as const, price: 80 },
  { key: 'star_bg', name: '별 배경', slot: 'BACKGROUND' as const, price: 120 },
  { key: 'rainbow_bg', name: '무지개 배경', slot: 'BACKGROUND' as const, price: 300 },
];

async function ensureCatalog() {
  await Promise.all(
    CATALOG.map((item) =>
      prisma.accessoryItem.upsert({
        where: { key: item.key },
        create: item,
        update: {},
      })
    )
  );
}

router.get('/items', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await ensureCatalog();
    const items = await prisma.accessoryItem.findMany({
      include: { userAccessories: { where: { userId: req.userId! } } },
    });
    res.json(
      items.map((item) => ({
        id: item.id,
        key: item.key,
        name: item.name,
        slot: item.slot,
        price: item.price,
        owned: item.userAccessories.length > 0,
      }))
    );
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/purchase', requireAuth, async (req: AuthedRequest, res) => {
  const { itemId } = req.body;
  try {
    const item = await prisma.accessoryItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'item not found' });

    const existing = await prisma.userAccessory.findUnique({
      where: { userId_itemId: { userId: req.userId!, itemId } },
    });
    if (existing) return res.status(409).json({ error: 'already owned' });

    const profile = await prisma.growthProfile.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId! },
      update: {},
    });
    if (profile.points < item.price) {
      return res.status(400).json({ error: 'not enough points' });
    }

    await prisma.$transaction([
      prisma.userAccessory.create({ data: { userId: req.userId!, itemId } }),
      prisma.growthProfile.update({
        where: { userId: req.userId! },
        data: { points: { decrement: item.price } },
      }),
    ]);
    res.status(201).json({ itemId });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.patch('/equip', requireAuth, async (req: AuthedRequest, res) => {
  const { itemId, equipped } = req.body;
  try {
    const owned = await prisma.userAccessory.findUnique({
      where: { userId_itemId: { userId: req.userId!, itemId } },
      include: { item: true },
    });
    if (!owned) return res.status(404).json({ error: 'item not owned' });

    if (equipped) {
      const sameSlotOwned = await prisma.userAccessory.findMany({
        where: { userId: req.userId!, equipped: true, item: { slot: owned.item.slot } },
      });
      await Promise.all(
        sameSlotOwned.map((ua) =>
          prisma.userAccessory.update({ where: { id: ua.id }, data: { equipped: false } })
        )
      );
    }
    const updated = await prisma.userAccessory.update({
      where: { id: owned.id },
      data: { equipped: !!equipped },
    });
    res.json({ itemId: updated.itemId, equipped: updated.equipped });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/my-accessories', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const equipped = await prisma.userAccessory.findMany({
      where: { userId: req.userId!, equipped: true },
      include: { item: true },
    });
    res.json(equipped.map((ua) => ({ itemId: ua.itemId, slot: ua.item.slot, key: ua.item.key })));
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
