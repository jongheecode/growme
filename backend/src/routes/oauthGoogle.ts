import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db';
import { issueToken } from './auth';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload) {
    return res.status(401).json({ error: 'invalid google token' });
  }
  const user = await prisma.user.upsert({
    where: { oauthProvider_oauthId: { oauthProvider: 'google', oauthId: payload.sub } },
    create: {
      oauthProvider: 'google',
      oauthId: payload.sub,
      email: payload.email,
      nickname: payload.name ?? '구글유저',
    },
    update: {},
  });
  const token = issueToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
});

export default router;
