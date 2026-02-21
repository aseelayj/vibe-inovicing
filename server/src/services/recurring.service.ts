import cron from 'node-cron';
import { db } from '../db/index.js';
import {
  recurringInvoices,
  recurringInvoiceLineItems,
  invoices,
  invoiceLineItems,
  settings,
  activityLog,
} from '../db/schema.js';
import { eq, and, lte, sql } from 'drizzle-orm';

function addToDate(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

async function processRecurringInvoices() {
  const today = new Date().toISOString().split('T')[0];

  const dueRecurrings = await db
    .select()
    .from(recurringInvoices)
    .where(
      and(
        eq(recurringInvoices.isActive, true),
        lte(recurringInvoices.nextRunDate, today),
      ),
    );

  for (const recurring of dueRecurrings) {
    try {
      await db.transaction(async (tx) => {
        // Get settings for invoice number
        const [currentSettings] = await tx
          .select()
          .from(settings)
          .limit(1);

        const invoiceNumber = `${currentSettings.invoicePrefix}-${
          String(currentSettings.nextInvoiceNumber).padStart(4, '0')
        }`;

        // Get line items
        const items = await tx
          .select()
          .from(recurringInvoiceLineItems)
          .where(
            eq(recurringInvoiceLineItems.recurringInvoiceId, recurring.id),
          );

        // Calculate due date (30 days from today by default)
        const dueDate = new Date();
        dueDate.setDate(
          dueDate.getDate() + (currentSettings.defaultPaymentTerms || 30),
        );

        // Create invoice
        const [newInvoice] = await tx
          .insert(invoices)
          .values({
            invoiceNumber,
            clientId: recurring.clientId,
            status: 'draft',
            issueDate: today,
            dueDate: dueDate.toISOString().split('T')[0],
            currency: recurring.currency,
            subtotal: recurring.subtotal,
            taxRate: recurring.taxRate,
            taxAmount: recurring.taxAmount,
            total: recurring.total,
            notes: recurring.notes,
            terms: recurring.terms,
            isRecurring: true,
            recurringId: recurring.id,
          })
          .returning();

        // Create line items
        if (items.length > 0) {
          await tx.insert(invoiceLineItems).values(
            items.map((item) => ({
              invoiceId: newInvoice.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
              sortOrder: item.sortOrder,
            })),
          );
        }

        // Update settings counter
        await tx
          .update(settings)
          .set({
            nextInvoiceNumber: currentSettings.nextInvoiceNumber + 1,
          })
          .where(eq(settings.id, currentSettings.id));

        // Calculate next run date
        const nextRun = addToDate(
          new Date(recurring.nextRunDate),
          recurring.frequency,
        );

        const updates: Record<string, any> = {
          lastRunDate: today,
          nextRunDate: nextRun.toISOString().split('T')[0],
          updatedAt: new Date(),
        };

        // Deactivate if past end date
        if (
          recurring.endDate
          && nextRun > new Date(recurring.endDate)
        ) {
          updates.isActive = false;
        }

        await tx
          .update(recurringInvoices)
          .set(updates)
          .where(eq(recurringInvoices.id, recurring.id));

        // Log activity
        await tx.insert(activityLog).values({
          entityType: 'invoice',
          entityId: newInvoice.id,
          action: 'created',
          description:
            `Auto-generated from recurring invoice #${recurring.id}`,
        });

        console.log(
          `[Recurring] Created invoice ${invoiceNumber} from recurring #${recurring.id}`,
        );
      });
    } catch (err) {
      console.error(
        `[Recurring] Failed to process recurring #${recurring.id}:`,
        err,
      );
    }
  }
}

export function startRecurringScheduler() {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[Recurring] Running scheduled check...');
    await processRecurringInvoices();
  });

  console.log('[Recurring] Scheduler started (daily at 8:00 AM)');
}

export { processRecurringInvoices };
