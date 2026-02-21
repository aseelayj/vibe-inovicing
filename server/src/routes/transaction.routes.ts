import { Router } from 'express';
import {
  eq, desc, and, sql, ilike, count,
} from 'drizzle-orm';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db } from '../db/index.js';
import {
  transactions,
  bankAccounts,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  batchCreateTransactionsSchema,
} from '@vibe/shared';
import { recalculateBalance } from './bank-account.routes.js';
import { parseTransactionsFromText } from '../services/ai.service.js';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET / - List transactions with filters + pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      bankAccountId, type, category, search,
      page = '1', pageSize = '25',
    } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    if (bankAccountId) {
      conditions.push(eq(transactions.bankAccountId, Number(bankAccountId)));
    }
    if (type && type !== 'all') {
      conditions.push(eq(transactions.type, String(type)));
    }
    if (category) {
      conditions.push(eq(transactions.category, String(category)));
    }
    if (search) {
      conditions.push(ilike(transactions.description, `%${String(search)}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const size = Math.min(100, Math.max(1, parseInt(String(pageSize), 10)));
    const offset = (pageNum - 1) * size;

    const [countResult] = await db
      .select({ value: count() })
      .from(transactions)
      .where(where);

    const total = countResult?.value ?? 0;

    const result = await db.query.transactions.findMany({
      where,
      with: { bankAccount: true },
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
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

// GET /:id - Get single transaction
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const result = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
      with: { bankAccount: true },
    });

    if (!result) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create transaction + recalculate balance
router.post(
  '/',
  validate(createTransactionSchema),
  async (req, res, next) => {
    try {
      const {
        bankAccountId, type, category, amount, date, description, notes,
        taxAmount, supplierName, invoiceReference,
      } = req.body;

      // Verify account exists
      const [account] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, bankAccountId));

      if (!account) {
        res.status(404).json({ error: 'Bank account not found' });
        return;
      }

      const result = await db.transaction(async (tx) => {
        const [txn] = await tx.insert(transactions).values({
          bankAccountId,
          type,
          category,
          amount: String(amount),
          date,
          description,
          notes,
          taxAmount: taxAmount != null ? String(taxAmount) : null,
          supplierName: supplierName ?? null,
          invoiceReference: invoiceReference ?? null,
        }).returning();

        await recalculateBalance(tx, bankAccountId);

        await tx.insert(activityLog).values({
          entityType: 'transaction',
          entityId: txn.id,
          action: 'created',
          description: `${type} transaction of ${amount} - ${description}`,
          userId: (req as AuthRequest).userId,
        });

        return txn;
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id - Update transaction + recalculate balance
router.put(
  '/:id',
  validate(updateTransactionSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const [existing] = await db.select().from(transactions)
        .where(eq(transactions.id, id));

      if (!existing) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const updates: Record<string, unknown> = {
        ...req.body,
        updatedAt: new Date(),
      };
      if (updates.amount !== undefined) {
        updates.amount = String(updates.amount);
      }
      if (updates.taxAmount !== undefined && updates.taxAmount !== null) {
        updates.taxAmount = String(updates.taxAmount);
      }

      const result = await db.transaction(async (tx) => {
        const [txn] = await tx.update(transactions)
          .set(updates as any)
          .where(eq(transactions.id, id))
          .returning();

        // Recalculate old account if bankAccountId changed
        const newAccountId = req.body.bankAccountId ?? existing.bankAccountId;
        if (req.body.bankAccountId && req.body.bankAccountId !== existing.bankAccountId) {
          await recalculateBalance(tx, existing.bankAccountId);
        }
        await recalculateBalance(tx, newAccountId);

        return txn;
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete transaction + recalculate balance
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const [txn] = await db.select().from(transactions)
      .where(eq(transactions.id, id));

    if (!txn) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(transactions).where(eq(transactions.id, id));
      await recalculateBalance(tx, txn.bankAccountId);

      await tx.insert(activityLog).values({
        entityType: 'transaction',
        entityId: id,
        action: 'deleted',
        description: `${txn.type} transaction of ${txn.amount} deleted`,
        userId: (req as AuthRequest).userId,
      });
    });

    res.json({ data: { message: 'Transaction deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /import - AI import from file
router.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { originalname, mimetype, buffer } = req.file;
    let rawText = '';

    if (
      mimetype === 'text/csv'
      || originalname.endsWith('.csv')
      || mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || mimetype === 'application/vnd.ms-excel'
      || originalname.endsWith('.xlsx')
      || originalname.endsWith('.xls')
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rawText = XLSX.utils.sheet_to_csv(sheet);
    } else if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      // For PDFs, send as base64 to Gemini multimodal
      const base64 = buffer.toString('base64');
      const parsed = await parseTransactionsFromText('', base64, 'application/pdf');
      res.json({ data: parsed });
      return;
    } else {
      // Try as plain text
      rawText = buffer.toString('utf-8');
    }

    const parsed = await parseTransactionsFromText(rawText);
    res.json({ data: parsed });
  } catch (err) {
    next(err);
  }
});

// POST /batch - Bulk create transactions from import review
router.post(
  '/batch',
  validate(batchCreateTransactionsSchema),
  async (req, res, next) => {
    try {
      const { bankAccountId, transactions: txnList } = req.body;

      // Verify account exists
      const [account] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, bankAccountId));

      if (!account) {
        res.status(404).json({ error: 'Bank account not found' });
        return;
      }

      const result = await db.transaction(async (tx) => {
        const created = [];
        for (const txn of txnList) {
          const [row] = await tx.insert(transactions).values({
            bankAccountId,
            type: txn.type,
            category: txn.category,
            amount: String(txn.amount),
            date: txn.date,
            description: txn.description,
            notes: txn.notes,
            taxAmount: txn.taxAmount != null ? String(txn.taxAmount) : null,
            supplierName: txn.supplierName ?? null,
            invoiceReference: txn.invoiceReference ?? null,
          }).returning();
          created.push(row);
        }

        await recalculateBalance(tx, bankAccountId);

        await tx.insert(activityLog).values({
          entityType: 'transaction',
          entityId: created[0].id,
          action: 'batch_imported',
          description: `Imported ${created.length} transactions into ${account.name}`,
          userId: (req as AuthRequest).userId,
        });

        return created;
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
