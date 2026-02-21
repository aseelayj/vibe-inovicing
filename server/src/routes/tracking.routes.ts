import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailLog, emailTrackingEvents } from '../db/schema.js';

const router = Router();

// 1x1 transparent GIF (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// GET /open/:emailLogId - Record open event, return tracking pixel
router.get('/open/:emailLogId', async (req, res) => {
  try {
    const emailLogId = parseInt(req.params.emailLogId, 10);
    if (isNaN(emailLogId)) {
      res.status(400).end();
      return;
    }

    // Verify the email log exists
    const logEntry = await db.query.emailLog.findFirst({
      where: eq(emailLog.id, emailLogId),
    });
    if (!logEntry) {
      res.set('Content-Type', 'image/gif');
      res.send(TRACKING_PIXEL);
      return;
    }

    // Record tracking event
    await db.insert(emailTrackingEvents).values({
      emailLogId,
      eventType: 'open',
      ipAddress: (req.headers['x-forwarded-for'] as string)
        ?.split(',')[0]?.trim() || req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });

    // Update convenience columns
    await db.update(emailLog)
      .set({
        openCount: sql`${emailLog.openCount} + 1`,
        openedAt: logEntry.openedAt ?? new Date(),
      })
      .where(eq(emailLog.id, emailLogId));
  } catch {
    // Silently fail — don't break the email experience
  }

  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.send(TRACKING_PIXEL);
});

// GET /click/:emailLogId - Record click event, redirect to target URL
router.get('/click/:emailLogId', async (req, res) => {
  const emailLogId = parseInt(req.params.emailLogId, 10);
  const targetUrl = req.query.url as string;

  // Validate URL to prevent open redirect
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  if (isNaN(emailLogId) || !targetUrl
    || !['http:', 'https:'].includes(parsedUrl.protocol)) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  try {
    const logEntry = await db.query.emailLog.findFirst({
      where: eq(emailLog.id, emailLogId),
    });

    if (logEntry) {
      await db.insert(emailTrackingEvents).values({
        emailLogId,
        eventType: 'click',
        url: targetUrl,
        ipAddress: (req.headers['x-forwarded-for'] as string)
          ?.split(',')[0]?.trim() || req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });

      await db.update(emailLog)
        .set({
          clickCount: sql`${emailLog.clickCount} + 1`,
          clickedAt: logEntry.clickedAt ?? new Date(),
        })
        .where(eq(emailLog.id, emailLogId));
    }
  } catch {
    // Silently fail
  }

  res.redirect(302, targetUrl);
});

export default router;
