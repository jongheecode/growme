import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import app from '../app';

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({ sub: 'google-user-1', email: 'g@example.com', name: '구글유저' }),
      }),
    })),
  };
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
});
