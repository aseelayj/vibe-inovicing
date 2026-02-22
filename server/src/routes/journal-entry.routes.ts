import { Router } from 'express';
import { eq, desc, and, count, sql, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  journalEntries,
  journalEntryLines,
  accounts,
  activityLog,
  settings,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
} from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Helper: generate next journal entry number
async function getNextEntryNumber(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const [latest] = await tx.select({ entryNumber: journalEntries.entryNumber })
    .from(journalEntries)
    .orderBy(desc(journalEntries.id))
    .limit(1);

  if (!latest) return 'JE-0001';

  const match = latest.entryNumber.match(/JE-(\d+)/);
  if (!match) return 'JE-0001';

  const next = parseInt(match[1], 10) + 1;
  return `JE-${String(next).padStart(4, '0')}`;
}

// GET / - List journal entries with pagination
router.get('/', async (req, res, next) => {
  try {
    const { status, page = '1', pageSize = '25' } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];
    if (status && status !== 'all') {
      conditions.push(eq(journalEntries.status, String(status)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const size = Math.min(100, Math.max(1, parseInt(String(pageSize), 10)));
    const offset = (pageNum - 1) * size;

    const [countResult] = await db
      .select({ value: count() })
      .from(journalEntries)
      .where(where);

    const total = countResult?.value ?? 0;

    const result = await db.query.journalEntries.findMany({
      where,
      with: {
        lines: {
          with: { account: true },
          orderBy: [asc(journalEntryLines.sortOrder)],
        },
      },
      orderBy: [desc(journalEntries.entryDate), desc(journalEntries.createdAt)],
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

// GET /:id - Get single journal entry with lines
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const result = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        lines: {
          with: { account: true },
          orderBy: [asc(journalEntryLines.sortOrder)],
        },
      },
    });

    if (!result) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create journal entry with lines
router.post(
  '/',
  validate(createJournalEntrySchema),
  async (req, res, next) => {
    try {
      const { entryDate, reference, description, memo, lines } = req.body;

      const totalDebit = lines.reduce((s: number, l: any) => s + (l.debitAmount || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + (l.creditAmount || 0), 0);

      // Double-check balance
      if (Math.abs(totalDebit - totalCredit) >= 0.01) {
        res.status(400).json({ error: 'Debits must equal credits' });
        return;
      }

      // Verify all accounts exist
      for (const line of lines) {
        const [acct] = await db.select().from(accounts)
          .where(eq(accounts.id, line.accountId));
        if (!acct) {
          res.status(404).json({ error: `Account ID ${line.accountId} not found` });
          return;
        }
      }

      const result = await db.transaction(async (tx) => {
        const entryNumber = await getNextEntryNumber(tx);

        const [entry] = await tx.insert(journalEntries).values({
          entryNumber,
          entryDate,
          reference: reference ?? null,
          description,
          memo: memo ?? null,
          status: 'draft',
          totalDebit: String(totalDebit),
          totalCredit: String(totalCredit),
        }).returning();

        // Insert lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          await tx.insert(journalEntryLines).values({
            journalEntryId: entry.id,
            accountId: line.accountId,
            description: line.description ?? null,
            debitAmount: String(line.debitAmount || 0),
            creditAmount: String(line.creditAmount || 0),
            sortOrder: i,
          });
        }

        // Log activity
        await tx.insert(activityLog).values({
          entityType: 'journal_entry',
          entityId: entry.id,
          action: 'created',
          description: `Journal entry ${entryNumber} - ${description}`,
          userId: (req as AuthRequest).userId,
        });

        return entry;
      });

      // Return with lines
      const full = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, result.id),
        with: {
          lines: {
            with: { account: true },
            orderBy: [asc(journalEntryLines.sortOrder)],
          },
        },
      });

      res.status(201).json({ data: full });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id - Update journal entry (only if draft)
router.put(
  '/:id',
  validate(updateJournalEntrySchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const [existing] = await db.select().from(journalEntries)
        .where(eq(journalEntries.id, id));

      if (!existing) {
        res.status(404).json({ error: 'Journal entry not found' });
        return;
      }

      if (existing.status !== 'draft') {
        res.status(400).json({ error: 'Only draft entries can be edited' });
        return;
      }

      const { lines, ...entryUpdates } = req.body;

      await db.transaction(async (tx) => {
        // Update entry fields
        if (Object.keys(entryUpdates).length > 0) {
          await tx.update(journalEntries)
            .set({ ...entryUpdates, updatedAt: new Date() } as any)
            .where(eq(journalEntries.id, id));
        }

        // Replace lines if provided
        if (lines && lines.length > 0) {
          const totalDebit = lines.reduce((s: number, l: any) => s + (l.debitAmount || 0), 0);
          const totalCredit = lines.reduce((s: number, l: any) => s + (l.creditAmount || 0), 0);

          if (Math.abs(totalDebit - totalCredit) >= 0.01) {
            throw new Error('Debits must equal credits');
          }

          // Delete old lines
          await tx.delete(journalEntryLines)
            .where(eq(journalEntryLines.journalEntryId, id));

          // Insert new lines
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            await tx.insert(journalEntryLines).values({
              journalEntryId: id,
              accountId: line.accountId,
              description: line.description ?? null,
              debitAmount: String(line.debitAmount || 0),
              creditAmount: String(line.creditAmount || 0),
              sortOrder: i,
            });
          }

          // Update totals
          await tx.update(journalEntries)
            .set({
              totalDebit: String(totalDebit),
              totalCredit: String(totalCredit),
              updatedAt: new Date(),
            })
            .where(eq(journalEntries.id, id));
        }
      });

      const full = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, id),
        with: {
          lines: {
            with: { account: true },
            orderBy: [asc(journalEntryLines.sortOrder)],
          },
        },
      });

      res.json({ data: full });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/post - Post journal entry (finalize and update account balances)
router.post('/:id/post', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const entry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: { lines: true },
    });

    if (!entry) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }

    if (entry.status !== 'draft') {
      res.status(400).json({ error: 'Only draft entries can be posted' });
      return;
    }

    await db.transaction(async (tx) => {
      // Update account balances
      for (const line of entry.lines) {
        const debit = Number(line.debitAmount) || 0;
        const credit = Number(line.creditAmount) || 0;

        // For assets & expenses: debit increases, credit decreases
        // For liabilities, equity, revenue: credit increases, debit decreases
        const [acct] = await tx.select().from(accounts)
          .where(eq(accounts.id, line.accountId));

        if (acct) {
          let balanceChange = 0;
          if (acct.type === 'asset' || acct.type === 'expense') {
            balanceChange = debit - credit;
          } else {
            balanceChange = credit - debit;
          }

          await tx.update(accounts)
            .set({
              balance: sql`${accounts.balance} + ${String(balanceChange)}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, line.accountId));
        }
      }

      // Mark as posted
      await tx.update(journalEntries)
        .set({ status: 'posted', updatedAt: new Date() })
        .where(eq(journalEntries.id, id));

      // Log activity
      await tx.insert(activityLog).values({
        entityType: 'journal_entry',
        entityId: id,
        action: 'posted',
        description: `Journal entry ${entry.entryNumber} posted`,
        userId: (req as AuthRequest).userId,
      });
    });

    const full = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        lines: {
          with: { account: true },
          orderBy: [asc(journalEntryLines.sortOrder)],
        },
      },
    });

    res.json({ data: full });
  } catch (err) {
    next(err);
  }
});

// POST /:id/void - Void a posted journal entry (reverses balances)
router.post('/:id/void', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const entry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: { lines: true },
    });

    if (!entry) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }

    if (entry.status !== 'posted') {
      res.status(400).json({ error: 'Only posted entries can be voided' });
      return;
    }

    await db.transaction(async (tx) => {
      // Reverse account balances
      for (const line of entry.lines) {
        const debit = Number(line.debitAmount) || 0;
        const credit = Number(line.creditAmount) || 0;

        const [acct] = await tx.select().from(accounts)
          .where(eq(accounts.id, line.accountId));

        if (acct) {
          let balanceChange = 0;
          if (acct.type === 'asset' || acct.type === 'expense') {
            balanceChange = -(debit - credit);
          } else {
            balanceChange = -(credit - debit);
          }

          await tx.update(accounts)
            .set({
              balance: sql`${accounts.balance} + ${String(balanceChange)}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, line.accountId));
        }
      }

      // Mark as voided
      await tx.update(journalEntries)
        .set({ status: 'voided', updatedAt: new Date() })
        .where(eq(journalEntries.id, id));

      // Log activity
      await tx.insert(activityLog).values({
        entityType: 'journal_entry',
        entityId: id,
        action: 'voided',
        description: `Journal entry ${entry.entryNumber} voided`,
        userId: (req as AuthRequest).userId,
      });
    });

    const full = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        lines: {
          with: { account: true },
          orderBy: [asc(journalEntryLines.sortOrder)],
        },
      },
    });

    res.json({ data: full });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete journal entry (only if draft)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [entry] = await db.select().from(journalEntries)
      .where(eq(journalEntries.id, id));

    if (!entry) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }

    if (entry.status !== 'draft') {
      res.status(400).json({ error: 'Only draft entries can be deleted. Void posted entries instead.' });
      return;
    }

    await db.transaction(async (tx) => {
      // Lines cascade-delete automatically
      await tx.delete(journalEntries).where(eq(journalEntries.id, id));

      await tx.insert(activityLog).values({
        entityType: 'journal_entry',
        entityId: id,
        action: 'deleted',
        description: `Journal entry ${entry.entryNumber} deleted`,
        userId: (req as AuthRequest).userId,
      });
    });

    res.json({ data: { message: 'Journal entry deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
