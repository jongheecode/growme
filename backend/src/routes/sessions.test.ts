import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../app';
import { prisma } from '../db';

async function setupUserAndActivity() {
  const signupRes = await request(app).post('/api/auth/signup').send({
    email: `s${Date.now()}@example.com`,
    password: 'password123',
    nickname: '테스터',
  });
  const token = signupRes.body.token;
  const activityRes = await request(app)
    .post('/api/activities')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '집중', category: 'STUDY' });
  return { token, activityId: activityRes.body.id };
}

async function setupUserAndTask() {
  const signupRes = await request(app).post('/api/auth/signup').send({
    email: `st${Date.now()}@example.com`,
    password: 'password123',
    nickname: '테스터',
  });
  const token = signupRes.body.token;
  const taskRes = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '집중', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });
  return { token, taskId: taskRes.body.id };
}

describe('Session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a session', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('accumulates verified seconds on heartbeat', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    const sessionId = startRes.body.id;

    vi.advanceTimersByTime(30_000);
    const hbRes = await request(app)
      .post(`/api/sessions/${sessionId}/heartbeat`)
      .set('Authorization', `Bearer ${token}`);
    expect(hbRes.status).toBe(200);
    expect(hbRes.body.verifiedSeconds).toBeGreaterThanOrEqual(29);
  });

  it('ends a session and records verified seconds', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    const sessionId = startRes.body.id;

    vi.advanceTimersByTime(60_000);
    const endRes = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(endRes.status).toBe(200);
    expect(endRes.body.verifiedSeconds).toBeGreaterThanOrEqual(59);
  });

  it('caps the counted gap at 5 minutes', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    const sessionId = startRes.body.id;

    vi.advanceTimersByTime(20 * 60_000); // 20분 방치
    const endRes = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(endRes.body.verifiedSeconds).toBeLessThanOrEqual(300);
  });

  it('prevents double ending when two /end requests race on the same session', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    const sessionId = startRes.body.id;

    vi.advanceTimersByTime(60_000);

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${token}`),
      request(app)
        .post(`/api/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 404]);
  });
});

describe('Session lifecycle for tasks', () => {
  it('starts a session for a task', async () => {
    const { token, taskId } = await setupUserAndTask();
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it("returns 404 for another user's task", async () => {
    const { taskId } = await setupUserAndTask();
    const signupRes2 = await request(app).post('/api/auth/signup').send({
      email: `st2${Date.now()}@example.com`,
      password: 'password123',
      nickname: '테스터2',
    });
    const token2 = signupRes2.body.token;
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token2}`)
      .send({ taskId });
    expect(res.status).toBe(404);
  });

  it('returns 409 for a non-pending task', async () => {
    const { token, taskId } = await setupUserAndTask();
    await prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED' } });
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId });
    expect(res.status).toBe(409);
  });

  it('returns 400 when neither activityId nor taskId is given', async () => {
    const { token } = await setupUserAndTask();
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when both activityId and taskId are given', async () => {
    const { token, taskId } = await setupUserAndTask();
    const activityRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '집중', category: 'STUDY' });
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId: activityRes.body.id, taskId });
    expect(res.status).toBe(400);
  });
});
