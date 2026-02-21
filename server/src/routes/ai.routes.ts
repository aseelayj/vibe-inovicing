import { Router } from 'express';
import { eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import {
  aiGenerateInvoiceSchema,
  aiSuggestLineItemsSchema,
  aiDraftEmailSchema,
  aiSearchSchema,
} from '@vibe/shared';
import { db } from '../db/index.js';
import {
  clients,
  invoices,
  invoiceLineItems,
  settings,
} from '../db/schema.js';
import {
  generateInvoiceFromPrompt,
  suggestLineItems,
  draftEmail,
  summarizeDashboard,
  smartSearch,
} from '../services/ai.service.js';

const aiDraftReminderSchema = z.object({
  invoiceId: z.number().int().positive('invoiceId is required'),
});

const router = Router();

// POST /generate-invoice
router.post(
  '/generate-invoice',
  validate(aiGenerateInvoiceSchema),
  async (req, res, next) => {
    try {
      const { prompt } = req.body;

      const allClients = await db
        .select({ id: clients.id, name: clients.name, company: clients.company })
        .from(clients);

      const result = await generateInvoiceFromPrompt(prompt, allClients);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /suggest-line-items
router.post(
  '/suggest-line-items',
  validate(aiSuggestLineItemsSchema),
  async (req, res, next) => {
    try {
      const { clientId, partialDescription } = req.body;

      let history: { description: string; quantity: number; unitPrice: number }[] = [];

      if (clientId) {
        const clientInvoices = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(eq(invoices.clientId, clientId));

        if (clientInvoices.length > 0) {
          const invoiceIds = clientInvoices.map((i) => i.id);
          const items = await db
            .select()
            .from(invoiceLineItems)
            .where(
              or(...invoiceIds.map((id) => eq(invoiceLineItems.invoiceId, id)))!,
            );

          history = items.map((item) => ({
            description: item.description,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
          }));
        }
      }

      const suggestions = await suggestLineItems(history, partialDescription);
      res.json({ data: suggestions });
    } catch (err) {
      next(err);
    }
  },
);

// POST /draft-email
router.post(
  '/draft-email',
  validate(aiDraftEmailSchema),
  async (req, res, next) => {
    try {
      const { invoiceId, context: type } = req.body;

      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, invoiceId),
        with: { client: true },
      });

      if (!invoice || !invoice.client) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const [settingsRow] = await db.select().from(settings).limit(1);

      const now = new Date();
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const result = await draftEmail({
        type,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.name,
        total: invoice.total,
        dueDate: invoice.dueDate,
        businessName: settingsRow?.businessName || 'Our Company',
        isOverdue: daysOverdue > 0,
        daysOverdue: Math.max(0, daysOverdue),
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// POST /draft-reminder
router.post('/draft-reminder', validate(aiDraftReminderSchema), async (req, res, next) => {
  try {
    const { invoiceId } = req.body;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: { client: true },
    });

    if (!invoice || !invoice.client) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const [settingsRow] = await db.select().from(settings).limit(1);

    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const result = await draftEmail({
      type: 'reminder',
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.client.name,
      total: invoice.total,
      dueDate: invoice.dueDate,
      businessName: settingsRow?.businessName || 'Our Company',
      isOverdue: daysOverdue > 0,
      daysOverdue: Math.max(0, daysOverdue),
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /summarize-dashboard
router.post('/summarize-dashboard', async (req, res, next) => {
  try {
    const { stats } = req.body;
    const summary = await summarizeDashboard(stats);
    res.json({ data: { summary } });
  } catch (err) {
    next(err);
  }
});

// POST /search
router.post(
  '/search',
  validate(aiSearchSchema),
  async (req, res, next) => {
    try {
      const { query } = req.body;

      const allInvoices = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          total: invoices.total,
          status: invoices.status,
          clientName: clients.name,
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .limit(50);

      const allClients = await db
        .select({
          id: clients.id,
          name: clients.name,
          email: clients.email,
          company: clients.company,
        })
        .from(clients)
        .limit(50);

      const result = await smartSearch(query, {
        invoices: allInvoices.map((i) => ({
          ...i,
          clientName: i.clientName || 'Unknown',
        })),
        clients: allClients,
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
