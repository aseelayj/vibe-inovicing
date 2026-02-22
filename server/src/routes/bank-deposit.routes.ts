import { Router } from 'express';
import { eq, desc, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bankDeposits,
  bankAccounts,
  transactions,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createBankDepositSchema,
  updateBankDepositSchema,
} from '@vibe/shared';
import { recalculateBalance } from './bank-account.routes.js';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / - List deposits with pagination
router.get('/', async (req, res, next) => {
  try {
    const { bankAccountId, page = '1', pageSize = '25' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const size = Math.min(100, Math.max(1, parseInt(String(pageSize), 10)));
    const offset = (pageNum - 1) * size;

    const where = bankAccountId
      ? eq(bankDeposits.bankAccountId, Number(bankAccountId))
      : undefined;

    const [countResult] = await db
      .select({ value: count() })
      .from(bankDeposits)
      .where(where);

    const total = countResult?.value ?? 0;

    const result = await db.query.bankDeposits.findMany({
      where,
      with: { bankAccount: true },
      orderBy: [desc(bankDeposits.depositDate), desc(bankDeposits.createdAt)],
      limit: size,
      offset,
    });

    res.json({
      data: result,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single deposit
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const result = await db.query.bankDeposits.findFirst({
      where: eq(bankDeposits.id, id),
      with: { bankAccount: true },
    });

    if (!result) {
      res.status(404).json({ error: 'Deposit not found' });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create deposit (credits bank account)
router.post(
  '/',
  validate(createBankDepositSchema),
  async (req, res, next) => {
    try {
      const {
        bankAccountId, amount, depositDate, depositMethod,
        reference, description, memo, depositItems,
      } = req.body;

      // Verify account exists
      const [account] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, bankAccountId));

      if (!account) {
        res.status(404).json({ error: 'Bank account not found' });
        return;
      }

      const result = await db.transaction(async (tx) => {
        // Create deposit record
        const [deposit] = await tx.insert(bankDeposits).values({
          bankAccountId,
          amount: String(amount),
          depositDate,
          depositMethod,
          reference: reference ?? null,
          description: description ?? null,
          memo: memo ?? null,
          status: 'completed',
          depositItems: depositItems ?? null,
        }).returning();

        // Create income transaction
        await tx.insert(transactions).values({
          bankAccountId,
          type: 'income',
          category: 'other',
          amount: String(amount),
          date: depositDate,
          description: `Deposit - ${depositMethod}${reference ? ` (${reference})` : ''}`,
          notes: description ?? memo ?? null,
        });

        // Recalculate balance
        await recalculateBalance(tx, bankAccountId);

        // Log activity
        await tx.insert(activityLog).values({
          entityType: 'bank_deposit',
          entityId: deposit.id,
          action: 'created',
          description: `Deposit of ${amount} into ${account.name} via ${depositMethod}`,
          userId: (req as AuthRequest).userId,
        });

        return deposit;
      });

      // Return with relation
      const full = await db.query.bankDeposits.findFirst({
        where: eq(bankDeposits.id, result.id),
        with: { bankAccount: true },
      });

      res.status(201).json({ data: full });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete deposit
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [deposit] = await db.select().from(bankDeposits)
      .where(eq(bankDeposits.id, id));

    if (!deposit) {
      res.status(404).json({ error: 'Deposit not found' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(bankDeposits).where(eq(bankDeposits.id, id));

      await tx.insert(activityLog).values({
        entityType: 'bank_deposit',
        entityId: id,
        action: 'deleted',
        description: `Deposit of ${deposit.amount} deleted`,
        userId: (req as AuthRequest).userId,
      });
    });

    res.json({ data: { message: 'Deposit deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
