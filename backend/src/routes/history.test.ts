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

async function setupUserAndTask() {
  const signupRes = await request(app).post('/api/auth/signup').send({
    email: `ht${Date.now()}${Math.random()}@example.com`,
    password: 'password123',
    nickname: '히스토리테스터',
  });
  const token = signupRes.body.token;
  const taskRes = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '집중', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });
  return { token, taskId: taskRes.body.id };
}

describe('GET /api/history/tasks', () => {
  it('returns an empty list when there are no completed or failed tasks', async () => {
    const { token } = await setupUserAndTask();
    const res = await request(app)
      .get('/api/history/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('includes a completed task with occurredAt set to completedAt and focusSeconds 0', async () => {
    const { token, taskId } = await setupUserAndTask();
    const completedAt = new Date('2026-07-10T12:00:00.000Z');
    await prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED', completedAt } });

    const res = await request(app)
      .get('/api/history/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('COMPLETED');
    expect(res.body[0].occurredAt).toBe(completedAt.toISOString());
    expect(res.body[0].focusSeconds).toBe(0);
  });

  it('includes a failed task with occurredAt set to dueAt', async () => {
    const { token, taskId } = await setupUserAndTask();
    await prisma.task.update({ where: { id: taskId }, data: { status: 'FAILED' } });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

    const res = await request(app)
      .get('/api/history/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('FAILED');
    expect(res.body[0].occurredAt).toBe(task.dueAt.toISOString());
  });

  it('sums verifiedSeconds across multiple sessions into focusSeconds', async () => {
    const { token, taskId } = await setupUserAndTask();
    await prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    await prisma.session.create({ data: { userId: decoded.userId, taskId, verifiedSeconds: 100 } });
    await prisma.session.create({ data: { userId: decoded.userId, taskId, verifiedSeconds: 250 } });

    const res = await request(app)
      .get('/api/history/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body[0].focusSeconds).toBe(350);
  });

  it('excludes pending tasks', async () => {
    const { token } = await setupUserAndTask();
    const res = await request(app)
      .get('/api/history/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body).toEqual([]);
  });

  it('orders entries by occurredAt descending', async () => {
    const { token, taskId: taskId1 } = await setupUserAndTask();
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    await prisma.task.update({
      where: { id: taskId1 },
      data: { status: 'COMPLETED', completedAt: new Date('2026-07-01T00:00:00.000Z') },
    });
    const task2 = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '독서',
        category: 'READING',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(),
        status: 'COMPLETED',
        completedAt: new Date('2026-07-15T00:00:00.000Z'),
      },
    });

    const res = await request(app)
      .get('/api/history/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual([task2.id, taskId1]);
  });

  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/history/tasks');
    expect(res.status).toBe(401);
  });
});
