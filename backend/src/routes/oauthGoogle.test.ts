import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../app';

const { mockVerifyIdToken } = vi.hoisted(() => {
  return { mockVerifyIdToken: vi.fn() };
});

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
  };
});

beforeEach(() => {
  mockVerifyIdToken.mockReset();
  mockVerifyIdToken.mockResolvedValue({
    getPayload: () => ({ sub: 'google-user-1', email: 'g@example.com', name: '구글유저' }),
  });
});

describe('POST /api/auth/google', () => {
  it('creates a new user on first login', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.nickname).toBe('구글유저');
  });

  it('logs in the same user on second login', async () => {
    await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(res.status).toBe(200);
  });

  it('rejects when idToken is missing', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  it('rejects when verifyIdToken throws (invalid/expired token)', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Token used too late'));
    const res = await request(app).post('/api/auth/google').send({ idToken: 'expired-or-tampered' });
    expect(res.status).toBe(401);
  });

  it('rejects with 409 when the email is already registered via email/password signup', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'collide@example.com',
      password: 'password123',
      nickname: '기존유저',
    });
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'google-user-collide', email: 'collide@example.com', name: '구글유저2' }),
    });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake-collide' });
    expect(res.status).toBe(409);
  });
});
