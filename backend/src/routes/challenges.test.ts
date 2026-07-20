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

function dateRange() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 6);
  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

async function createChallenge(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  const { startDate, endDate } = dateRange();
  return request(app)
    .post('/api/challenges')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '집중 챌린지', targetXp: 100, startDate, endDate, ...overrides });
}

async function completeTaskWithXp(userId: string, xpValue: number, category: 'STUDY' | 'EXERCISE' = 'STUDY') {
  await prisma.task.create({
    data: {
      userId,
      title: '태스크',
      category,
      difficulty: 'EASY',
      xpValue,
      dueAt: new Date(),
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

describe('POST /api/challenges', () => {
  it('creates a challenge and registers the creator as the first member', async () => {
    const a = await signup(`챌린지A${Date.now()}`);
    const res = await createChallenge(a.token);
    expect(res.status).toBe(201);
    expect(res.body.inviteCode).toBeDefined();

    const mineRes = await request(app)
      .get('/api/challenges/mine')
      .set('Authorization', `Bearer ${a.token}`);
    expect(mineRes.body).toHaveLength(1);
  });
});

describe('GET /api/challenges/mine', () => {
  it('includes achievedXp and percent for the current user', async () => {
    const a = await signup(`챌린지진행A${Date.now()}`);
    await createChallenge(a.token, { targetXp: 100 });
    await completeTaskWithXp(a.userId, 40);

    const res = await request(app)
      .get('/api/challenges/mine')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.body[0].achievedXp).toBe(40);
    expect(res.body[0].percent).toBe(40);
  });

  it('only counts completions in the matching category when set', async () => {
    const a = await signup(`챌린지카테A${Date.now()}`);
    await createChallenge(a.token, { targetXp: 100, category: 'STUDY' });
    await completeTaskWithXp(a.userId, 40, 'STUDY');
    await completeTaskWithXp(a.userId, 999, 'EXERCISE');

    const res = await request(app)
      .get('/api/challenges/mine')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.body[0].achievedXp).toBe(40);
  });
});

describe('GET /api/challenges/:id', () => {
  it('returns 404 for a non-member', async () => {
    const a = await signup(`챌린지상세A${Date.now()}`);
    const b = await signup(`챌린지상세B${Date.now()}`);
    const createRes = await createChallenge(a.token);

    const res = await request(app)
      .get(`/api/challenges/${createRes.body.id}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(404);
  });

  it('lists members ranked by achievedXp descending', async () => {
    const a = await signup(`챌린지멤버A${Date.now()}`);
    const b = await signup(`챌린지멤버B${Date.now()}`);
    const createRes = await createChallenge(a.token, { targetXp: 100 });
    const bNickname = (await prisma.user.findUniqueOrThrow({ where: { id: b.userId } })).nickname;
    await request(app)
      .post('/api/challenges/join')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ inviteCode: createRes.body.inviteCode });
    await completeTaskWithXp(a.userId, 10);
    await completeTaskWithXp(b.userId, 90);

    const res = await request(app)
      .get(`/api/challenges/${createRes.body.id}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.members[0].nickname).toBe(bNickname);
    expect(res.body.members[0].achievedXp).toBe(90);
  });
});

describe('POST /api/challenges/join', () => {
  it('joins a challenge by invite code', async () => {
    const a = await signup(`참여A${Date.now()}`);
    const b = await signup(`참여B${Date.now()}`);
    const createRes = await createChallenge(a.token);

    const res = await request(app)
      .post('/api/challenges/join')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ inviteCode: createRes.body.inviteCode });
    expect(res.status).toBe(201);
  });

  it('returns 404 for an invalid invite code', async () => {
    const b = await signup(`참여실패${Date.now()}`);
    const res = await request(app)
      .post('/api/challenges/join')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ inviteCode: 'doesnotexist' });
    expect(res.status).toBe(404);
  });

  it('returns 409 when already a member', async () => {
    const a = await signup(`중복참여A${Date.now()}`);
    const createRes = await createChallenge(a.token);
    const res = await request(app)
      .post('/api/challenges/join')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ inviteCode: createRes.body.inviteCode });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/challenges/:id/leave', () => {
  it('lets a regular member leave', async () => {
    const a = await signup(`탈퇴A${Date.now()}`);
    const b = await signup(`탈퇴B${Date.now()}`);
    const createRes = await createChallenge(a.token);
    await request(app)
      .post('/api/challenges/join')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ inviteCode: createRes.body.inviteCode });

    const res = await request(app)
      .delete(`/api/challenges/${createRes.body.id}/leave`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(204);
  });

  it('prevents the creator from leaving', async () => {
    const a = await signup(`탈퇴생성자${Date.now()}`);
    const createRes = await createChallenge(a.token);

    const res = await request(app)
      .delete(`/api/challenges/${createRes.body.id}/leave`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the caller is not a member', async () => {
    const a = await signup(`탈퇴비멤버A${Date.now()}`);
    const c = await signup(`탈퇴비멤버C${Date.now()}`);
    const createRes = await createChallenge(a.token);

    const res = await request(app)
      .delete(`/api/challenges/${createRes.body.id}/leave`)
      .set('Authorization', `Bearer ${c.token}`);
    expect(res.status).toBe(404);
  });
});
