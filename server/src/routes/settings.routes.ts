import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { settings, invoices } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema, updateSequenceSchema } from '@vibe/shared';
import { encryptSettingsSecrets, decryptSettingsSecrets } from '../utils/crypto.js';

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

    // Decrypt secrets for internal use, then mask for API response
    const decrypted = decryptSettingsSecrets({ ...settingsRow });
    decrypted.jofotaraClientSecret = maskSecret(decrypted.jofotaraClientSecret);
    decrypted.paypalClientSecret = maskSecret(decrypted.paypalClientSecret);
    decrypted.geminiApiKey = maskSecret(decrypted.geminiApiKey);
    decrypted.resendApiKey = maskSecret(decrypted.resendApiKey);
    decrypted.smtpPassword = maskSecret(decrypted.smtpPassword);

    res.json({ data: decrypted });
  } catch (err) {
    next(err);
  }
});

// PUT / - Update settings
router.put('/', validate(updateSettingsSchema), async (req, res, next) => {
  try {
    let [settingsRow] = await db.select().from(settings).limit(1);

    if (!settingsRow) {
      const encrypted = encryptSettingsSecrets(req.body);
      const [created] = await db.insert(settings)
        .values(encrypted)
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
      'geminiApiKey',
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

    // Encrypt new secret values before writing to DB
    const encryptedPayload = encryptSettingsSecrets(updatePayload);

    const [updated] = await db.update(settings)
      .set(encryptedPayload)
      .where(eq(settings.id, settingsRow.id))
      .returning();

    // Decrypt then mask for the response
    const decrypted = decryptSettingsSecrets({ ...updated });
    decrypted.jofotaraClientSecret = maskSecret(decrypted.jofotaraClientSecret);
    decrypted.paypalClientSecret = maskSecret(decrypted.paypalClientSecret);
    decrypted.geminiApiKey = maskSecret(decrypted.geminiApiKey);
    decrypted.resendApiKey = maskSecret(decrypted.resendApiKey);
    decrypted.smtpPassword = maskSecret(decrypted.smtpPassword);

    res.json({ data: decrypted });
  } catch (err) {
    next(err);
  }
});

// POST /validate-sequence - Validate sequence counter values before saving
router.post('/validate-sequence', validate(updateSequenceSchema), async (req, res, next) => {
  try {
    const [settingsRow] = await db.select().from(settings).limit(1);
    if (!settingsRow) {
      res.json({ data: { warnings: [] } });
      return;
    }

    const warnings: { field: string; message: string }[] = [];

    // For each counter, check if setting it lower would cause duplicates
    const checks = [
      {
        field: 'nextInvoiceNumber',
        value: req.body.nextInvoiceNumber,
        prefix: settingsRow.invoicePrefix,
        label: 'Taxable Invoice',
      },
      {
        field: 'nextExemptInvoiceNumber',
        value: req.body.nextExemptInvoiceNumber,
        prefix: settingsRow.exemptInvoicePrefix,
        label: 'Exempt Invoice',
      },
      {
        field: 'nextWriteOffNumber',
        value: req.body.nextWriteOffNumber,
        prefix: settingsRow.writeOffPrefix,
        label: 'Write-Off',
      },
      {
        field: 'nextQuoteNumber',
        value: req.body.nextQuoteNumber,
        prefix: settingsRow.quotePrefix,
        label: 'Quote',
      },
    ];

    for (const check of checks) {
      if (check.value === undefined) continue;

      // Find highest existing number for this prefix
      const [result] = await db
        .select({ maxNum: sql<string>`MAX(${invoices.invoiceNumber})` })
        .from(invoices)
        .where(sql`${invoices.invoiceNumber} LIKE ${check.prefix + '-%'}`);

      if (result?.maxNum) {
        const parts = result.maxNum.split('-');
        const highest = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(highest) && check.value <= highest) {
          warnings.push({
            field: check.field,
            message: `${check.label} counter (${check.value}) is at or below the highest existing number (${highest}). This may cause duplicate number errors when creating new invoices.`,
          });
        }
      }
    }

    res.json({ data: { warnings } });
  } catch (err) {
    next(err);
  }
});

export default router;
