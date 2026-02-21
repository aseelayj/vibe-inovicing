import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailLog, emailTrackingEvents } from '../db/schema.js';
import { parseId } from '../utils/parse-id.js';

const router = Router();

// GET / - List email logs filtered by invoiceId or quoteId
router.get('/', async (req, res, next) => {
  try {
    const { invoiceId, quoteId } = req.query;

    let where;
    if (invoiceId) {
      where = eq(emailLog.invoiceId, parseInt(invoiceId as string, 10));
    } else if (quoteId) {
      where = eq(emailLog.quoteId, parseInt(quoteId as string, 10));
    }

    if (!where) {
      res.status(400).json({ error: 'invoiceId or quoteId query param required' });
      return;
    }

    const logs = await db.select().from(emailLog)
      .where(where)
      .orderBy(desc(emailLog.sentAt));

    res.json({ data: logs });
  } catch (err) {
    next(err);
  }
});

// GET /:id/tracking - Detailed tracking events for one email
router.get('/:id/tracking', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const events = await db.select().from(emailTrackingEvents)
      .where(eq(emailTrackingEvents.emailLogId, id))
      .orderBy(desc(emailTrackingEvents.createdAt));

    res.json({ data: events });
  } catch (err) {
    next(err);
  }
});

export default router;
