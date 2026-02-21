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

    // Mask secret before sending to client
    const response = { ...settingsRow };
    if (response.jofotaraClientSecret) {
      const secret = response.jofotaraClientSecret;
      response.jofotaraClientSecret = secret.length > 4
        ? '****' + secret.slice(-4)
        : '****';
    }

    res.json({ data: response });
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
    if (req.body.personalExemption !== undefined) {
      updatePayload.personalExemption = String(req.body.personalExemption);
    }
    if (req.body.familyExemption !== undefined) {
      updatePayload.familyExemption = String(req.body.familyExemption);
    }
    if (req.body.additionalExemptions !== undefined) {
      updatePayload.additionalExemptions = String(req.body.additionalExemptions);
    }

    // Don't overwrite secret with the masked value from the GET response
    if (
      updatePayload.jofotaraClientSecret &&
      typeof updatePayload.jofotaraClientSecret === 'string' &&
      (updatePayload.jofotaraClientSecret as string).startsWith('****')
    ) {
      delete updatePayload.jofotaraClientSecret;
    }

    const [updated] = await db.update(settings)
      .set(updatePayload)
      .where(eq(settings.id, settingsRow.id))
      .returning();

    // Mask secret in response
    const response = { ...updated };
    if (response.jofotaraClientSecret) {
      const secret = response.jofotaraClientSecret;
      response.jofotaraClientSecret = secret.length > 4
        ? '****' + secret.slice(-4)
        : '****';
    }

    res.json({ data: response });
  } catch (err) {
    next(err);
  }
});

export default router;
