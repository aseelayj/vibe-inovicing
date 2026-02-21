import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
} from '@vibe/shared';
import { ownerOnly, type AuthRequest } from '../middleware/auth.middleware.js';
import { parseId } from '../utils/parse-id.js';

const router = Router();

// GET / - List all users (owner only)
router.get('/', ownerOnly, async (_req, res, next) => {
  try {
    const result = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users).orderBy(desc(users.createdAt));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /me - Get own profile
router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /me/password - Change own password
router.put(
  '/me/password',
  validate(changePasswordSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const [user] = await db.select().from(users)
        .where(eq(users.id, req.userId!)).limit(1);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, req.userId!));

      res.json({ data: { message: 'Password updated' } });
    } catch (err) {
      next(err);
    }
  },
);

// POST / - Create user (owner only)
router.post(
  '/',
  ownerOnly,
  validate(createUserSchema),
  async (req, res, next) => {
    try {
      const { name, email, password, role } = req.body;

      // Check if email already exists
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, email.toLowerCase())).limit(1);
      if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [user] = await db.insert(users).values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: role || 'accountant',
      }).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id - Update user (owner only)
router.put(
  '/:id',
  ownerOnly,
  validate(updateUserSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      // Cannot change own role
      if (id === req.userId && req.body.role) {
        res.status(400).json({ error: 'Cannot change your own role' });
        return;
      }

      // Check email uniqueness if changing email
      if (req.body.email) {
        const [existing] = await db.select({ id: users.id }).from(users)
          .where(eq(users.email, req.body.email.toLowerCase())).limit(1);
        if (existing && existing.id !== id) {
          res.status(409).json({ error: 'Email already in use' });
          return;
        }
        req.body.email = req.body.email.toLowerCase();
      }

      const [updated] = await db.update(users)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!updated) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Deactivate user (owner only)
router.delete('/:id', ownerOnly, async (req: AuthRequest, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    if (id === req.userId) {
      res.status(400).json({ error: 'Cannot deactivate your own account' });
      return;
    }

    const [updated] = await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ data: { message: 'User deactivated' } });
  } catch (err) {
    next(err);
  }
});

export default router;
