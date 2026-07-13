import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing token' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId?: unknown };
    if (typeof payload.userId !== 'string' || payload.userId.length === 0) {
      return res.status(401).json({ error: 'invalid token' });
    }
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}
