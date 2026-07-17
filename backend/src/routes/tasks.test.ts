import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { computeDueAt } from './tasks';

async function signup(email: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    nickname: '테스터',
  });
  return res.body.token as string;
}

describe('computeDueAt', () => {
  it('returns today 23:59:59.999 for TODAY', () => {
    const now = new Date(2024, 0, 3, 10, 30, 0); // Wed Jan 3 2024
    const due = computeDueAt('TODAY', now);
    expect(due.getFullYear()).toBe(2024);
    expect(due.getMonth()).toBe(0);
    expect(due.getDate()).toBe(3);
    expect(due.getHours()).toBe(23);
    expect(due.getMinutes()).toBe(59);
  });

  it('returns this Sunday 23:59:59.999 for THIS_WEEK', () => {
    const now = new Date(2024, 0, 1, 10, 0, 0); // Mon Jan 1 2024
    const due = computeDueAt('THIS_WEEK', now);
    expect(due.getDate()).toBe(7); // Sunday Jan 7 2024
    expect(due.getHours()).toBe(23);
  });

  it('THIS_WEEK on a Sunday returns the same day', () => {
    const now = new Date(2024, 0, 7, 10, 0, 0); // Sun Jan 7 2024
    const due = computeDueAt('THIS_WEEK', now);
    expect(due.getDate()).toBe(7);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task with XP mapped from difficulty', async () => {
    const token = await signup('taskcreate1@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '리스닝 20분', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'TODAY' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('리스닝 20분');
    expect(res.body.xpValue).toBe(20);
    expect(res.body.status).toBe('PENDING');
    expect(new Date(res.body.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a missing title', async () => {
    const token = await signup('taskcreate2@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'TODAY' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid difficulty', async () => {
    const token = await signup('taskcreate3@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x', category: 'STUDY', difficulty: 'IMPOSSIBLE', dueChoice: 'TODAY' });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.status).toBe(401);
  });
});
