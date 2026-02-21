import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invoices } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { jofotaraSubmitSchema, jofotaraCreditSchema } from '@vibe/shared';
import {
  submitInvoiceToJofotara,
  submitCreditInvoice,
  preValidateInvoice,
  getSubmissionHistory,
  getSubmissionXml,
} from '../services/jofotara/index.js';

const router = Router();

// POST /invoices/:id/submit - Submit invoice to JoFotara
router.post(
  '/invoices/:id/submit',
  validate(jofotaraSubmitSchema),
  async (req, res, next) => {
    try {
      const invoiceId = parseInt(req.params.id as string, 10);

      // Guard: only taxable invoices can be submitted to JoFotara
      const [invoice] = await db.select({ isTaxable: invoices.isTaxable })
        .from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      if (!invoice.isTaxable) {
        res.status(400).json({
          error: 'Only taxable invoices (INV) can be submitted to JoFotara',
        });
        return;
      }

      const result = await submitInvoiceToJofotara(invoiceId, {
        paymentMethod: req.body.paymentMethod,
        invoiceType: req.body.invoiceType,
      });

      if (!result.success) {
        const errorDetails = result.errors
          .map((e) => e.message)
          .join('; ');
        res.status(400).json({
          error: errorDetails || 'JoFotara submission failed',
          data: result.submission,
        });
        return;
      }

      res.json({ data: result.submission });
    } catch (err) {
      next(err);
    }
  },
);

// POST /invoices/:id/credit - Submit credit note
router.post(
  '/invoices/:id/credit',
  validate(jofotaraCreditSchema),
  async (req, res, next) => {
    try {
      const invoiceId = parseInt(req.params.id as string, 10);
      const result = await submitCreditInvoice(invoiceId, {
        originalInvoiceId: req.body.originalInvoiceId,
        reasonForReturn: req.body.reasonForReturn,
      });

      if (!result.success) {
        const errorDetails = result.errors
          .map((e) => e.message)
          .join('; ');
        res.status(400).json({
          error: errorDetails || 'JoFotara credit submission failed',
          data: result.submission,
        });
        return;
      }

      res.json({ data: result.submission });
    } catch (err) {
      next(err);
    }
  },
);

// POST /validate/:id - Pre-validate without submitting
router.post('/validate/:id', async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const result = await preValidateInvoice(invoiceId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /invoices/:id/submissions - Get submission history
router.get('/invoices/:id/submissions', async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const submissions = await getSubmissionHistory(invoiceId);
    res.json({ data: submissions });
  } catch (err) {
    next(err);
  }
});

// GET /invoices/:id/xml - Download submitted XML
router.get('/invoices/:id/xml', async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    const xml = await getSubmissionXml(invoiceId);

    if (!xml) {
      res.status(404).json({ error: 'No XML found for this invoice' });
      return;
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="jofotara-${invoiceId}.xml"`,
    );
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

export default router;
