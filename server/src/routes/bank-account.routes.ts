import { Router } from 'express';
import { eq, desc, sum, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bankAccounts,
  transactions,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
} from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';

const router = Router();

// Helper: recalculate bank account balance
async function recalculateBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  accountId: number,
) {
  const [account] = await tx.select().from(bankAccounts)
    .where(eq(bankAccounts.id, accountId));

  if (!account) return;

  const [incomeResult] = await tx
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(sql`${transactions.bankAccountId} = ${accountId} AND ${transactions.type} = 'income'`);

  const [expenseResult] = await tx
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(sql`${transactions.bankAccountId} = ${accountId} AND ${transactions.type} = 'expense'`);

  const income = parseFloat(incomeResult?.total ?? '0');
  const expenses = parseFloat(expenseResult?.total ?? '0');
  const initialBalance = parseFloat(account.initialBalance);
  const currentBalance = initialBalance + income - expenses;

  await tx.update(bankAccounts)
    .set({
      currentBalance: String(currentBalance.toFixed(2)),
      updatedAt: new Date(),
    })
    .where(eq(bankAccounts.id, accountId));
}

// GET / - List all bank accounts
router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true';
    const conditions = activeOnly
      ? eq(bankAccounts.isActive, true)
      : undefined;

    const result = await db.select().from(bankAccounts)
      .where(conditions)
      .orderBy(desc(bankAccounts.createdAt));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get bank account with transactions
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const result = await db.query.bankAccounts.findFirst({
      where: eq(bankAccounts.id, id),
      with: {
        transactions: {
          orderBy: [desc(transactions.date)],
        },
      },
    });

    if (!result) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create bank account
router.post(
  '/',
  validate(createBankAccountSchema),
  async (req, res, next) => {
    try {
      const { name, bankName, accountNumber, currency, initialBalance, isActive, notes } = req.body;

      const [account] = await db.insert(bankAccounts).values({
        name,
        bankName,
        accountNumber,
        currency,
        initialBalance: String(initialBalance ?? 0),
        currentBalance: String(initialBalance ?? 0),
        isActive,
        notes,
      }).returning();

      await db.insert(activityLog).values({
        entityType: 'bank_account',
        entityId: account.id,
        action: 'created',
        description: `Bank account "${name}" created`,
      });

      res.status(201).json({ data: account });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id - Update bank account
router.put(
  '/:id',
  validate(updateBankAccountSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const [existing] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, id));

      if (!existing) {
        res.status(404).json({ error: 'Bank account not found' });
        return;
      }

      const updates: Record<string, unknown> = {
        ...req.body,
        updatedAt: new Date(),
      };

      if (req.body.initialBalance !== undefined) {
        updates.initialBalance = String(req.body.initialBalance);
        delete updates.currentBalance;
      }

      const result = await db.transaction(async (tx) => {
        const [account] = await tx.update(bankAccounts)
          .set(updates as any)
          .where(eq(bankAccounts.id, id))
          .returning();

        // Recalculate if initialBalance changed
        if (req.body.initialBalance !== undefined) {
          await recalculateBalance(tx, id);
        }

        // Re-fetch after recalculation
        const [updated] = await tx.select().from(bankAccounts)
          .where(eq(bankAccounts.id, id));
        return updated;
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete bank account (cascade deletes transactions)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, id));

    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));

    await db.insert(activityLog).values({
      entityType: 'bank_account',
      entityId: id,
      action: 'deleted',
      description: `Bank account "${account.name}" deleted`,
    });

    res.json({ data: { message: 'Bank account deleted' } });
  } catch (err) {
    next(err);
  }
});

export { recalculateBalance };
export default router;
