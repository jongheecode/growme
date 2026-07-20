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

async function completeTaskWithXp(userId: string, xpValue: number, completedAt: Date) {
  await prisma.task.create({
    data: {
      userId,
      title: '태스크',
      category: 'STUDY',
      difficulty: 'EASY',
      xpValue,
      dueAt: new Date(),
      status: 'COMPLETED',
      completedAt,
    },
  });
}

describe('GET /api/leaderboard', () => {
  it('ranks global scope by all-time totalXp descending', async () => {
    const a = await signup(`글로벌A${Date.now()}`);
    const b = await signup(`글로벌B${Date.now()}`);
    await completeTaskWithXp(a.userId, 10, new Date());
    await completeTaskWithXp(b.userId, 30, new Date());

    const res = await request(app)
      .get('/api/leaderboard?scope=global&range=alltime')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((e: { userId: string }) => e.userId);
    expect(ids.indexOf(b.userId)).toBeLessThan(ids.indexOf(a.userId));
    expect(res.body.find((e: { userId: string }) => e.userId === b.userId).rank).toBe(
      ids.indexOf(b.userId) + 1
    );
  });

  it('restricts friends scope to self + accepted friends', async () => {
    const a = await signup(`친구랭킹A${Date.now()}`);
    const b = await signup(`친구랭킹B${Date.now()}`);
    const stranger = await signup(`친구랭킹C${Date.now()}`);
    await completeTaskWithXp(a.userId, 10, new Date());
    await completeTaskWithXp(b.userId, 20, new Date());
    await completeTaskWithXp(stranger.userId, 999, new Date());

    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ nickname: (await prisma.user.findUniqueOrThrow({ where: { id: b.userId } })).nickname });
    await request(app)
      .post(`/api/friends/${reqRes.body.id}/accept`)
      .set('Authorization', `Bearer ${b.token}`);

    const res = await request(app)
      .get('/api/leaderboard?scope=friends&range=alltime')
      .set('Authorization', `Bearer ${a.token}`);
    const ids = res.body.map((e: { userId: string }) => e.userId);
    expect(ids).toContain(a.userId);
    expect(ids).toContain(b.userId);
    expect(ids).not.toContain(stranger.userId);
  });

  it('excludes tasks completed more than 7 days ago from the weekly range', async () => {
    const a = await signup(`주간A${Date.now()}`);
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    await completeTaskWithXp(a.userId, 50, eightDaysAgo);

    const res = await request(app)
      .get('/api/leaderboard?scope=global&range=weekly')
      .set('Authorization', `Bearer ${a.token}`);
    const entry = res.body.find((e: { userId: string }) => e.userId === a.userId);
    expect(entry).toBeUndefined();
  });

  it('includes tasks completed within the last 7 days in the weekly range', async () => {
    const a = await signup(`주간B${Date.now()}`);
    await completeTaskWithXp(a.userId, 15, new Date());

    const res = await request(app)
      .get('/api/leaderboard?scope=global&range=weekly')
      .set('Authorization', `Bearer ${a.token}`);
    const entry = res.body.find((e: { userId: string }) => e.userId === a.userId);
    expect(entry.totalXp).toBe(15);
  });

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/leaderboard?scope=global&range=alltime');
    expect(res.status).toBe(401);
  });
});
