import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema } from '@vibe/shared';

const router = Router();

function maskSecret(secret: string | null): string | null {
  if (!secret) return null;
  return secret.length > 4 ? '****' + secret.slice(-4) : '****';
}

// GET / - Get settings (first row, create default if none exists)
router.get('/', async (req, res, next) => {
  try {
    let [settingsRow] = await db.select().from(settings).limit(1);

    if (!settingsRow) {
      const [created] = await db.insert(settings)
        .values({})
        .returning();
      settingsRow = created;
    }

    const response = { ...settingsRow };
    response.jofotaraClientSecret = maskSecret(response.jofotaraClientSecret);
    response.paypalClientSecret = maskSecret(response.paypalClientSecret);
    response.resendApiKey = maskSecret(response.resendApiKey);
    response.smtpPassword = maskSecret(response.smtpPassword);

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

    // Don't overwrite secrets with the masked values from the GET response
    for (const key of [
      'jofotaraClientSecret',
      'paypalClientSecret',
      'resendApiKey',
      'smtpPassword',
    ]) {
      if (
        updatePayload[key] &&
        typeof updatePayload[key] === 'string' &&
        (updatePayload[key] as string).startsWith('****')
      ) {
        delete updatePayload[key];
      }
    }

    const [updated] = await db.update(settings)
      .set(updatePayload)
      .where(eq(settings.id, settingsRow.id))
      .returning();

    const response = { ...updated };
    response.jofotaraClientSecret = maskSecret(response.jofotaraClientSecret);
    response.paypalClientSecret = maskSecret(response.paypalClientSecret);
    response.resendApiKey = maskSecret(response.resendApiKey);
    response.smtpPassword = maskSecret(response.smtpPassword);

    res.json({ data: response });
  } catch (err) {
    next(err);
  }
});

export default router;
