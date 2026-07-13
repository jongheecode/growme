import { Router } from 'express';
import axios from 'axios';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { issueToken, isNonEmptyString } from './auth';

const router = Router();

router.post('/kakao', async (req, res) => {
  const { accessToken } = req.body;
  if (!isNonEmptyString(accessToken)) {
    return res.status(400).json({ error: 'accessToken is required' });
  }

  let profileRes;
  try {
    profileRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    return res.status(401).json({ error: 'invalid kakao token' });
  }

  const kakaoId = String(profileRes.data.id);
  const account = profileRes.data.kakao_account ?? {};

  try {
    const user = await prisma.user.upsert({
      where: { oauthProvider_oauthId: { oauthProvider: 'kakao', oauthId: kakaoId } },
      create: {
        oauthProvider: 'kakao',
        oauthId: kakaoId,
        email: account.email,
        nickname: account.profile?.nickname ?? '카카오유저',
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
