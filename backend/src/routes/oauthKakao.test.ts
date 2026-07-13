import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import app from '../app';

vi.mock('axios');

beforeEach(() => {
  vi.clearAllMocks();
  (axios.get as any).mockResolvedValue({
    data: {
      id: 123456,
      kakao_account: { email: 'k@example.com', profile: { nickname: '카카오유저' } },
    },
  });
});

describe('POST /api/auth/kakao', () => {
  it('creates a new user from kakao profile', async () => {
    const res = await request(app).post('/api/auth/kakao').send({ accessToken: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.nickname).toBe('카카오유저');
  });

  it('rejects when accessToken is missing', async () => {
    const res = await request(app).post('/api/auth/kakao').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects when kakao api call fails (invalid/expired token)', async () => {
    (axios.get as any).mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await request(app).post('/api/auth/kakao').send({ accessToken: 'invalid' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('rejects with 409 when email is already registered via email/password signup', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'collision@example.com',
      password: 'password123',
      nickname: '기존유저',
    });
    (axios.get as any).mockResolvedValueOnce({
      data: {
        id: 789012,
        kakao_account: { email: 'collision@example.com', profile: { nickname: '카카오유저2' } },
      },
    });
    const res = await request(app).post('/api/auth/kakao').send({ accessToken: 'fake-collision' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });
});
