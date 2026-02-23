import { Router } from 'express';
import { eq, or, ilike, desc, and, gte, lte, sql, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, invoices, payments, quotes, activityLog } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createClientSchema, updateClientSchema } from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / - List clients with optional search and pagination
router.get('/', async (req, res, next) => {
  try {
    const { search, page = '1', pageSize = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, Math.min(100, parseInt(pageSize as string, 10) || 50));
    const offset = (pageNum - 1) * size;

    const conditions = [];
    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(clients.name, pattern),
          ilike(clients.email, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ value: count() })
      .from(clients)
      .where(whereClause);

    const total = totalResult?.value ?? 0;

    const result = await db.select().from(clients)
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(size)
      .offset(offset);

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

// GET /:id - Get single client with invoices and quotes
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const client = await db.query.clients.findFirst({
      where: eq(clients.id, id),
      with: {
        invoices: true,
        quotes: true,
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json({ data: client });
  } catch (err) {
    next(err);
  }
});

// POST / - Create client
router.post('/', validate(createClientSchema), async (req, res, next) => {
  try {
    const [client] = await db.insert(clients)
      .values(req.body)
      .returning();

    await db.insert(activityLog).values({
      entityType: 'client',
      entityId: client.id,
      action: 'created',
      description: `Client "${client.name}" created`,
      userId: (req as AuthRequest).userId,
    });

    res.status(201).json({ data: client });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update client
router.put('/:id', validate(updateClientSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [updated] = await db.update(clients)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'client',
      entityId: updated.id,
      action: 'updated',
      description: `Client "${updated.name}" updated`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete client
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    // Check for related documents and warn if force flag not set
    const [invoiceCount] = await db.select({ count: count() })
      .from(invoices).where(eq(invoices.clientId, id));
    const [quoteCount] = await db.select({ count: count() })
      .from(quotes).where(eq(quotes.clientId, id));

    const relatedInvoices = invoiceCount?.count ?? 0;
    const relatedQuotes = quoteCount?.count ?? 0;

    if ((relatedInvoices > 0 || relatedQuotes > 0) && req.query.force !== 'true') {
      res.status(409).json({
        error: 'Client has related documents',
        relatedInvoices,
        relatedQuotes,
        message: `This client has ${relatedInvoices} invoice(s) and ${relatedQuotes} quote(s). These will lose their client association.`,
      });
      return;
    }

    const [deleted] = await db.delete(clients)
      .where(eq(clients.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'client',
      entityId: deleted.id,
      action: 'deleted',
      description: `Client "${deleted.name}" deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Client deleted' } });
  } catch (err) {
    next(err);
  }
});

// GET /:id/statement - Client statement of account
router.get('/:id/statement', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const { startDate, endDate } = req.query;
    const start = (startDate as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = (endDate as string) || new Date().toISOString().split('T')[0];

    // Get client info
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, id),
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Get invoices in period
    const clientInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.clientId, id),
          gte(invoices.issueDate, start),
          lte(invoices.issueDate, end),
          sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
        ),
      )
      .orderBy(invoices.issueDate);

    // Get payments in period
    const clientPayments = await db
      .select({
        payment: payments,
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.clientId, id),
          gte(payments.paymentDate, start),
          lte(payments.paymentDate, end),
        ),
      )
      .orderBy(payments.paymentDate);

    // Calculate opening balance (invoices before start minus payments before start)
    const [priorInvoices] = await db
      .select({ value: sql<string>`COALESCE(SUM(CAST(${invoices.total} AS NUMERIC)), 0)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.clientId, id),
          sql`${invoices.issueDate} < ${start}`,
          sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
        ),
      );

    const [priorPayments] = await db
      .select({ value: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)` })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.clientId, id),
          sql`${payments.paymentDate} < ${start}`,
        ),
      );

    const openingBalance = parseFloat(priorInvoices?.value ?? '0') - parseFloat(priorPayments?.value ?? '0');

    // Build entries
    type Entry = {
      date: string;
      type: 'invoice' | 'payment';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    };

    const entries: Entry[] = [];
    let runningBalance = openingBalance;
    let totalInvoiced = 0;
    let totalPaid = 0;

    // Merge and sort all entries by date
    const allEntries: { date: string; sortKey: string; entry: Omit<Entry, 'balance'> }[] = [];

    for (const inv of clientInvoices) {
      const total = parseFloat(String(inv.total));
      totalInvoiced += total;
      allEntries.push({
        date: inv.issueDate,
        sortKey: `${inv.issueDate}-0`,
        entry: {
          date: inv.issueDate,
          type: 'invoice',
          reference: inv.invoiceNumber,
          description: `Invoice ${inv.invoiceNumber}`,
          debit: total,
          credit: 0,
        },
      });
    }

    for (const row of clientPayments) {
      const amount = parseFloat(String(row.payment.amount));
      totalPaid += amount;
      allEntries.push({
        date: row.payment.paymentDate,
        sortKey: `${row.payment.paymentDate}-1`,
        entry: {
          date: row.payment.paymentDate,
          type: 'payment',
          reference: row.payment.reference || `PMT-${row.payment.id}`,
          description: `Payment for ${row.invoiceNumber}`,
          debit: 0,
          credit: amount,
        },
      });
    }

    allEntries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    for (const item of allEntries) {
      runningBalance += item.entry.debit - item.entry.credit;
      entries.push({ ...item.entry, balance: runningBalance });
    }

    res.json({
      data: {
        client,
        period: { startDate: start, endDate: end },
        openingBalance,
        entries,
        closingBalance: runningBalance,
        totalInvoiced,
        totalPaid,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
