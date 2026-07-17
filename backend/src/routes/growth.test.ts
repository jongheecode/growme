import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { prisma } from '../db';

async function signup(email: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    nickname: '테스터',
  });
  return { token: res.body.token as string, userId: JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64').toString()).userId as string };
}

describe('GET /api/growth/me', () => {
  it('returns egg state for a brand new user', async () => {
    const { token } = await signup('growthme1@example.com');
    const res = await request(app).get('/api/growth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalXp).toBe(0);
    expect(res.body.species).toBeNull();
    expect(res.body.stage).toBe(0);
    expect(res.body.personality).toBeNull();
  });

  it('reflects hatched species and stage after completed tasks', async () => {
    const { token, userId } = await signup('growthme2@example.com');
    await prisma.task.create({
      data: { userId, title: 'x', category: 'ETC', difficulty: 'HARD', xpValue: 35, status: 'COMPLETED', dueAt: new Date(), completedAt: new Date() },
    });
    const res = await request(app).get('/api/growth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalXp).toBe(35);
    expect(res.body.species).not.toBeNull();
    expect(typeof res.body.stage).toBe('number');
  });

  it('includes a personality type once enough history exists', async () => {
    const { token, userId } = await signup('growthme3@example.com');
    for (let i = 0; i < 3; i++) {
      const createdAt = new Date(Date.now() - 10_000);
      const dueAt = new Date(Date.now() + 10_000);
      await prisma.task.create({
        data: { userId, title: `t${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt: new Date(createdAt.getTime() + 1) },
      });
    }
    const res = await request(app).get('/api/growth/me').set('Authorization', `Bearer ${token}`);
    expect(res.body.personality).not.toBeNull();
    expect(res.body.personality.type).toBe('STEADY_EASYGOING');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/growth/me');
    expect(res.status).toBe(401);
  });
});
