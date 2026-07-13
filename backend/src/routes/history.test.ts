import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { prisma } from '../db';

describe('GET /api/history', () => {
  it('aggregates verified seconds by day and category', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: 'history@example.com',
      password: 'password123',
      nickname: '히스토리테스터',
    });
    const token = signupRes.body.token;
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    const activity = await prisma.activity.create({
      data: { userId: decoded.userId, name: '공부', category: 'STUDY' },
    });
    const today = new Date();
    await prisma.session.create({
      data: {
        userId: decoded.userId,
        activityId: activity.id,
        verifiedSeconds: 600,
        startedAt: today,
        endedAt: today,
      },
    });

    const res = await request(app)
      .get('/api/history?range=daily')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].category).toBe('STUDY');
    expect(res.body[0].verifiedSeconds).toBe(600);
  });
});
