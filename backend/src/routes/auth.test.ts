import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

describe('POST /api/auth/signup', () => {
  it('creates a user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'password123',
      nickname: '테스터',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
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
      nickname: '테스터',
    });
    expect(res.status).toBe(400);
  });

  it('rejects signup with missing password', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'nopassword@example.com',
      nickname: '테스터',
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
