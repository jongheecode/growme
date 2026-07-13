import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

describe('GET /api/growth/me', () => {
  it('returns a default gauge of 0 for a new user', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: 'newgrowth@example.com',
      password: 'password123',
      nickname: '새유저',
    });
    const res = await request(app)
      .get('/api/growth/me')
      .set('Authorization', `Bearer ${signupRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.currentGauge).toBe(0);
    expect(res.body.stage).toBe(0);
  });
});
