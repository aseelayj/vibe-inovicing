import { Router } from 'express';
import { eq, desc, and, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bankTransfers,
  bankAccounts,
  transactions,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createBankTransferSchema,
  updateBankTransferSchema,
} from '@vibe/shared';
import { recalculateBalance } from './bank-account.routes.js';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / - List transfers with pagination
router.get('/', async (req, res, next) => {
  try {
    const { page = '1', pageSize = '25' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const size = Math.min(100, Math.max(1, parseInt(String(pageSize), 10)));
    const offset = (pageNum - 1) * size;

    const [countResult] = await db
      .select({ value: count() })
      .from(bankTransfers);

    const total = countResult?.value ?? 0;

    const result = await db.query.bankTransfers.findMany({
      with: { fromAccount: true, toAccount: true },
      orderBy: [desc(bankTransfers.date), desc(bankTransfers.createdAt)],
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

// GET /:id - Get single transfer
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const result = await db.query.bankTransfers.findFirst({
      where: eq(bankTransfers.id, id),
      with: { fromAccount: true, toAccount: true },
    });

    if (!result) {
      res.status(404).json({ error: 'Transfer not found' });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create transfer (atomically debit source, credit destination)
router.post(
  '/',
  validate(createBankTransferSchema),
  async (req, res, next) => {
    try {
      const { fromAccountId, toAccountId, amount, date, reference, description } = req.body;

      // Verify both accounts exist
      const [fromAcct] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, fromAccountId));
      const [toAcct] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, toAccountId));

      if (!fromAcct) {
        res.status(404).json({ error: 'Source bank account not found' });
        return;
      }
      if (!toAcct) {
        res.status(404).json({ error: 'Destination bank account not found' });
        return;
      }

      const result = await db.transaction(async (tx) => {
        // Create the transfer record
        const [transfer] = await tx.insert(bankTransfers).values({
          fromAccountId,
          toAccountId,
          amount: String(amount),
          date,
          reference: reference ?? null,
          description: description ?? null,
          status: 'completed',
        }).returning();

        // Create expense transaction on source account
        await tx.insert(transactions).values({
          bankAccountId: fromAccountId,
          type: 'expense',
          category: 'other',
          amount: String(amount),
          date,
          description: `Transfer to ${toAcct.name}${reference ? ` (${reference})` : ''}`,
          notes: description ?? null,
        });

        // Create income transaction on destination account
        await tx.insert(transactions).values({
          bankAccountId: toAccountId,
          type: 'income',
          category: 'other',
          amount: String(amount),
          date,
          description: `Transfer from ${fromAcct.name}${reference ? ` (${reference})` : ''}`,
          notes: description ?? null,
        });

        // Recalculate both balances
        await recalculateBalance(tx, fromAccountId);
        await recalculateBalance(tx, toAccountId);

        // Log activity
        await tx.insert(activityLog).values({
          entityType: 'bank_transfer',
          entityId: transfer.id,
          action: 'created',
          description: `Transfer of ${amount} from ${fromAcct.name} to ${toAcct.name}`,
          userId: (req as AuthRequest).userId,
        });

        return transfer;
      });

      // Return with relations
      const full = await db.query.bankTransfers.findFirst({
        where: eq(bankTransfers.id, result.id),
        with: { fromAccount: true, toAccount: true },
      });

      res.status(201).json({ data: full });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete transfer and reverse transactions
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [transfer] = await db.select().from(bankTransfers)
      .where(eq(bankTransfers.id, id));

    if (!transfer) {
      res.status(404).json({ error: 'Transfer not found' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(bankTransfers).where(eq(bankTransfers.id, id));

      await tx.insert(activityLog).values({
        entityType: 'bank_transfer',
        entityId: id,
        action: 'deleted',
        description: `Transfer of ${transfer.amount} deleted`,
        userId: (req as AuthRequest).userId,
      });
    });

    res.json({ data: { message: 'Transfer deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
