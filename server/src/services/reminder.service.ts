import cron from 'node-cron';
import { db } from '../db/index.js';
import { invoices, quotes, clients, settings, emailLog, emailTemplates, activityLog } from '../db/schema.js';
import { eq, and, sql, or, lte } from 'drizzle-orm';
import { sendPaymentReminder } from './email.service.js';
import { replaceTemplateVariables, sanitizeHeaderColor } from '../utils/template-renderer.js';
import { EMAIL_TEMPLATE_DEFAULTS } from '../routes/email-template.routes.js';
import { env } from '../env.js';

async function processAutoReminders() {
  const [settingsRow] = await db.select().from(settings).limit(1);
  if (!settingsRow?.autoRemindersEnabled) return;

  const reminderDays: number[] = (settingsRow.reminderDaysAfterDue as number[]) || [3, 7, 14, 30];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const businessName = settingsRow.businessName || 'Our Company';

  // Get all overdue invoices (sent or partially_paid, past due date)
  const overdueInvoices = await db
    .select({
      invoice: invoices,
      client: clients,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        or(
          eq(invoices.status, 'sent'),
          eq(invoices.status, 'partially_paid'),
          eq(invoices.status, 'overdue'),
        ),
        lte(invoices.dueDate, todayStr),
      ),
    );

  // Also auto-update status to overdue if past due date
  await db
    .update(invoices)
    .set({ status: 'overdue', updatedAt: new Date() })
    .where(
      and(
        eq(invoices.status, 'sent'),
        lte(invoices.dueDate, todayStr),
      ),
    );

  const template = await db.query.emailTemplates?.findFirst({
    where: eq(emailTemplates.type, 'reminder'),
  });
  const defaults = EMAIL_TEMPLATE_DEFAULTS.reminder;

  for (const row of overdueInvoices) {
    const inv = row.invoice;
    const client = row.client;
    if (!client?.email) continue;

    const dueDate = new Date(inv.dueDate);
    const daysOverdue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Check if today matches one of the reminder days
    if (!reminderDays.includes(daysOverdue)) continue;

    // Check if we already sent a reminder today for this invoice
    const existingReminder = await db
      .select()
      .from(emailLog)
      .where(
        and(
          eq(emailLog.invoiceId, inv.id),
          sql`DATE(${emailLog.sentAt}) = ${todayStr}`,
          eq(emailLog.status, 'sent'),
        ),
      )
      .limit(1);

    if (existingReminder.length > 0) continue;

    try {
      const tplVars: Record<string, string> = {
        invoiceNumber: inv.invoiceNumber,
        businessName,
        clientName: client.name,
        total: `${inv.total} ${inv.currency}`,
        currency: inv.currency,
        dueDate: inv.dueDate,
        daysOverdue: String(daysOverdue),
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

      const [logEntry] = await db.insert(emailLog).values({
        invoiceId: inv.id,
        recipientEmail: client.email,
        subject: finalSubject,
        status: 'pending',
      }).returning();

      const trackingPixelUrl = `${env.SERVER_BASE_URL}/api/tracking/open/${logEntry.id}`;

      const emailResult = await sendPaymentReminder({
        to: client.email,
        subject: finalSubject,
        body: finalBody,
        businessName,
        clientName: client.name,
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        dueDate: inv.dueDate,
        daysOverdue,
        headerColor,
        trackingPixelUrl,
        emailLogId: logEntry.id,
      });

      await db.update(emailLog)
        .set({ status: 'sent', resendId: emailResult.id })
        .where(eq(emailLog.id, logEntry.id));

      await db.insert(activityLog).values({
        entityType: 'invoice',
        entityId: inv.id,
        action: 'auto_reminder_sent',
        description: `Auto-reminder sent for ${inv.invoiceNumber} (${daysOverdue} days overdue)`,
      });

      console.log(
        `[Reminder] Sent auto-reminder for ${inv.invoiceNumber} to ${client.email} (${daysOverdue} days overdue)`,
      );
    } catch (err) {
      console.error(
        `[Reminder] Failed to send reminder for ${inv.invoiceNumber}:`,
        err,
      );
    }
  }
}

async function processExpiredQuotes() {
  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-expire quotes that are past their expiry date and still in draft/sent status
  const result = await db
    .update(quotes)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(
        or(
          eq(quotes.status, 'draft'),
          eq(quotes.status, 'sent'),
        ),
        sql`${quotes.expiryDate} IS NOT NULL`,
        sql`${quotes.expiryDate} < ${todayStr}`,
      ),
    )
    .returning({ id: quotes.id, quoteNumber: quotes.quoteNumber });

  for (const q of result) {
    await db.insert(activityLog).values({
      entityType: 'quote',
      entityId: q.id,
      action: 'expired',
      description: `Quote ${q.quoteNumber} auto-expired (past expiry date)`,
    });
  }

  if (result.length > 0) {
    console.log(`[Reminder] Auto-expired ${result.length} quote(s)`);
  }
}

export function startReminderScheduler() {
  // Run daily at 9:00 AM (after recurring invoices at 8:00 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('[Reminder] Running auto-reminder check...');
    await processAutoReminders();
    await processExpiredQuotes();
  });

  console.log('[Reminder] Scheduler started (daily at 9:00 AM)');
}

export { processAutoReminders, processExpiredQuotes };
