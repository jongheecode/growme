import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { sendPasswordResetEmail } from '../services/mailer';

const router = Router();
router.use(authRateLimiter);
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function issueToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

// OAuth 신규 가입은 사용자가 닉네임을 직접 고를 방법이 없어서(제공자
// 프로필 이름을 그대로 씀), 이미 쓰이고 있는 이름이면 조용히 실패하는
// 대신 짧은 랜덤 접미사를 붙여 유니크하게 만든다.
export async function uniqueNickname(base: string): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { nickname: base } });
  if (!existing) return base;
  return `${base}${crypto.randomBytes(2).toString('hex')}`;
}

router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;
  if (!isNonEmptyString(email) || !isNonEmptyString(password) || !isNonEmptyString(nickname)) {
    return res.status(400).json({ error: 'email, password and nickname are required' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, nickname: await uniqueNickname(nickname) },
    });
    const token = issueToken(user.id);
    res.status(201).json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'email already registered' });
    }
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const token = issueToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/change-password', requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!isNonEmptyString(email)) {
    return res.status(400).json({ error: 'email is required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      await sendPasswordResetEmail(email, `growme://reset-password?token=${token}`);
    }
    // 계정 존재 여부가 드러나지 않도록 항상 같은 응답을 준다.
    res.json({ message: '해당 이메일 계정이 있다면 재설정 링크를 보냈어요' });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!isNonEmptyString(token) || !isNonEmptyString(newPassword)) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }
  try {
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
