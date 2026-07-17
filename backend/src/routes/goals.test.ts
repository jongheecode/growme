import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../app';
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
});

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

describe('POST /api/goals/chat', () => {
  it('returns a plain reply when no goal is set yet', async () => {
    const token = await signup('goalschat1@example.com');
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '요즘 어때?' }] });

    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: '안녕' }] });

    expect(res.status).toBe(200);
    expect(res.body.goalSet).toBe(false);
    expect(res.body.reply).toBe('요즘 어때?');
  });

  it('creates a Goal and returns it when the model calls set_goal', async () => {
    const token = await signup('goalschat2@example.com');
    mockCreate.mockResolvedValue({
      content: [
        { type: 'text', text: '좋아!' },
        { type: 'tool_use', name: 'set_goal', input: { title: '매일 달리기', category: 'EXERCISE' } },
      ],
    });

    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: '운동 습관 만들고 싶어' }] });

    expect(res.status).toBe(200);
    expect(res.body.goalSet).toBe(true);
    expect(res.body.goal.title).toBe('매일 달리기');

    const stored = await prisma.goal.findUnique({ where: { id: res.body.goal.id } });
    expect(stored).not.toBeNull();
  });

  it('returns 400 when messages is missing or malformed', async () => {
    const token = await signup('goalschat3@example.com');
    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 500 when the Anthropic call fails', async () => {
    const token = await signup('goalschat4@example.com');
    mockCreate.mockRejectedValue(new Error('rate limited'));

    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: '안녕' }] });

    expect(res.status).toBe(500);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/goals/chat').send({ messages: [] });
    expect(res.status).toBe(401);
  });
});
