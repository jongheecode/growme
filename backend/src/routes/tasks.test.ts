import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../app';
import { computeDueAt } from './tasks';
import { prisma } from '../db';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '잘했어!' }] });
});

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

describe('GET /api/tasks', () => {
  it('lists only the authenticated user\'s tasks', async () => {
    const tokenA = await signup('tasklist1@example.com');
    const tokenB = await signup('tasklist2@example.com');
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A의 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'B의 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('A의 할일');
  });

  it('flips overdue PENDING tasks to FAILED on read', async () => {
    const token = await signup('tasklist3@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '지난 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.find((t: { id: string }) => t.id === overdue.id).status).toBe('FAILED');

    const stored = await prisma.task.findUnique({ where: { id: overdue.id } });
    expect(stored?.status).toBe('FAILED');
  });

  it('generates and stores a reaction for a newly-FAILED task', async () => {
    const token = await signup('taskfailreact1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '실패할 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.find((t: { id: string }) => t.id === overdue.id);
    expect(found.status).toBe('FAILED');
    expect(found.reactionText).toBe('잘했어!');
    expect(found.reactionShownAt).toBeNull();
  });

  it('does not call Anthropic again for a FAILED task that already has a reaction', async () => {
    const token = await signup('taskfailreact2@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '이미 반응 있음',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('leaves reactionText null when Anthropic fails, without breaking the list response', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const token = await signup('taskfailreact3@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '반응 생성 실패',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.find((t: { id: string }) => t.id === overdue.id);
    expect(found.status).toBe('FAILED');
    expect(found.reactionText).toBeNull();
  });
});

describe('PATCH /api/tasks/:id/complete', () => {
  it('completes a pending task before its deadline', async () => {
    const token = await signup('taskcomplete1@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '완료할 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('rejects completing an already-completed task', async () => {
    const token = await signup('taskcomplete2@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '두번 완료', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });
    await request(app).patch(`/api/tasks/${createRes.body.id}/complete`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('rejects completing an expired task and marks it FAILED', async () => {
    const token = await signup('taskcomplete3@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '만료된 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app)
      .patch(`/api/tasks/${overdue.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('task expired');

    const stored = await prisma.task.findUnique({ where: { id: overdue.id } });
    expect(stored?.status).toBe('FAILED');
  });

  it('returns 404 for another user\'s task', async () => {
    const tokenA = await signup('taskcomplete4@example.com');
    const tokenB = await signup('taskcomplete5@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A 소유', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('generates and stores a reaction on successful completion', async () => {
    const token = await signup('taskreact1@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '반응 태스크', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reactionText).toBe('잘했어!');

    const stored = await prisma.task.findUnique({ where: { id: createRes.body.id } });
    expect(stored?.reactionShownAt).not.toBeNull();
  });

  it('completes successfully with reactionText null when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const token = await signup('taskreact2@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '반응 실패 태스크', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.reactionText).toBeNull();
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a pending task', async () => {
    const token = await signup('taskdelete1@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '지울 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });

    const res = await request(app)
      .delete(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const stored = await prisma.task.findUnique({ where: { id: createRes.body.id } });
    expect(stored).toBeNull();
  });

  it('rejects deleting a completed task', async () => {
    const token = await signup('taskdelete2@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '완료된 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });
    await request(app).patch(`/api/tasks/${createRes.body.id}/complete`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .delete(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for another user\'s task', async () => {
    const tokenA = await signup('taskdelete3@example.com');
    const tokenB = await signup('taskdelete4@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A 소유', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });

    const res = await request(app)
      .delete(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tasks with goalId', () => {
  it('attaches the task to the given goal when it belongs to the user', async () => {
    const token = await signup('taskgoal1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const goal = await prisma.goal.create({ data: { userId: decoded.userId, title: '목표', category: 'STUDY' } });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY', goalId: goal.id });

    expect(res.status).toBe(201);
    expect(res.body.goalId).toBe(goal.id);
  });

  it('rejects a goalId belonging to another user', async () => {
    const tokenA = await signup('taskgoal2@example.com');
    const tokenB = await signup('taskgoal3@example.com');
    const decodedA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString());
    const goal = await prisma.goal.create({ data: { userId: decodedA.userId, title: 'A의 목표', category: 'STUDY' } });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY', goalId: goal.id });

    expect(res.status).toBe(400);
  });

  it('rejects a nonexistent goalId', async () => {
    const token = await signup('taskgoal4@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY', goalId: 'nonexistent-id' });
    expect(res.status).toBe(400);
  });

  it('creates a task without a goalId as before (backward compatible)', async () => {
    const token = await signup('taskgoal5@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });
    expect(res.status).toBe(201);
    expect(res.body.goalId).toBeNull();
  });
});
