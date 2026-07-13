import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const router = Router();

function issueToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
}

router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'email already registered' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, nickname },
  });
  const token = issueToken(user.id);
  res.status(201).json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
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
});

export default router;
