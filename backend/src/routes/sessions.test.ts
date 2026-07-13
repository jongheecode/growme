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

  it('ends a session and updates growth gauge', async () => {
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

    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    const growth = await prisma.growth.findUnique({ where: { userId: decoded.userId } });
    expect(growth?.currentGauge).toBeGreaterThanOrEqual(59);
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

  it('applies growth only once when two /end requests race on the same session', async () => {
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

    const successRes = res1.status === 200 ? res1 : res2;

    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    const growth = await prisma.growth.findUnique({ where: { userId: decoded.userId } });
    expect(growth?.currentGauge).toBe(successRes.body.verifiedSeconds);
  });
});
