import { Router } from 'express';
import { eq, desc, and, or, ilike, sql, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  invoices,
  invoiceLineItems,
  clients,
  settings,
  activityLog,
  emailLog,
  emailTemplates,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
} from '@vibe/shared';
import { generateInvoicePdf } from '../services/pdf.service.js';
import { sendInvoiceEmail, sendPaymentReminder } from '../services/email.service.js';
import { parseId } from '../utils/parse-id.js';
import { replaceTemplateVariables, sanitizeHeaderColor } from '../utils/template-renderer.js';
import { EMAIL_TEMPLATE_DEFAULTS } from './email-template.routes.js';
import { env } from '../env.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Helper: calculate line item totals
function calculateTotals(
  lineItems: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  discountAmount: number,
) {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal - discountAmount + taxAmount;
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

// Helper: generate invoice number from settings (atomic increment)
async function generateInvoiceNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  isTaxable: boolean,
  isWriteOff = false,
) {
  if (isWriteOff) {
    const [settingsRow] = await tx
      .update(settings)
      .set({ nextWriteOffNumber: sql`${settings.nextWriteOffNumber} + 1` })
      .returning();
    if (!settingsRow) {
      throw new Error('Settings not found. Please configure settings first.');
    }
    const num = settingsRow.nextWriteOffNumber - 1;
    return `${settingsRow.writeOffPrefix}-${String(num).padStart(4, '0')}`;
  }

  const updateCol = isTaxable
    ? { nextInvoiceNumber: sql`${settings.nextInvoiceNumber} + 1` }
    : { nextExemptInvoiceNumber: sql`${settings.nextExemptInvoiceNumber} + 1` };

  const [settingsRow] = await tx
    .update(settings)
    .set(updateCol)
    .returning();

  if (!settingsRow) {
    throw new Error('Settings not found. Please configure settings first.');
  }

  const prefix = isTaxable
    ? settingsRow.invoicePrefix
    : settingsRow.exemptInvoicePrefix;
  const currentNum = isTaxable
    ? settingsRow.nextInvoiceNumber - 1
    : settingsRow.nextExemptInvoiceNumber - 1;

  return `${prefix}-${String(currentNum).padStart(4, '0')}`;
}

// GET / - List invoices with filters and pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      clientId,
      search,
      isTaxable,
      page = '1',
      pageSize = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, Math.min(100, parseInt(pageSize as string, 10) || 20));
    const offset = (pageNum - 1) * size;

    const conditions = [];

    if (status && typeof status === 'string') {
      conditions.push(eq(invoices.status, status));
    } else {
      // Exclude written_off from default "all" list
      conditions.push(sql`${invoices.status} != 'written_off'`);
    }

    if (clientId && typeof clientId === 'string') {
      conditions.push(eq(invoices.clientId, parseInt(clientId, 10)));
    }

    if (isTaxable === 'true') {
      conditions.push(eq(invoices.isTaxable, true));
    } else if (isTaxable === 'false') {
      conditions.push(eq(invoices.isTaxable, false));
    }

    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, pattern),
          ilike(clients.name, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    // Count total
    const [totalResult] = await db
      .select({ value: count() })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(whereClause);

    const total = totalResult?.value ?? 0;

    // Fetch paginated results
    const rows = await db
      .select({
        invoice: invoices,
        client: clients,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(size)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row.invoice,
      client: row.client,
    }));

    res.json({
      data,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single invoice with line items and client
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
        client: true,
        lineItems: true,
        payments: true,
      },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json({ data: invoice });
  } catch (err) {
    next(err);
  }
});

// POST / - Create invoice with line items
router.post('/', validate(createInvoiceSchema), async (req, res, next) => {
  try {
    const {
      lineItems: lineItemsInput,
      taxRate: userTaxRate,
      discountAmount = 0,
      isTaxable = false,
      isWriteOff = false,
      ...invoiceData
    } = req.body;

    const result = await db.transaction(async (tx) => {
      // Resolve tax rate: use user-supplied rate, or fall back to settings default
      let taxRate = 0;
      if (isTaxable) {
        if (userTaxRate !== undefined && userTaxRate !== null) {
          taxRate = Number(userTaxRate);
        } else {
          const [settingsRow] = await tx.select({ defaultTaxRate: settings.defaultTaxRate }).from(settings).limit(1);
          taxRate = settingsRow ? parseFloat(settingsRow.defaultTaxRate) : 0;
        }
      }

      const totals = calculateTotals(lineItemsInput, taxRate, discountAmount);
      const invoiceNumber = await generateInvoiceNumber(
        tx, isTaxable, isWriteOff,
      );

      const [invoice] = await tx.insert(invoices).values({
        ...invoiceData,
        invoiceNumber,
        isTaxable,
        taxRate: String(taxRate),
        discountAmount: String(discountAmount),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        status: isWriteOff ? 'written_off' : 'draft',
        amountPaid: isWriteOff ? '0' : undefined,
      }).returning();

      const lineItemRows = lineItemsInput.map(
        (item: { description: string; quantity: number; unitPrice: number }, idx: number) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.quantity * item.unitPrice),
          sortOrder: idx,
        }),
      );

      await tx.insert(invoiceLineItems).values(lineItemRows);

      await tx.insert(activityLog).values({
        entityType: 'invoice',
        entityId: invoice.id,
        action: isWriteOff ? 'written_off' : 'created',
        description: isWriteOff
          ? `Write-off invoice ${invoice.invoiceNumber} created`
          : `Invoice ${invoice.invoiceNumber} created`,
        userId: (req as AuthRequest).userId,
      });

      return invoice;
    });

    const created = await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update invoice and replace line items
router.put('/:id', validate(updateInvoiceSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const {
      lineItems: lineItemsInput,
      taxRate,
      discountAmount,
      ...invoiceData
    } = req.body;

    const result = await db.transaction(async (tx) => {
      // Fetch existing invoice for default values
      const [existing] = await tx.select().from(invoices)
        .where(eq(invoices.id, id));

      if (!existing) {
        throw Object.assign(new Error('Invoice not found'), { status: 404 });
      }

      if (existing.status === 'written_off') {
        throw Object.assign(
          new Error('Cannot edit a written-off invoice'),
          { status: 400 },
        );
      }

      const effectiveTaxRate = taxRate ?? parseFloat(existing.taxRate);
      const effectiveDiscount = discountAmount ?? parseFloat(existing.discountAmount);

      let updatePayload: Record<string, unknown> = {
        ...invoiceData,
        updatedAt: new Date(),
      };

      if (taxRate !== undefined) {
        updatePayload.taxRate = String(taxRate);
      }
      if (discountAmount !== undefined) {
        updatePayload.discountAmount = String(discountAmount);
      }

      if (lineItemsInput && lineItemsInput.length > 0) {
        const totals = calculateTotals(
          lineItemsInput,
          effectiveTaxRate,
          effectiveDiscount,
        );
        updatePayload = {
          ...updatePayload,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
        };

        // Delete old line items and insert new ones
        await tx.delete(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, id));

        const lineItemRows = lineItemsInput.map(
          (item: { description: string; quantity: number; unitPrice: number }, idx: number) => ({
            invoiceId: id,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            amount: String(item.quantity * item.unitPrice),
            sortOrder: idx,
          }),
        );

        await tx.insert(invoiceLineItems).values(lineItemRows);
      }

      const [updated] = await tx.update(invoices)
        .set(updatePayload)
        .where(eq(invoices.id, id))
        .returning();

      await tx.insert(activityLog).values({
        entityType: 'invoice',
        entityId: id,
        action: 'updated',
        description: `Invoice ${updated.invoiceNumber} updated`,
        userId: (req as AuthRequest).userId,
      });

      return updated;
    });

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.json({ data: invoice });
  } catch (err: any) {
    if (err.status === 404 || err.status === 400) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// DELETE /:id - Delete invoice
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [deleted] = await db.delete(invoices)
      .where(eq(invoices.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'invoice',
      entityId: deleted.id,
      action: 'deleted',
      description: `Invoice ${deleted.invoiceNumber} deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Invoice deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /:id/duplicate - Duplicate invoice with new number
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const original = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: { lineItems: true },
    });

    if (!original) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(
        tx, original.isTaxable,
      );

      // Calculate a fresh due date based on settings
      const [settingsRow] = await tx.select({ defaultPaymentTerms: settings.defaultPaymentTerms }).from(settings).limit(1);
      const paymentTerms = settingsRow?.defaultPaymentTerms ?? 30;
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      const [duplicate] = await tx.insert(invoices).values({
        invoiceNumber,
        clientId: original.clientId,
        status: 'draft',
        isTaxable: original.isTaxable,
        issueDate: today.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        currency: original.currency,
        subtotal: original.subtotal,
        taxRate: original.taxRate,
        taxAmount: original.taxAmount,
        discountAmount: original.discountAmount,
        total: original.total,
        notes: original.notes,
        terms: original.terms,
      }).returning();

      if (original.lineItems && original.lineItems.length > 0) {
        const lineItemRows = original.lineItems.map((item, idx) => ({
          invoiceId: duplicate.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          sortOrder: idx,
        }));

        await tx.insert(invoiceLineItems).values(lineItemRows);
      }

      await tx.insert(activityLog).values({
        entityType: 'invoice',
        entityId: duplicate.id,
        action: 'duplicated',
        description: `Invoice ${duplicate.invoiceNumber} duplicated from ${original.invoiceNumber}`,
        userId: (req as AuthRequest).userId,
      });

      return duplicate;
    });

    const created = await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/status - Update invoice status only
router.patch(
  '/:id/status',
  validate(updateInvoiceStatusSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const { status } = req.body;

      // Block status changes on written-off invoices
      const [existing] = await db.select({ status: invoices.status })
        .from(invoices).where(eq(invoices.id, id));
      if (existing?.status === 'written_off') {
        res.status(400).json({
          error: 'Cannot change status of a written-off invoice',
        });
        return;
      }

      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'sent') {
        updateData.sentAt = new Date();
      }
      if (status === 'paid') {
        updateData.paidAt = new Date();
      }

      const [updated] = await db.update(invoices)
        .set(updateData)
        .where(eq(invoices.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      await db.insert(activityLog).values({
        entityType: 'invoice',
        entityId: id,
        action: 'status_changed',
        description: `Invoice ${updated.invoiceNumber} status changed to "${status}"`,
        userId: (req as AuthRequest).userId,
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id/pdf - Download invoice as PDF
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: { client: true, lineItems: true },
    });

    if (!invoice || !invoice.client) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const [settingsRow] = await db.select().from(settings).limit(1);

    const pdfBuffer = await generateInvoicePdf({
      invoice,
      lineItems: invoice.lineItems,
      client: invoice.client,
      settings: settingsRow || {},
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// POST /:id/send - Send invoice via email
router.post('/:id/send', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const { subject: userSubject, body: userBody } = req.body;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: { client: true, lineItems: true },
    });

    if (!invoice || !invoice.client) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (!invoice.client.email) {
      res.status(400).json({ error: 'Client has no email address' });
      return;
    }

    const [settingsRow] = await db.select().from(settings).limit(1);
    const businessName = settingsRow?.businessName || 'Our Company';

    // Fetch email template
    const template = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.type, 'invoice'),
    });
    const defaults = EMAIL_TEMPLATE_DEFAULTS.invoice;
    const tplVars: Record<string, string> = {
      invoiceNumber: invoice.invoiceNumber,
      businessName,
      clientName: invoice.client.name,
      total: `${invoice.total} ${invoice.currency}`,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
    };

    const finalSubject = userSubject
      || replaceTemplateVariables(template?.subject || defaults.subject, tplVars);
    const finalBody = userBody
      || replaceTemplateVariables(template?.body || defaults.body, tplVars);
    const headerColor = sanitizeHeaderColor(template?.headerColor, defaults.headerColor);

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf({
      invoice,
      lineItems: invoice.lineItems,
      client: invoice.client,
      settings: settingsRow || {},
    });

    // Insert emailLog first (pending) to get the ID for tracking
    const [logEntry] = await db.insert(emailLog).values({
      invoiceId: id,
      recipientEmail: invoice.client.email,
      subject: finalSubject,
      status: 'pending',
    }).returning();

    const trackingPixelUrl = `${env.SERVER_BASE_URL}/api/tracking/open/${logEntry.id}`;

    // Send email with template + tracking
    let emailResult: { id: string };
    try {
      emailResult = await sendInvoiceEmail({
        to: invoice.client.email,
        subject: finalSubject,
        body: finalBody,
        pdfBuffer,
        invoiceNumber: invoice.invoiceNumber,
        businessName,
        clientName: invoice.client.name,
        total: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        headerColor,
        trackingPixelUrl,
        emailLogId: logEntry.id,
      });
    } catch (sendErr) {
      await db.update(emailLog)
        .set({ status: 'failed' })
        .where(eq(emailLog.id, logEntry.id));
      throw sendErr;
    }

    // Update emailLog to sent
    await db.update(emailLog)
      .set({ status: 'sent', resendId: emailResult.id })
      .where(eq(emailLog.id, logEntry.id));

    // Update invoice status to sent
    await db.update(invoices)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, id));

    // Log activity
    await db.insert(activityLog).values({
      entityType: 'invoice',
      entityId: id,
      action: 'sent',
      description: `Invoice ${invoice.invoiceNumber} sent to ${invoice.client.email}`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Invoice sent successfully', emailId: emailResult.id } });
  } catch (err) {
    next(err);
  }
});

// POST /:id/remind - Send payment reminder email
router.post('/:id/remind', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const { subject: userSubject, body: userBody } = req.body;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: { client: true },
    });

    if (!invoice || !invoice.client) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (!invoice.client.email) {
      res.status(400).json({ error: 'Client has no email address' });
      return;
    }

    const [settingsRow] = await db.select().from(settings).limit(1);
    const businessName = settingsRow?.businessName || 'Our Company';

    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.max(
      0,
      Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Fetch email template
    const template = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.type, 'reminder'),
    });
    const defaults = EMAIL_TEMPLATE_DEFAULTS.reminder;
    const tplVars: Record<string, string> = {
      invoiceNumber: invoice.invoiceNumber,
      businessName,
      clientName: invoice.client.name,
      total: `${invoice.total} ${invoice.currency}`,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      daysOverdue: String(daysOverdue),
    };

    const finalSubject = userSubject
      || replaceTemplateVariables(template?.subject || defaults.subject, tplVars);
    const finalBody = userBody
      || replaceTemplateVariables(template?.body || defaults.body, tplVars);
    const headerColor = sanitizeHeaderColor(template?.headerColor, defaults.headerColor);

    // Insert emailLog first (pending) for tracking
    const [logEntry] = await db.insert(emailLog).values({
      invoiceId: id,
      recipientEmail: invoice.client.email,
      subject: finalSubject,
      status: 'pending',
    }).returning();

    const trackingPixelUrl = `${env.SERVER_BASE_URL}/api/tracking/open/${logEntry.id}`;

    let emailResult: { id: string };
    try {
      emailResult = await sendPaymentReminder({
        to: invoice.client.email,
        subject: finalSubject,
        body: finalBody,
        businessName,
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        dueDate: invoice.dueDate,
        daysOverdue,
        headerColor,
        trackingPixelUrl,
        emailLogId: logEntry.id,
      });
    } catch (sendErr) {
      await db.update(emailLog)
        .set({ status: 'failed' })
        .where(eq(emailLog.id, logEntry.id));
      throw sendErr;
    }

    // Update emailLog to sent
    await db.update(emailLog)
      .set({ status: 'sent', resendId: emailResult.id })
      .where(eq(emailLog.id, logEntry.id));

    // Log activity
    await db.insert(activityLog).values({
      entityType: 'invoice',
      entityId: id,
      action: 'reminder_sent',
      description: `Payment reminder sent for ${invoice.invoiceNumber} to ${invoice.client.email}`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Reminder sent successfully', emailId: emailResult.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
