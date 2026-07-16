import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { prisma } from '../db';

async function signupAndToken(email: string, nickname: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    nickname,
  });
  return res.body.token as string;
}

describe('GET /api/users/me', () => {
  it('returns the current user profile', async () => {
    const token = await signupAndToken('me@example.com', '나야');
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
    expect(res.body.nickname).toBe('나야');
    expect(res.body.bio).toBeNull();
  });

  it('rejects without an auth token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates bio', async () => {
    const token = await signupAndToken('bio@example.com', '바이오');
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: '오늘도 몰입!' });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('오늘도 몰입!');
  });

  it('rejects bio longer than 60 characters', async () => {
    const token = await signupAndToken('longbio@example.com', '롱바이오');
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(61) });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/users/me', () => {
  it('deletes the user and cascades related records', async () => {
    const token = await signupAndToken('bye@example.com', '탈퇴자');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const activity = await prisma.activity.create({
      data: { userId: decoded.userId, name: '운동', category: 'EXERCISE' },
    });
    await prisma.session.create({
      data: { userId: decoded.userId, activityId: activity.id, verifiedSeconds: 100 },
    });

    const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const stillThere = await prisma.user.findUnique({ where: { id: decoded.userId } });
    expect(stillThere).toBeNull();
  });
});
