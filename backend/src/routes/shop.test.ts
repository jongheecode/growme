import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { prisma } from '../db';

async function signup(nickname: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email: `${nickname}${Date.now()}${Math.random()}@example.com`,
    password: 'password123',
    nickname,
  });
  const decoded = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64').toString());
  return { token: res.body.token as string, userId: decoded.userId as string };
}

async function grantPoints(userId: string, points: number) {
  await prisma.growthProfile.upsert({
    where: { userId },
    create: { userId, points },
    update: { points: { increment: points } },
  });
}

describe('GET /api/shop/items', () => {
  it('returns the fixed 5-item catalog with owned flags', async () => {
    const a = await signup(`상점목록${Date.now()}`);
    const res = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body.every((item: { owned: boolean }) => item.owned === false)).toBe(true);
  });

  it('does not create duplicate catalog rows on repeated calls', async () => {
    const a = await signup(`상점중복${Date.now()}`);
    await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const count = await prisma.accessoryItem.count();
    expect(count).toBe(5);
  });

  it('marks a purchased item as owned', async () => {
    const a = await signup(`상점보유${Date.now()}`);
    await grantPoints(a.userId, 100);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const ribbon = itemsRes.body.find((i: { key: string }) => i.key === 'ribbon');

    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id });

    const res = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    expect(res.body.find((i: { key: string }) => i.key === 'ribbon').owned).toBe(true);
  });
});

describe('POST /api/shop/purchase', () => {
  it('purchases an item and deducts points', async () => {
    const a = await signup(`구매성공${Date.now()}`);
    await grantPoints(a.userId, 100);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const ribbon = itemsRes.body.find((i: { key: string }) => i.key === 'ribbon');

    const res = await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id });
    expect(res.status).toBe(201);

    const profile = await prisma.growthProfile.findUniqueOrThrow({ where: { userId: a.userId } });
    expect(profile.points).toBe(50);
  });

  it('returns 400 when points are insufficient', async () => {
    const a = await signup(`포인트부족${Date.now()}`);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const crown = itemsRes.body.find((i: { key: string }) => i.key === 'crown');

    const res = await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: crown.id });
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate purchase', async () => {
    const a = await signup(`중복구매${Date.now()}`);
    await grantPoints(a.userId, 1000);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const ribbon = itemsRes.body.find((i: { key: string }) => i.key === 'ribbon');
    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id });

    const res = await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/shop/equip', () => {
  it('equips an owned item', async () => {
    const a = await signup(`장착성공${Date.now()}`);
    await grantPoints(a.userId, 1000);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const ribbon = itemsRes.body.find((i: { key: string }) => i.key === 'ribbon');
    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id });

    const res = await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id, equipped: true });
    expect(res.status).toBe(200);
    expect(res.body.equipped).toBe(true);
  });

  it('returns 404 when equipping an item not owned', async () => {
    const a = await signup(`미보유장착${Date.now()}`);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const ribbon = itemsRes.body.find((i: { key: string }) => i.key === 'ribbon');

    const res = await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id, equipped: true });
    expect(res.status).toBe(404);
  });

  it('auto-unequips the previous item in the same slot', async () => {
    const a = await signup(`슬롯교체${Date.now()}`);
    await grantPoints(a.userId, 1000);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const ribbon = itemsRes.body.find((i: { key: string }) => i.key === 'ribbon');
    const crown = itemsRes.body.find((i: { key: string }) => i.key === 'crown');
    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id });
    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: crown.id });
    await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id, equipped: true });

    await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: crown.id, equipped: true });

    const res = await request(app)
      .get('/api/shop/my-accessories')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].key).toBe('crown');
  });
});

describe('GET /api/shop/my-accessories', () => {
  it('returns only equipped items', async () => {
    const a = await signup(`장착목록${Date.now()}`);
    await grantPoints(a.userId, 1000);
    const itemsRes = await request(app).get('/api/shop/items').set('Authorization', `Bearer ${a.token}`);
    const ribbon = itemsRes.body.find((i: { key: string }) => i.key === 'ribbon');
    const glasses = itemsRes.body.find((i: { key: string }) => i.key === 'round_glasses');
    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id });
    await request(app)
      .post('/api/shop/purchase')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: glasses.id });
    await request(app)
      .patch('/api/shop/equip')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ itemId: ribbon.id, equipped: true });

    const res = await request(app)
      .get('/api/shop/my-accessories')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].key).toBe('ribbon');
    expect(res.body[0].slot).toBe('HAT');
  });
});
