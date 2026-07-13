import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll } from 'vitest';
import { requireAuth } from './auth';

function buildTestApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ userId: (req as any).userId });
  });
  return app;
}

describe('requireAuth', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  });

  it('rejects requests without a token', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('accepts requests with a valid token', async () => {
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET!);
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-1');
  });

  it('rejects invalid tokens', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('rejects validly-signed tokens missing a userId claim', async () => {
    const token = jwt.sign({ foo: 'bar' }, process.env.JWT_SECRET!);
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects validly-signed tokens with a non-string userId claim', async () => {
    const token = jwt.sign({ userId: 12345 }, process.env.JWT_SECRET!);
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
