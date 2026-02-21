import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as {
      sub: number;
      role: string;
    };
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function ownerOnly(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.userRole !== 'owner') {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }
  next();
}
