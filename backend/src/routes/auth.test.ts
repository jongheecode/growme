import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import app from '../app';

vi.mock('../services/mailer', () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

import * as mailer from '../services/mailer';

function extractToken(resetLink: string): string {
  return new URL(resetLink.replace('growme://', 'https://dummy/')).searchParams.get('token')!;
}

describe('POST /api/auth/signup', () => {
  it('creates a user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'password123',
      nickname: `테스터${Math.random().toString(36).slice(2, 8)}`,
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('auto-suffixes a duplicate nickname instead of rejecting the signup', async () => {
    const nickname = `중복닉네임${Math.random().toString(36).slice(2, 8)}`;
    await request(app).post('/api/auth/signup').send({
      email: `first-${Date.now()}@example.com`,
      password: 'password123',
      nickname,
    });
    const res = await request(app).post('/api/auth/signup').send({
      email: `second-${Date.now()}@example.com`,
      password: 'password123',
      nickname,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.nickname).not.toBe(nickname);
    expect(res.body.user.nickname.startsWith(nickname)).toBe(true);
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'dup@example.com',
      password: 'password123',
      nickname: 'A',
    });
    const res = await request(app).post('/api/auth/signup').send({
      email: 'dup@example.com',
      password: 'password123',
      nickname: 'B',
    });
    expect(res.status).toBe(409);
  });

  it('rejects signup with missing email', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      password: 'password123',
      nickname: `테스터${Math.random().toString(36).slice(2, 8)}`,
    });
    expect(res.status).toBe(400);
  });

  it('rejects signup with missing password', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'nopassword@example.com',
      nickname: `테스터${Math.random().toString(36).slice(2, 8)}`,
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'login@example.com',
      password: 'password123',
      nickname: '로그인테스트',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'wrong@example.com',
      password: 'password123',
      nickname: 'C',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'wrong@example.com',
      password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });

  it('rejects login with missing email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects login with missing password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'someone@example.com',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/change-password', () => {
  async function signupAndToken() {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'pw@example.com',
      password: 'password123',
      nickname: '비번테스터',
    });
    return res.body.token as string;
  }

  it('changes the password when currentPassword is correct', async () => {
    const token = await signupAndToken();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'pw@example.com',
      password: 'newpassword456',
    });
    expect(loginRes.status).toBe(200);
  });

  it('rejects when currentPassword is wrong', async () => {
    const token = await signupAndToken();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });
    expect(res.status).toBe(401);
  });

  it('rejects without an auth token', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password and /reset-password', () => {
  it('issues a working reset token and lets the user set a new password', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'forgot@example.com',
      password: 'password123',
      nickname: '리셋테스터',
    });

    const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email: 'forgot@example.com' });
    expect(forgotRes.status).toBe(200);
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledWith('forgot@example.com', expect.stringContaining('token='));

    const resetLink = (mailer.sendPasswordResetEmail as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as string;
    const token = extractToken(resetLink);

    const resetRes = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'brandnewpass789' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'forgot@example.com',
      password: 'brandnewpass789',
    });
    expect(loginRes.status).toBe(200);
  });

  it('rejects reusing the same reset token twice', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'reuse@example.com',
      password: 'password123',
      nickname: '재사용테스터',
    });
    await request(app).post('/api/auth/forgot-password').send({ email: 'reuse@example.com' });
    const resetLink = (mailer.sendPasswordResetEmail as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as string;
    const token = extractToken(resetLink);

    const first = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'anotherpass111' });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'yetanotherpass222' });
    expect(second.status).toBe(400);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'not-a-real-token', newPassword: 'whatever123' });
    expect(res.status).toBe(400);
  });

  it('responds with the same generic message for an unknown email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'doesnotexist@example.com' });
    expect(res.status).toBe(200);
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalledWith('doesnotexist@example.com', expect.anything());
  });
});
