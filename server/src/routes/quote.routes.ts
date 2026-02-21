import { Router } from 'express';
import { eq, desc, and, or, ilike, count, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  quotes,
  quoteLineItems,
  invoices,
  invoiceLineItems,
  clients,
  settings,
  activityLog,
  emailLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createQuoteSchema, updateQuoteSchema } from '@vibe/shared';
import { generateQuotePdf } from '../services/pdf.service.js';
import { sendQuoteEmail } from '../services/email.service.js';
import { parseId } from '../utils/parse-id.js';

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

// Helper: generate quote number from settings (atomic increment)
async function generateQuoteNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const [settingsRow] = await tx
    .update(settings)
    .set({ nextQuoteNumber: sql`${settings.nextQuoteNumber} + 1` })
    .returning();

  if (!settingsRow) {
    throw new Error('Settings not found. Please configure settings first.');
  }

  const prefix = settingsRow.quotePrefix;
  const currentNum = settingsRow.nextQuoteNumber - 1;
  return `${prefix}-${String(currentNum).padStart(4, '0')}`;
}

// Helper: generate invoice number from settings (for conversion, atomic)
async function generateInvoiceNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  isTaxable: boolean,
) {
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

// GET / - List quotes with filters and pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      clientId,
      search,
      page = '1',
      pageSize = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, Math.min(100, parseInt(pageSize as string, 10) || 20));
    const offset = (pageNum - 1) * size;

    const conditions = [];

    if (status && typeof status === 'string') {
      conditions.push(eq(quotes.status, status));
    }

    if (clientId && typeof clientId === 'string') {
      conditions.push(eq(quotes.clientId, parseInt(clientId, 10)));
    }

    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(quotes.quoteNumber, pattern),
          ilike(clients.name, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const [totalResult] = await db
      .select({ value: count() })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(whereClause);

    const total = totalResult?.value ?? 0;

    const rows = await db
      .select({
        quote: quotes,
        client: clients,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(quotes.createdAt))
      .limit(size)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row.quote,
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

// GET /:id - Get single quote with line items and client
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: {
        client: true,
        lineItems: true,
      },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    res.json({ data: quote });
  } catch (err) {
    next(err);
  }
});

// POST / - Create quote with line items
router.post('/', validate(createQuoteSchema), async (req, res, next) => {
  try {
    const {
      lineItems: lineItemsInput,
      taxRate = 0,
      discountAmount = 0,
      ...quoteData
    } = req.body;

    const totals = calculateTotals(lineItemsInput, taxRate, discountAmount);

    const result = await db.transaction(async (tx) => {
      const quoteNumber = await generateQuoteNumber(tx);

      const [quote] = await tx.insert(quotes).values({
        ...quoteData,
        quoteNumber,
        taxRate: String(taxRate),
        discountAmount: String(discountAmount),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        status: 'draft',
      }).returning();

      const lineItemRows = lineItemsInput.map(
        (item: { description: string; quantity: number; unitPrice: number }, idx: number) => ({
          quoteId: quote.id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.quantity * item.unitPrice),
          sortOrder: idx,
        }),
      );

      await tx.insert(quoteLineItems).values(lineItemRows);

      await tx.insert(activityLog).values({
        entityType: 'quote',
        entityId: quote.id,
        action: 'created',
        description: `Quote ${quote.quoteNumber} created`,
      });

      return quote;
    });

    const created = await db.query.quotes.findFirst({
      where: eq(quotes.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update quote and replace line items
router.put('/:id', validate(updateQuoteSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const {
      lineItems: lineItemsInput,
      taxRate,
      discountAmount,
      ...quoteData
    } = req.body;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(quotes)
        .where(eq(quotes.id, id));

      if (!existing) {
        throw Object.assign(new Error('Quote not found'), { status: 404 });
      }

      const effectiveTaxRate = taxRate ?? parseFloat(existing.taxRate);
      const effectiveDiscount = discountAmount ?? parseFloat(existing.discountAmount);

      let updatePayload: Record<string, unknown> = {
        ...quoteData,
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

        await tx.delete(quoteLineItems)
          .where(eq(quoteLineItems.quoteId, id));

        const lineItemRows = lineItemsInput.map(
          (item: { description: string; quantity: number; unitPrice: number }, idx: number) => ({
            quoteId: id,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            amount: String(item.quantity * item.unitPrice),
            sortOrder: idx,
          }),
        );

        await tx.insert(quoteLineItems).values(lineItemRows);
      }

      const [updated] = await tx.update(quotes)
        .set(updatePayload)
        .where(eq(quotes.id, id))
        .returning();

      await tx.insert(activityLog).values({
        entityType: 'quote',
        entityId: id,
        action: 'updated',
        description: `Quote ${updated.quoteNumber} updated`,
      });

      return updated;
    });

    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.json({ data: quote });
  } catch (err: any) {
    if (err.status === 404) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// DELETE /:id - Delete quote
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [deleted] = await db.delete(quotes)
      .where(eq(quotes.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'quote',
      entityId: deleted.id,
      action: 'deleted',
      description: `Quote ${deleted.quoteNumber} deleted`,
    });

    res.json({ data: { message: 'Quote deleted' } });
  } catch (err) {
    next(err);
  }
});

// GET /:id/pdf - Download quote as PDF
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: { client: true, lineItems: true },
    });

    if (!quote || !quote.client) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const [settingsRow] = await db.select().from(settings).limit(1);

    const pdfBuffer = await generateQuotePdf({
      quote,
      lineItems: quote.lineItems,
      client: quote.client,
      settings: settingsRow || {},
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quote.quoteNumber}.pdf"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// POST /:id/send - Send quote via email
router.post('/:id/send', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const { subject, body } = req.body;

    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: { client: true, lineItems: true },
    });

    if (!quote || !quote.client) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    if (!quote.client.email) {
      res.status(400).json({ error: 'Client has no email address' });
      return;
    }

    const [settingsRow] = await db.select().from(settings).limit(1);

    // Generate PDF
    const pdfBuffer = await generateQuotePdf({
      quote,
      lineItems: quote.lineItems,
      client: quote.client,
      settings: settingsRow || {},
    });

    // Send email
    const emailResult = await sendQuoteEmail({
      to: quote.client.email,
      subject: subject || `Quote ${quote.quoteNumber}`,
      body: body || `Please find your quote ${quote.quoteNumber} attached.`,
      pdfBuffer,
      quoteNumber: quote.quoteNumber,
      businessName: settingsRow?.businessName || 'Our Company',
      clientName: quote.client.name,
      total: quote.total,
      currency: quote.currency,
      expiryDate: quote.expiryDate,
    });

    // Update quote status to sent
    await db.update(quotes)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, id));

    // Log email
    await db.insert(emailLog).values({
      quoteId: id,
      recipientEmail: quote.client.email,
      subject: subject || `Quote ${quote.quoteNumber}`,
      status: 'sent',
      resendId: emailResult.id,
    });

    // Log activity
    await db.insert(activityLog).values({
      entityType: 'quote',
      entityId: id,
      action: 'sent',
      description: `Quote ${quote.quoteNumber} sent to ${quote.client.email}`,
    });

    res.json({ data: { message: 'Quote sent successfully', emailId: emailResult.id } });
  } catch (err) {
    next(err);
  }
});

// POST /:id/convert - Convert quote to invoice
router.post('/:id/convert', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: { lineItems: true },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    if (quote.status === 'converted') {
      res.status(400).json({ error: 'Quote has already been converted' });
      return;
    }

    const isTaxable = req.body?.isTaxable === true;
    const taxRate = isTaxable ? 16 : 0;

    // Recalculate totals with the chosen tax rate
    const quoteLineItemsList = quote.lineItems || [];
    const subtotal = quoteLineItemsList.reduce(
      (sum, item) => sum + parseFloat(item.quantity) * parseFloat(item.unitPrice),
      0,
    );
    const discountAmt = parseFloat(quote.discountAmount);
    const taxAmount = (subtotal - discountAmt) * (taxRate / 100);
    const total = subtotal - discountAmt + taxAmount;

    const result = await db.transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(tx, isTaxable);

      // Get settings for default payment terms
      const [settingsRow] = await tx.select().from(settings).limit(1);
      const paymentTerms = settingsRow?.defaultPaymentTerms ?? 30;

      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      const [invoice] = await tx.insert(invoices).values({
        invoiceNumber,
        clientId: quote.clientId,
        status: 'draft',
        isTaxable,
        issueDate: today.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        currency: quote.currency,
        subtotal: subtotal.toFixed(2),
        taxRate: String(taxRate),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: quote.discountAmount,
        total: total.toFixed(2),
        notes: quote.notes,
        terms: quote.terms,
      }).returning();

      // Copy line items
      if (quote.lineItems && quote.lineItems.length > 0) {
        const lineItemRows = quote.lineItems.map((item, idx) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          sortOrder: idx,
        }));

        await tx.insert(invoiceLineItems).values(lineItemRows);
      }

      // Update quote status to converted
      await tx.update(quotes)
        .set({
          status: 'converted',
          convertedInvoiceId: invoice.id,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, id));

      await tx.insert(activityLog).values({
        entityType: 'quote',
        entityId: id,
        action: 'converted',
        description: `Quote ${quote.quoteNumber} converted to invoice ${invoiceNumber}`,
      });

      await tx.insert(activityLog).values({
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'created',
        description: `Invoice ${invoiceNumber} created from quote ${quote.quoteNumber}`,
      });

      return invoice;
    });

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });

    res.status(201).json({ data: invoice });
  } catch (err) {
    next(err);
  }
});

export default router;
