import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { issueToken, isNonEmptyString } from './auth';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!isNonEmptyString(idToken)) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'invalid google token' });
  }
  if (!payload) {
    return res.status(401).json({ error: 'invalid google token' });
  }

  try {
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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'email already registered' });
    }
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
