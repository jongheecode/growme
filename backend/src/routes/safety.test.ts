import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

async function signup(nickname: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email: `${nickname}${Date.now()}${Math.random()}@example.com`,
    password: 'password123',
    nickname,
  });
  return { token: res.body.token as string, id: res.body.user.id as string };
}

describe('POST /api/safety/block', () => {
  it('blocks a user', async () => {
    const a = await signup('차단자1');
    const b = await signup('피차단자1');
    const res = await request(app)
      .post('/api/safety/block')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: b.id });
    expect(res.status).toBe(201);
    expect(res.body.blockedId).toBe(b.id);
  });

  it('rejects blocking yourself', async () => {
    const a = await signup('차단자2');
    const res = await request(app)
      .post('/api/safety/block')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: a.id });
    expect(res.status).toBe(400);
  });

  it('removes an existing friendship when blocking', async () => {
    const a = await signup('차단자3');
    const b = await signup('피차단자3');
    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ nickname: '피차단자3' });
    await request(app)
      .post(`/api/friends/${reqRes.body.id}/accept`)
      .set('Authorization', `Bearer ${b.token}`);

    await request(app)
      .post('/api/safety/block')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: b.id });

    const friendsRes = await request(app).get('/api/friends').set('Authorization', `Bearer ${a.token}`);
    expect(friendsRes.body).toEqual([]);
  });

  it('prevents a blocked user from sending a new friend request', async () => {
    const a = await signup('차단자4');
    const b = await signup('피차단자4');
    await request(app)
      .post('/api/safety/block')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: b.id });

    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ nickname: '차단자4' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/safety/blocked and DELETE /api/safety/block/:userId', () => {
  it('lists blocked users and allows unblocking', async () => {
    const a = await signup('차단자5');
    const b = await signup('피차단자5');
    await request(app)
      .post('/api/safety/block')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: b.id });

    const listRes = await request(app).get('/api/safety/blocked').set('Authorization', `Bearer ${a.token}`);
    expect(listRes.body).toEqual([{ id: b.id, nickname: '피차단자5' }]);

    const unblockRes = await request(app)
      .delete(`/api/safety/block/${b.id}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(unblockRes.status).toBe(204);

    const listAfter = await request(app).get('/api/safety/blocked').set('Authorization', `Bearer ${a.token}`);
    expect(listAfter.body).toEqual([]);
  });
});

describe('POST /api/safety/report', () => {
  it('creates a report', async () => {
    const a = await signup('신고자1');
    const b = await signup('신고대상1');
    const res = await request(app)
      .post('/api/safety/report')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: b.id, reason: '부적절한 닉네임' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('rejects reporting yourself', async () => {
    const a = await signup('신고자2');
    const res = await request(app)
      .post('/api/safety/report')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: a.id, reason: '아무거나' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty reason', async () => {
    const a = await signup('신고자3');
    const b = await signup('신고대상3');
    const res = await request(app)
      .post('/api/safety/report')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ userId: b.id, reason: '' });
    expect(res.status).toBe(400);
  });
});
