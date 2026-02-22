import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '@vibe/shared';

const router = Router();

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    const [user] = await db.select().from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const jwtOptions: jwt.SignOptions = rememberMe
      ? { expiresIn: '30d' }
      : { expiresIn: '8h' };
    const token = jwt.sign(
      { sub: user.id, role: user.role },
      env.JWT_SECRET,
      jwtOptions,
    );

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/verify', async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as unknown as {
      sub: number;
      role: string;
    };

    // Fetch user from DB to return fresh data
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    }).from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json({ data: { valid: true, user } });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
