import { Router } from 'express';
import { eq, desc, sql, sum } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  payments,
  invoices,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createPaymentSchema } from '@vibe/shared';

const router = Router();

// Helper: recalculate invoice payment status
async function recalculateInvoicePayments(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  invoiceId: number,
) {
  const [result] = await tx
    .select({ totalPaid: sum(payments.amount) })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));

  const totalPaid = parseFloat(result?.totalPaid ?? '0');

  const [invoice] = await tx.select().from(invoices)
    .where(eq(invoices.id, invoiceId));

  if (!invoice) return;

  const invoiceTotal = parseFloat(invoice.total);

  let status = invoice.status;
  let paidAt: Date | null = invoice.paidAt;

  if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
    status = 'paid';
    paidAt = paidAt ?? new Date();
  } else if (totalPaid > 0) {
    status = 'partially_paid';
    paidAt = null;
  } else {
    // Revert to sent if payments removed (don't go back to draft)
    if (status === 'paid' || status === 'partially_paid') {
      status = 'sent';
    }
    paidAt = null;
  }

  await tx.update(invoices)
    .set({
      amountPaid: String(totalPaid.toFixed(2)),
      status,
      paidAt,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}

// GET / - List all payments with invoice relation
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query.payments.findMany({
      with: { invoice: true },
      orderBy: [desc(payments.paymentDate)],
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /invoice/:invoiceId - Get payments for a specific invoice
router.get('/invoice/:invoiceId', async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId, 10);

    const result = await db.select().from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create payment
router.post('/', validate(createPaymentSchema), async (req, res, next) => {
  try {
    const { invoiceId, amount, paymentDate, paymentMethod, reference, notes } = req.body;

    // Verify invoice exists
    const [invoice] = await db.select().from(invoices)
      .where(eq(invoices.id, invoiceId));

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [payment] = await tx.insert(payments).values({
        invoiceId,
        amount: String(amount),
        paymentDate,
        paymentMethod,
        reference,
        notes,
      }).returning();

      await recalculateInvoicePayments(tx, invoiceId);

      await tx.insert(activityLog).values({
        entityType: 'payment',
        entityId: payment.id,
        action: 'created',
        description: `Payment of ${amount} recorded for invoice ${invoice.invoiceNumber}`,
      });

      return payment;
    });

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete payment and recalculate invoice
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const [payment] = await db.select().from(payments)
      .where(eq(payments.id, id));

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(payments).where(eq(payments.id, id));

      await recalculateInvoicePayments(tx, payment.invoiceId);

      await tx.insert(activityLog).values({
        entityType: 'payment',
        entityId: id,
        action: 'deleted',
        description: `Payment of ${payment.amount} deleted`,
      });
    });

    res.json({ data: { message: 'Payment deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
