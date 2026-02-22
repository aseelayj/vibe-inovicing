import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { commitments, activityLog } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createCommitmentSchema,
  updateCommitmentSchema,
} from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / — list all commitments
router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true';
    const query = activeOnly
      ? db.select().from(commitments)
          .where(eq(commitments.isActive, true))
          .orderBy(asc(commitments.category), asc(commitments.name))
      : db.select().from(commitments)
          .orderBy(asc(commitments.category), asc(commitments.name));

    const result = await query;
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /summary — get commitment totals
router.get('/summary', async (_req, res, next) => {
  try {
    const active = await db.select().from(commitments)
      .where(eq(commitments.isActive, true));

    let totalMonthly = 0;
    for (const c of active) {
      const amount = parseFloat(String(c.amount));
      switch (c.frequency) {
        case 'weekly':
          totalMonthly += amount * 4.33;
          break;
        case 'monthly':
          totalMonthly += amount;
          break;
        case 'quarterly':
          totalMonthly += amount / 3;
          break;
        case 'yearly':
          totalMonthly += amount / 12;
          break;
      }
    }

    const byCategory: Record<string, number> = {};
    for (const c of active) {
      const amount = parseFloat(String(c.amount));
      let monthly = 0;
      switch (c.frequency) {
        case 'weekly': monthly = amount * 4.33; break;
        case 'monthly': monthly = amount; break;
        case 'quarterly': monthly = amount / 3; break;
        case 'yearly': monthly = amount / 12; break;
      }
      byCategory[c.category] = (byCategory[c.category] || 0) + monthly;
    }

    res.json({
      data: {
        totalMonthly: Math.round(totalMonthly * 100) / 100,
        totalYearly: Math.round(totalMonthly * 12 * 100) / 100,
        activeCount: active.length,
        byCategory: Object.entries(byCategory)
          .map(([category, total]) => ({
            category,
            total: Math.round(total * 100) / 100,
          }))
          .sort((a, b) => b.total - a.total),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id — get single commitment
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [commitment] = await db.select().from(commitments)
      .where(eq(commitments.id, id));

    if (!commitment) {
      return res.status(404).json({ message: 'Commitment not found' });
    }

    res.json({ data: commitment });
  } catch (err) {
    next(err);
  }
});

// POST / — create commitment
router.post(
  '/',
  validate(createCommitmentSchema),
  async (req, res, next) => {
    try {
      const [commitment] = await db.insert(commitments)
        .values(req.body).returning();

      await db.insert(activityLog).values({
        entityType: 'commitment',
        entityId: commitment.id,
        action: 'created',
        description: `Commitment "${commitment.name}" created`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: commitment });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — update commitment
router.put(
  '/:id',
  validate(updateCommitmentSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const [commitment] = await db.update(commitments)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(commitments.id, id))
        .returning();

      if (!commitment) {
        return res.status(404).json({ message: 'Commitment not found' });
      }

      await db.insert(activityLog).values({
        entityType: 'commitment',
        entityId: commitment.id,
        action: 'updated',
        description: `Commitment "${commitment.name}" updated`,
        userId: (req as AuthRequest).userId,
      });

      res.json({ data: commitment });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — delete commitment
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [commitment] = await db.delete(commitments)
      .where(eq(commitments.id, id))
      .returning();

    if (!commitment) {
      return res.status(404).json({ message: 'Commitment not found' });
    }

    await db.insert(activityLog).values({
      entityType: 'commitment',
      entityId: id,
      action: 'deleted',
      description: `Commitment "${commitment.name}" deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ message: 'Commitment deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
