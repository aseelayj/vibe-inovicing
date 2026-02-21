import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema } from '@vibe/shared';

const router = Router();

// GET / - Get settings (first row, create default if none exists)
router.get('/', async (req, res, next) => {
  try {
    let [settingsRow] = await db.select().from(settings).limit(1);

    if (!settingsRow) {
      // Create default settings row
      const [created] = await db.insert(settings)
        .values({})
        .returning();
      settingsRow = created;
    }

    res.json({ data: settingsRow });
  } catch (err) {
    next(err);
  }
});

// PUT / - Update settings
router.put('/', validate(updateSettingsSchema), async (req, res, next) => {
  try {
    let [settingsRow] = await db.select().from(settings).limit(1);

    if (!settingsRow) {
      // Create with provided values
      const [created] = await db.insert(settings)
        .values(req.body)
        .returning();
      res.json({ data: created });
      return;
    }

    const updatePayload: Record<string, unknown> = {
      ...req.body,
      updatedAt: new Date(),
    };

    // Convert numeric fields to strings for decimal columns
    if (req.body.defaultTaxRate !== undefined) {
      updatePayload.defaultTaxRate = String(req.body.defaultTaxRate);
    }

    const [updated] = await db.update(settings)
      .set(updatePayload)
      .where(eq(settings.id, settingsRow.id))
      .returning();

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
