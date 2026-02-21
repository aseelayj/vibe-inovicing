import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailTemplates, settings } from '../db/schema.js';
import {
  updateEmailTemplateSchema,
  sendTestEmailSchema,
  type EmailTemplateType,
} from '@vibe/shared';
import { replaceTemplateVariables, sanitizeHeaderColor } from '../utils/template-renderer.js';
import { renderInvoiceEmailHtml, renderReminderEmailHtml } from '../templates/invoice-email.js';
import { renderQuoteEmailHtml } from '../templates/quote-email.js';
import { sendEmail } from '../services/email.service.js';
import { env } from '../env.js';

const router = Router();

// Default template values
const DEFAULTS: Record<EmailTemplateType, {
  subject: string; body: string; headerColor: string;
}> = {
  invoice: {
    subject: 'Invoice {{invoiceNumber}} from {{businessName}}',
    body: 'Please find your invoice {{invoiceNumber}} attached.\nThe total amount of {{total}} is due by {{dueDate}}.',
    headerColor: '#2563eb',
  },
  quote: {
    subject: 'Quote {{quoteNumber}} from {{businessName}}',
    body: 'Please find your quote {{quoteNumber}} attached.\nThe total amount is {{total}}.',
    headerColor: '#7c3aed',
  },
  reminder: {
    subject: 'Payment Reminder: {{invoiceNumber}}',
    body: 'This is a friendly reminder about invoice {{invoiceNumber}}.\nThe amount of {{total}} was due on {{dueDate}}.',
    headerColor: '#dc2626',
  },
};

const VALID_TYPES = ['invoice', 'quote', 'reminder'] as const;

function isValidType(t: string): t is EmailTemplateType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

/** Ensure all 3 default templates exist (race-safe). */
async function ensureDefaults() {
  for (const type of VALID_TYPES) {
    await db.insert(emailTemplates).values({
      type,
      subject: DEFAULTS[type].subject,
      body: DEFAULTS[type].body,
      headerColor: DEFAULTS[type].headerColor,
      isCustomized: false,
    }).onConflictDoNothing({ target: emailTemplates.type });
  }
}

// GET / - List all email templates
router.get('/', async (_req, res, next) => {
  try {
    await ensureDefaults();
    const templates = await db.select().from(emailTemplates);
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
});

// GET /:type - Get single template
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!isValidType(type)) {
      res.status(400).json({ error: 'Invalid template type' });
      return;
    }
    await ensureDefaults();
    const template = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.type, type),
    });
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
});

// PUT /:type - Update template
router.put('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!isValidType(type)) {
      res.status(400).json({ error: 'Invalid template type' });
      return;
    }

    const parsed = updateEmailTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    await ensureDefaults();
    const [updated] = await db.update(emailTemplates)
      .set({
        subject: parsed.data.subject,
        body: parsed.data.body,
        headerColor: parsed.data.headerColor ?? undefined,
        isCustomized: true,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.type, type))
      .returning();

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /:type/reset - Reset to defaults
router.post('/:type/reset', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!isValidType(type)) {
      res.status(400).json({ error: 'Invalid template type' });
      return;
    }

    await ensureDefaults();
    const defaults = DEFAULTS[type];
    const [updated] = await db.update(emailTemplates)
      .set({
        subject: defaults.subject,
        body: defaults.body,
        headerColor: defaults.headerColor,
        isCustomized: false,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.type, type))
      .returning();

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// Sample data for preview
const SAMPLE_DATA: Record<string, string> = {
  invoiceNumber: 'INV-001',
  quoteNumber: 'QUO-001',
  businessName: 'Acme Corp',
  clientName: 'John Doe',
  total: '1,500.00 USD',
  currency: 'USD',
  dueDate: '2026-03-15',
  expiryDate: '2026-03-30',
  daysOverdue: '5',
};

// POST /:type/preview - Preview rendered HTML (accepts form data or falls back to DB)
router.post('/:type/preview', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!isValidType(type)) {
      res.status(400).json({ error: 'Invalid template type' });
      return;
    }

    // Use POSTed form data if present, otherwise fall back to DB
    let subject: string;
    let body: string;
    let color: string;

    if (req.body?.subject && req.body?.body) {
      subject = req.body.subject;
      body = req.body.body;
      color = sanitizeHeaderColor(req.body.headerColor, DEFAULTS[type].headerColor);
    } else {
      await ensureDefaults();
      const template = await db.query.emailTemplates.findFirst({
        where: eq(emailTemplates.type, type),
      });
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      subject = template.subject;
      body = template.body;
      color = sanitizeHeaderColor(template.headerColor, DEFAULTS[type].headerColor);
    }

    const renderedSubject = replaceTemplateVariables(subject, SAMPLE_DATA);
    const renderedBody = replaceTemplateVariables(body, SAMPLE_DATA);

    let html: string;
    if (type === 'invoice') {
      html = renderInvoiceEmailHtml({
        businessName: SAMPLE_DATA.businessName,
        clientName: SAMPLE_DATA.clientName,
        invoiceNumber: SAMPLE_DATA.invoiceNumber,
        total: SAMPLE_DATA.total,
        currency: SAMPLE_DATA.currency,
        dueDate: SAMPLE_DATA.dueDate,
        body: renderedBody,
        headerColor: color,
      });
    } else if (type === 'quote') {
      html = renderQuoteEmailHtml({
        businessName: SAMPLE_DATA.businessName,
        clientName: SAMPLE_DATA.clientName,
        quoteNumber: SAMPLE_DATA.quoteNumber,
        total: SAMPLE_DATA.total,
        currency: SAMPLE_DATA.currency,
        expiryDate: SAMPLE_DATA.expiryDate,
        body: renderedBody,
        headerColor: color,
      });
    } else {
      html = renderReminderEmailHtml({
        businessName: SAMPLE_DATA.businessName,
        clientName: SAMPLE_DATA.clientName,
        invoiceNumber: SAMPLE_DATA.invoiceNumber,
        total: SAMPLE_DATA.total,
        dueDate: SAMPLE_DATA.dueDate,
        daysOverdue: 5,
        body: renderedBody,
        headerColor: color,
      });
    }

    res.json({ data: { html, subject: renderedSubject } });
  } catch (err) {
    next(err);
  }
});

// POST /:type/send-test - Send a test email with sample data
router.post('/:type/send-test', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!isValidType(type)) {
      res.status(400).json({ error: 'Invalid template type' });
      return;
    }

    const parsed = sendTestEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    await ensureDefaults();
    const template = await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.type, type),
    });
    const tpl = template || DEFAULTS[type];
    const color = sanitizeHeaderColor(
      template?.headerColor ?? null,
      DEFAULTS[type].headerColor,
    );

    const [settingsRow] = await db.select().from(settings).limit(1);
    const businessName = settingsRow?.businessName || 'My Business';

    const renderedSubject = replaceTemplateVariables(tpl.subject, SAMPLE_DATA);
    const renderedBody = replaceTemplateVariables(tpl.body, SAMPLE_DATA);

    let html: string;
    if (type === 'invoice') {
      html = renderInvoiceEmailHtml({
        businessName: SAMPLE_DATA.businessName,
        clientName: SAMPLE_DATA.clientName,
        invoiceNumber: SAMPLE_DATA.invoiceNumber,
        total: SAMPLE_DATA.total,
        currency: SAMPLE_DATA.currency,
        dueDate: SAMPLE_DATA.dueDate,
        body: renderedBody,
        headerColor: color,
      });
    } else if (type === 'quote') {
      html = renderQuoteEmailHtml({
        businessName: SAMPLE_DATA.businessName,
        clientName: SAMPLE_DATA.clientName,
        quoteNumber: SAMPLE_DATA.quoteNumber,
        total: SAMPLE_DATA.total,
        currency: SAMPLE_DATA.currency,
        expiryDate: SAMPLE_DATA.expiryDate,
        body: renderedBody,
        headerColor: color,
      });
    } else {
      html = renderReminderEmailHtml({
        businessName: SAMPLE_DATA.businessName,
        clientName: SAMPLE_DATA.clientName,
        invoiceNumber: SAMPLE_DATA.invoiceNumber,
        total: SAMPLE_DATA.total,
        dueDate: SAMPLE_DATA.dueDate,
        daysOverdue: 5,
        body: renderedBody,
        headerColor: color,
      });
    }

    await sendEmail({
      from: `${businessName} <${env.FROM_EMAIL}>`,
      to: parsed.data.to,
      subject: `[TEST] ${renderedSubject}`,
      html,
    });

    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;

/** Export DEFAULTS so email sending flow can use them. */
export { DEFAULTS as EMAIL_TEMPLATE_DEFAULTS };
