import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  recurringInvoices,
  recurringInvoiceLineItems,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createRecurringSchema } from '@vibe/shared';

const router = Router();

// Helper: calculate line item totals
function calculateTotals(
  lineItems: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
) {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

// GET / - List all recurring invoices with client relation
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query.recurringInvoices.findMany({
      with: { client: true },
      orderBy: [desc(recurringInvoices.createdAt)],
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single recurring invoice with line items and client
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const recurring = await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, id),
      with: {
        client: true,
        lineItems: true,
      },
    });

    if (!recurring) {
      res.status(404).json({ error: 'Recurring invoice not found' });
      return;
    }

    res.json({ data: recurring });
  } catch (err) {
    next(err);
  }
});

// POST / - Create recurring invoice with line items
router.post('/', validate(createRecurringSchema), async (req, res, next) => {
  try {
    const {
      lineItems: lineItemsInput,
      taxRate = 0,
      ...recurringData
    } = req.body;

    const totals = calculateTotals(lineItemsInput, taxRate);

    const result = await db.transaction(async (tx) => {
      const [recurring] = await tx.insert(recurringInvoices).values({
        ...recurringData,
        taxRate: String(taxRate),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        nextRunDate: recurringData.startDate,
      }).returning();

      const lineItemRows = lineItemsInput.map(
        (item: { description: string; quantity: number; unitPrice: number }, idx: number) => ({
          recurringInvoiceId: recurring.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.quantity * item.unitPrice),
          sortOrder: idx,
        }),
      );

      await tx.insert(recurringInvoiceLineItems).values(lineItemRows);

      await tx.insert(activityLog).values({
        entityType: 'recurring_invoice',
        entityId: recurring.id,
        action: 'created',
        description: `Recurring invoice created (${recurring.frequency})`,
      });

      return recurring;
    });

    const created = await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update recurring invoice and replace line items
router.put('/:id', validate(createRecurringSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      lineItems: lineItemsInput,
      taxRate = 0,
      ...recurringData
    } = req.body;

    const totals = calculateTotals(lineItemsInput, taxRate);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(recurringInvoices)
        .where(eq(recurringInvoices.id, id));

      if (!existing) {
        throw Object.assign(
          new Error('Recurring invoice not found'),
          { status: 404 },
        );
      }

      // Delete old line items
      await tx.delete(recurringInvoiceLineItems)
        .where(eq(recurringInvoiceLineItems.recurringInvoiceId, id));

      // Insert new line items
      const lineItemRows = lineItemsInput.map(
        (item: { description: string; quantity: number; unitPrice: number }, idx: number) => ({
          recurringInvoiceId: id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.quantity * item.unitPrice),
          sortOrder: idx,
        }),
      );

      await tx.insert(recurringInvoiceLineItems).values(lineItemRows);

      const [updated] = await tx.update(recurringInvoices)
        .set({
          ...recurringData,
          taxRate: String(taxRate),
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          updatedAt: new Date(),
        })
        .where(eq(recurringInvoices.id, id))
        .returning();

      await tx.insert(activityLog).values({
        entityType: 'recurring_invoice',
        entityId: id,
        action: 'updated',
        description: `Recurring invoice updated`,
      });

      return updated;
    });

    const recurring = await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.json({ data: recurring });
  } catch (err: any) {
    if (err.status === 404) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// DELETE /:id - Delete recurring invoice
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const [deleted] = await db.delete(recurringInvoices)
      .where(eq(recurringInvoices.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Recurring invoice not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'recurring_invoice',
      entityId: deleted.id,
      action: 'deleted',
      description: `Recurring invoice deleted`,
    });

    res.json({ data: { message: 'Recurring invoice deleted' } });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/toggle - Toggle isActive
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const [existing] = await db.select().from(recurringInvoices)
      .where(eq(recurringInvoices.id, id));

    if (!existing) {
      res.status(404).json({ error: 'Recurring invoice not found' });
      return;
    }

    const [updated] = await db.update(recurringInvoices)
      .set({
        isActive: !existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(recurringInvoices.id, id))
      .returning();

    const activeStatus = updated.isActive ? 'activated' : 'deactivated';
    await db.insert(activityLog).values({
      entityType: 'recurring_invoice',
      entityId: id,
      action: activeStatus,
      description: `Recurring invoice ${activeStatus}`,
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
