import { Router } from 'express';
import {
  eq, desc, and, ilike, count, sql,
} from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  journalEntries,
  journalEntryLines,
  accounts,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
} from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / - List journal entries with pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      status, search,
      page = '1', pageSize = '25',
    } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    if (status && status !== 'all') {
      conditions.push(eq(journalEntries.status, String(status)));
    }
    if (search) {
      conditions.push(ilike(journalEntries.description, `%${String(search)}%`));
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
          orderBy: (lines, { asc }) => [asc(lines.sortOrder)],
        },
      },
      orderBy: [desc(journalEntries.date), desc(journalEntries.createdAt)],
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

// GET /:id - Get single journal entry
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const result = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        lines: {
          with: { account: true },
          orderBy: (lines, { asc }) => [asc(lines.sortOrder)],
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
      const { date, description, reference, notes, lines } = req.body;

      // Validate debits = credits
      const totalDebit = lines.reduce(
        (sum: number, l: { debit: number }) => sum + (l.debit || 0),
        0,
      );
      const totalCredit = lines.reduce(
        (sum: number, l: { credit: number }) => sum + (l.credit || 0),
        0,
      );

      if (Math.abs(totalDebit - totalCredit) > 0.005) {
        res.status(400).json({
          error: 'Total debits must equal total credits',
        });
        return;
      }

      // Validate all accountIds exist
      const accountIds = [...new Set(lines.map((l: { accountId: number }) => l.accountId))];
      const existingAccounts = await db.select({ id: accounts.id })
        .from(accounts)
        .where(sql`${accounts.id} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`);

      if (existingAccounts.length !== accountIds.length) {
        res.status(400).json({ error: 'One or more account IDs are invalid' });
        return;
      }

      // Generate entry number
      const [lastEntry] = await db.select({ entryNumber: journalEntries.entryNumber })
        .from(journalEntries)
        .orderBy(desc(journalEntries.id))
        .limit(1);

      let nextNum = 1;
      if (lastEntry?.entryNumber) {
        const match = lastEntry.entryNumber.match(/JE-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const entryNumber = `JE-${String(nextNum).padStart(5, '0')}`;

      const result = await db.transaction(async (tx) => {
        const [entry] = await tx.insert(journalEntries).values({
          entryNumber,
          date,
          description,
          reference: reference ?? null,
          notes: notes ?? null,
          status: 'draft',
        }).returning();

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          await tx.insert(journalEntryLines).values({
            journalEntryId: entry.id,
            accountId: line.accountId,
            description: line.description ?? null,
            debit: String(line.debit || 0),
            credit: String(line.credit || 0),
            sortOrder: i,
          });
        }

        await tx.insert(activityLog).values({
          entityType: 'journal_entry',
          entityId: entry.id,
          action: 'created',
          description: `Journal entry ${entryNumber} created: ${description}`,
          userId: (req as AuthRequest).userId,
        });

        // Return with lines
        return tx.query.journalEntries.findFirst({
          where: eq(journalEntries.id, entry.id),
          with: {
            lines: {
              with: { account: true },
              orderBy: (lines, { asc }) => [asc(lines.sortOrder)],
            },
          },
        });
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id - Update journal entry (only draft entries)
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

      if (existing.status === 'posted' && req.body.status !== 'posted') {
        res.status(400).json({ error: 'Cannot modify a posted journal entry' });
        return;
      }

      const { lines, ...updates } = req.body;

      // If lines are provided, validate debits = credits
      if (lines) {
        const totalDebit = lines.reduce(
          (sum: number, l: { debit: number }) => sum + (l.debit || 0),
          0,
        );
        const totalCredit = lines.reduce(
          (sum: number, l: { credit: number }) => sum + (l.credit || 0),
          0,
        );

        if (Math.abs(totalDebit - totalCredit) > 0.005) {
          res.status(400).json({
            error: 'Total debits must equal total credits',
          });
          return;
        }
      }

      const result = await db.transaction(async (tx) => {
        // Update entry fields
        if (Object.keys(updates).length > 0) {
          await tx.update(journalEntries)
            .set({ ...updates, updatedAt: new Date() } as any)
            .where(eq(journalEntries.id, id));
        }

        // Replace lines if provided
        if (lines) {
          await tx.delete(journalEntryLines)
            .where(eq(journalEntryLines.journalEntryId, id));

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            await tx.insert(journalEntryLines).values({
              journalEntryId: id,
              accountId: line.accountId,
              description: line.description ?? null,
              debit: String(line.debit || 0),
              credit: String(line.credit || 0),
              sortOrder: i,
            });
          }
        }

        return tx.query.journalEntries.findFirst({
          where: eq(journalEntries.id, id),
          with: {
            lines: {
              with: { account: true },
              orderBy: (lns, { asc }) => [asc(lns.sortOrder)],
            },
          },
        });
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/post - Post a draft journal entry
router.post('/:id/post', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const entry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        lines: {
          with: { account: true },
        },
      },
    });

    if (!entry) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }

    if (entry.status === 'posted') {
      res.status(400).json({ error: 'Journal entry is already posted' });
      return;
    }

    if (!entry.lines || entry.lines.length < 2) {
      res.status(400).json({ error: 'Journal entry must have at least 2 lines' });
      return;
    }

    await db.transaction(async (tx) => {
      // Update balances on each account
      for (const line of entry.lines!) {
        const debit = parseFloat(String(line.debit)) || 0;
        const credit = parseFloat(String(line.credit)) || 0;
        const accountType = line.account?.type;

        // For assets and expenses: debit increases, credit decreases
        // For liabilities, equity, and revenue: credit increases, debit decreases
        let balanceChange: number;
        if (accountType === 'asset' || accountType === 'expense') {
          balanceChange = debit - credit;
        } else {
          balanceChange = credit - debit;
        }

        await tx.update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${balanceChange}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, line.accountId));
      }

      await tx.update(journalEntries)
        .set({ status: 'posted', updatedAt: new Date() })
        .where(eq(journalEntries.id, id));

      await tx.insert(activityLog).values({
        entityType: 'journal_entry',
        entityId: id,
        action: 'posted',
        description: `Journal entry ${entry.entryNumber} posted`,
        userId: (req as AuthRequest).userId,
      });
    });

    const result = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        lines: {
          with: { account: true },
          orderBy: (lines, { asc }) => [asc(lines.sortOrder)],
        },
      },
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete draft journal entry
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

    if (entry.status === 'posted') {
      res.status(400).json({ error: 'Cannot delete a posted journal entry' });
      return;
    }

    await db.transaction(async (tx) => {
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
