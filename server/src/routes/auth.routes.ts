import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../env.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '@vibe/shared';

const router = Router();

// Hash the password on first startup for comparison
let passwordHash: string | null = null;

async function getPasswordHash() {
  if (!passwordHash) {
    passwordHash = await bcrypt.hash(env.AUTH_PASSWORD, 10);
  }
  return passwordHash;
}

router.post('/login', validate(loginSchema), async (req, res) => {
  const { password } = req.body;

  if (password !== env.AUTH_PASSWORD) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const token = jwt.sign({ sub: 'admin' }, env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ data: { token } });
});

router.post('/verify', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    jwt.verify(header.slice(7), env.JWT_SECRET);
    res.json({ data: { valid: true } });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
