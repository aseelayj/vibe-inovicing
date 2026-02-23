import cron from 'node-cron';
import { db } from '../db/index.js';
import {
  recurringInvoices,
  recurringInvoiceLineItems,
  invoices,
  invoiceLineItems,
  clients,
  settings,
  activityLog,
  emailLog,
  emailTemplates,
} from '../db/schema.js';
import { eq, and, lte, sql } from 'drizzle-orm';
import { generateInvoicePdf } from './pdf.service.js';
import { sendInvoiceEmail } from './email.service.js';
import { replaceTemplateVariables, sanitizeHeaderColor } from '../utils/template-renderer.js';
import { EMAIL_TEMPLATE_DEFAULTS } from '../routes/email-template.routes.js';
import { env } from '../env.js';

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
      // Skip if past end date (prevents off-by-one invoice creation)
      if (
        recurring.endDate
        && new Date(recurring.nextRunDate) > new Date(recurring.endDate)
      ) {
        await db
          .update(recurringInvoices)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(recurringInvoices.id, recurring.id));
        continue;
      }

      await db.transaction(async (tx) => {
        const isTaxable = recurring.isTaxable;

        // Atomic increment on the correct sequence
        const updateCol = isTaxable
          ? { nextInvoiceNumber: sql`${settings.nextInvoiceNumber} + 1` }
          : { nextExemptInvoiceNumber: sql`${settings.nextExemptInvoiceNumber} + 1` };

        const [currentSettings] = await tx
          .update(settings)
          .set(updateCol)
          .returning();

        const prefix = isTaxable
          ? currentSettings.invoicePrefix
          : currentSettings.exemptInvoicePrefix;
        const currentNum = isTaxable
          ? currentSettings.nextInvoiceNumber - 1
          : currentSettings.nextExemptInvoiceNumber - 1;
        const invoiceNumber = `${prefix}-${
          String(currentNum).padStart(4, '0')
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

        // Use the recurring invoice's own tax rate, fall back to settings default
        let taxRate = 0;
        if (isTaxable) {
          const storedRate = parseFloat(recurring.taxRate);
          taxRate = storedRate > 0 ? storedRate : parseFloat(currentSettings.defaultTaxRate);
        }
        const subtotalNum = parseFloat(recurring.subtotal);
        const taxAmountNum = subtotalNum * (taxRate / 100);
        const totalNum = subtotalNum + taxAmountNum;

        // Create invoice
        const [newInvoice] = await tx
          .insert(invoices)
          .values({
            invoiceNumber,
            clientId: recurring.clientId,
            status: 'draft',
            isTaxable,
            issueDate: today,
            dueDate: dueDate.toISOString().split('T')[0],
            currency: recurring.currency,
            subtotal: recurring.subtotal,
            taxRate: String(taxRate),
            taxAmount: taxAmountNum.toFixed(2),
            total: totalNum.toFixed(2),
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

      // Auto-send the invoice if autoSend is enabled (outside transaction for email)
      if (recurring.autoSend) {
        try {
          // Fetch the latest invoice created from this recurring
          const latestInvoice = await db
            .select({
              invoice: invoices,
              client: clients,
            })
            .from(invoices)
            .leftJoin(clients, eq(invoices.clientId, clients.id))
            .where(
              and(
                eq(invoices.recurringId, recurring.id),
                eq(invoices.issueDate, today),
              ),
            )
            .limit(1)
            .then((rows) => rows[0]);

          if (latestInvoice?.client?.email) {
            const inv = latestInvoice.invoice;
            const client = latestInvoice.client;

            const [currentSettings] = await db.select().from(settings).limit(1);
            const businessName = currentSettings?.businessName || 'Our Company';

            const template = await db.query.emailTemplates?.findFirst({
              where: eq(emailTemplates.type, 'invoice'),
            });
            const defaults = EMAIL_TEMPLATE_DEFAULTS.invoice;
            const tplVars: Record<string, string> = {
              invoiceNumber: inv.invoiceNumber,
              businessName,
              clientName: client.name,
              total: `${inv.total} ${inv.currency}`,
              currency: inv.currency,
              dueDate: inv.dueDate,
            };

            const finalSubject = replaceTemplateVariables(
              template?.subject || defaults.subject,
              tplVars,
            );
            const finalBody = replaceTemplateVariables(
              template?.body || defaults.body,
              tplVars,
            );
            const headerColor = sanitizeHeaderColor(
              template?.headerColor,
              defaults.headerColor,
            );

            const invoiceWithItems = await db.query.invoices.findFirst({
              where: eq(invoices.id, inv.id),
              with: { client: true, lineItems: true },
            });

            const pdfBuffer = await generateInvoicePdf({
              invoice: invoiceWithItems!,
              lineItems: invoiceWithItems!.lineItems,
              client,
              settings: currentSettings || {},
            });

            const [logEntry] = await db.insert(emailLog).values({
              invoiceId: inv.id,
              recipientEmail: client.email!,
              subject: finalSubject,
              status: 'pending',
            }).returning();

            const trackingPixelUrl = `${env.SERVER_BASE_URL}/api/tracking/open/${logEntry.id}`;

            const emailResult = await sendInvoiceEmail({
              to: client.email!,
              subject: finalSubject,
              body: finalBody,
              pdfBuffer,
              invoiceNumber: inv.invoiceNumber,
              businessName,
              clientName: client.name,
              total: inv.total,
              currency: inv.currency,
              dueDate: inv.dueDate,
              headerColor,
              trackingPixelUrl,
              emailLogId: logEntry.id,
            });

            await db.update(emailLog)
              .set({ status: 'sent', resendId: emailResult.id })
              .where(eq(emailLog.id, logEntry.id));

            await db.update(invoices)
              .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
              .where(eq(invoices.id, inv.id));

            await db.insert(activityLog).values({
              entityType: 'invoice',
              entityId: inv.id,
              action: 'sent',
              description: `Auto-sent invoice ${inv.invoiceNumber} to ${client.email}`,
            });

            console.log(
              `[Recurring] Auto-sent invoice ${inv.invoiceNumber} to ${client.email}`,
            );
          }
        } catch (sendErr) {
          console.error(
            `[Recurring] Invoice created but auto-send failed for recurring #${recurring.id}:`,
            sendErr,
          );
        }
      }
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
