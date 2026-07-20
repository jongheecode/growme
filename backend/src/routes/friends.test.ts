import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

async function signup(nickname: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email: `${nickname}${Date.now()}${Math.random()}@example.com`,
    password: 'password123',
    nickname,
  });
  return res.body.token as string;
}

describe('POST /api/friends/request', () => {
  it('creates a pending friend request by nickname', async () => {
    const tokenA = await signup('철수');
    await signup('영희');
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('returns 404 for an unknown nickname', async () => {
    const tokenA = await signup('철수2');
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '존재안함' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when requesting yourself', async () => {
    const tokenA = await signup('철수3');
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '철수3' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate request', async () => {
    const tokenA = await signup('철수4');
    await signup('영희4');
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희4' });
    const res = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희4' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/friends/requests', () => {
  it('lists only pending requests addressed to me', async () => {
    const tokenA = await signup('철수5');
    const tokenB = await signup('영희5');
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희5' });

    const res = await request(app)
      .get('/api/friends/requests')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].requesterNickname).toBe('철수5');
  });
});

describe('POST /api/friends/:id/accept', () => {
  it('accepts a request addressed to me', async () => {
    const tokenA = await signup('철수6');
    const tokenB = await signup('영희6');
    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희6' });

    const res = await request(app)
      .post(`/api/friends/${reqRes.body.id}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
  });

  it('returns 404 when someone other than the addressee tries to accept', async () => {
    const tokenA = await signup('철수7');
    await signup('영희7');
    const tokenC = await signup('아무개7');
    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희7' });

    const res = await request(app)
      .post(`/api/friends/${reqRes.body.id}/accept`)
      .set('Authorization', `Bearer ${tokenC}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/friends/:id', () => {
  it('lets the addressee decline a pending request', async () => {
    const tokenA = await signup('철수8');
    const tokenB = await signup('영희8');
    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희8' });

    const res = await request(app)
      .delete(`/api/friends/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 when deleting a friendship you are not part of', async () => {
    const tokenA = await signup('철수9');
    await signup('영희9');
    const tokenC = await signup('아무개9');
    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희9' });

    const res = await request(app)
      .delete(`/api/friends/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${tokenC}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/friends', () => {
  it('returns only accepted friends with growth info', async () => {
    const tokenA = await signup('철수10');
    const tokenB = await signup('영희10');
    const reqRes = await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희10' });
    await request(app)
      .post(`/api/friends/${reqRes.body.id}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);

    const res = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nickname).toBe('영희10');
    expect(res.body[0].species).toBeNull();
    expect(res.body[0].totalXp).toBe(0);
  });

  it('does not include pending (unaccepted) requests', async () => {
    const tokenA = await signup('철수11');
    await signup('영희11');
    await request(app)
      .post('/api/friends/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nickname: '영희11' });

    const res = await request(app)
      .get('/api/friends')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.body).toEqual([]);
  });
});
