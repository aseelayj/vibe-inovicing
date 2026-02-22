import { Router } from 'express';
import { eq, asc, count, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, activityLog } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createAccountSchema,
  updateAccountSchema,
  DEFAULT_CHART_OF_ACCOUNTS,
} from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / - List all accounts (flat list, ordered by code)
router.get('/', async (_req, res, next) => {
  try {
    const result = await db.query.accounts.findMany({
      orderBy: [asc(accounts.code)],
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /tree - Get accounts as a tree structure
router.get('/tree', async (_req, res, next) => {
  try {
    const allAccounts = await db.query.accounts.findMany({
      orderBy: [asc(accounts.code)],
    });

    // Build tree from flat list
    const accountMap = new Map<number, typeof allAccounts[0] & { children: typeof allAccounts }>();
    const roots: (typeof allAccounts[0] & { children: typeof allAccounts })[] = [];

    for (const acct of allAccounts) {
      accountMap.set(acct.id, { ...acct, children: [] });
    }

    for (const acct of allAccounts) {
      const node = accountMap.get(acct.id)!;
      if (acct.parentId && accountMap.has(acct.parentId)) {
        accountMap.get(acct.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json({ data: roots });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single account
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const result = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    });

    if (!result) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create account
router.post(
  '/',
  validate(createAccountSchema),
  async (req, res, next) => {
    try {
      const { code, name, nameAr, type, parentId, description, isActive } = req.body;

      // Check for duplicate code
      const [existing] = await db.select()
        .from(accounts)
        .where(eq(accounts.code, code));

      if (existing) {
        res.status(409).json({ error: 'Account code already exists' });
        return;
      }

      // Validate parent exists if provided
      if (parentId) {
        const [parent] = await db.select()
          .from(accounts)
          .where(eq(accounts.id, parentId));

        if (!parent) {
          res.status(404).json({ error: 'Parent account not found' });
          return;
        }
      }

      const [result] = await db.insert(accounts).values({
        code,
        name,
        nameAr: nameAr ?? null,
        type,
        parentId: parentId ?? null,
        description: description ?? null,
        isActive: isActive ?? true,
      }).returning();

      await db.insert(activityLog).values({
        entityType: 'account',
        entityId: result.id,
        action: 'created',
        description: `Account ${code} - ${name} created`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id - Update account
router.put(
  '/:id',
  validate(updateAccountSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const [existing] = await db.select()
        .from(accounts)
        .where(eq(accounts.id, id));

      if (!existing) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }

      // If code is changing, check for duplicates
      if (req.body.code && req.body.code !== existing.code) {
        const [dup] = await db.select()
          .from(accounts)
          .where(eq(accounts.code, req.body.code));

        if (dup) {
          res.status(409).json({ error: 'Account code already exists' });
          return;
        }
      }

      // Prevent setting parent to self
      if (req.body.parentId === id) {
        res.status(400).json({ error: 'Account cannot be its own parent' });
        return;
      }

      const updates: Record<string, unknown> = {
        ...req.body,
        updatedAt: new Date(),
      };

      const [result] = await db.update(accounts)
        .set(updates as any)
        .where(eq(accounts.id, id))
        .returning();

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete account (only if non-system and no children)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [acct] = await db.select()
      .from(accounts)
      .where(eq(accounts.id, id));

    if (!acct) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (acct.isSystem) {
      res.status(400).json({ error: 'Cannot delete system accounts' });
      return;
    }

    // Check for children
    const [childCount] = await db.select({ value: count() })
      .from(accounts)
      .where(eq(accounts.parentId, id));

    if (childCount && childCount.value > 0) {
      res.status(400).json({
        error: 'Cannot delete account with sub-accounts. Delete sub-accounts first.',
      });
      return;
    }

    await db.delete(accounts).where(eq(accounts.id, id));

    await db.insert(activityLog).values({
      entityType: 'account',
      entityId: id,
      action: 'deleted',
      description: `Account ${acct.code} - ${acct.name} deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Account deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /seed - Seed default chart of accounts
router.post('/seed', async (req, res, next) => {
  try {
    // Check if accounts already exist
    const [existingCount] = await db.select({ value: count() })
      .from(accounts);

    if (existingCount && existingCount.value > 0) {
      res.status(400).json({ error: 'Chart of accounts already has entries. Clear existing accounts first or add accounts individually.' });
      return;
    }

    // Insert in order, resolving parent references
    const codeToId = new Map<string, number>();

    for (const acct of DEFAULT_CHART_OF_ACCOUNTS) {
      const parentId = acct.parentCode ? codeToId.get(acct.parentCode) ?? null : null;

      const [inserted] = await db.insert(accounts).values({
        code: acct.code,
        name: acct.name,
        nameAr: acct.nameAr,
        type: acct.type,
        parentId,
        isSystem: true,
        isActive: true,
      }).returning();

      codeToId.set(acct.code, inserted.id);
    }

    await db.insert(activityLog).values({
      entityType: 'account',
      entityId: 0,
      action: 'seeded',
      description: `Seeded default chart of accounts (${DEFAULT_CHART_OF_ACCOUNTS.length} accounts)`,
      userId: (req as AuthRequest).userId,
    });

    // Return full list
    const result = await db.query.accounts.findMany({
      orderBy: [asc(accounts.code)],
    });

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
