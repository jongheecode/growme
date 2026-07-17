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
  return res.body.token as string;
}

describe('GET /api/goals', () => {
  it("returns the authenticated user's goals, newest first", async () => {
    const token = await signup('goalslist1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    await prisma.goal.create({ data: { userId: decoded.userId, title: '첫 목표', category: 'STUDY' } });
    await prisma.goal.create({ data: { userId: decoded.userId, title: '두번째 목표', category: 'EXERCISE' } });

    const res = await request(app).get('/api/goals').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('두번째 목표');
  });

  it("does not return another user's goals", async () => {
    const tokenA = await signup('goalslist2@example.com');
    const tokenB = await signup('goalslist3@example.com');
    const decodedA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString());
    await prisma.goal.create({ data: { userId: decodedA.userId, title: 'A의 목표', category: 'STUDY' } });

    const res = await request(app).get('/api/goals').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/goals');
    expect(res.status).toBe(401);
  });
});
