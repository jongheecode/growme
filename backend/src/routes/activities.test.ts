import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

async function signupAndGetToken(email: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    nickname: '테스터',
  });
  return res.body.token as string;
}

describe('Activity CRUD', () => {
  it('creates and lists activities scoped to the user', async () => {
    const token = await signupAndGetToken('act1@example.com');
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '알고리즘 스터디', category: 'STUDY' });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe('알고리즘 스터디');
  });

  it('does not list another user activities', async () => {
    const tokenA = await signupAndGetToken('act2@example.com');
    const tokenB = await signupAndGetToken('act3@example.com');
    await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A의 활동', category: 'EXERCISE' });

    const listRes = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('soft-deletes an activity, excluding it from the list', async () => {
    const token = await signupAndGetToken('act4@example.com');
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '삭제될 활동', category: 'ETC' });
    const activityId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body).toHaveLength(0);
  });
});
