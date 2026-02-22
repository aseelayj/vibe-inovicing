import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  invoices,
  invoiceLineItems,
  clients,
  settings,
  jofotaraSubmissions,
  activityLog,
} from '../../db/schema.js';
import { buildJofotaraXml, type XmlLineItem } from './xml-builder.js';
import { submitToJofotara } from './api-client.js';
import type { JofotaraInvoiceType } from '@vibe/shared';
import { decryptSecret } from '../../utils/crypto.js';

interface SubmitOptions {
  paymentMethod: 'cash' | 'receivable';
  invoiceType?: JofotaraInvoiceType;
}

interface CreditOptions {
  originalInvoiceId: number;
  reasonForReturn: string;
  paymentMethod?: 'cash' | 'receivable';
}

export function validateForJofotara(
  invoice: Record<string, unknown>,
  client: Record<string, unknown> | null,
  settingsRow: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  // Settings checks
  if (!settingsRow.jofotaraClientId) {
    errors.push('JoFotara Client ID is not configured in Settings');
  }
  if (!settingsRow.jofotaraClientSecret) {
    errors.push('JoFotara Client Secret is not configured in Settings');
  }
  if (!settingsRow.jofotaraCompanyTin) {
    errors.push('Company TIN is not configured in Settings');
  }
  if (!settingsRow.jofotaraIncomeSourceSequence) {
    errors.push('Income Source Sequence is not configured in Settings');
  }

  // Invoice checks
  if (!invoice.clientId) {
    errors.push('Invoice must have a client assigned');
  }
  if (invoice.currency !== 'JOD') {
    errors.push(
      `Invoice currency must be JOD (currently ${invoice.currency})`,
    );
  }

  // Client checks
  if (!client) {
    errors.push('Client not found');
  } else if (!client.taxId) {
    errors.push('Client Tax ID (TIN) is required for JoFotara');
  }

  return errors;
}

export async function submitInvoiceToJofotara(
  invoiceId: number,
  options: SubmitOptions,
) {
  // Load invoice with line items
  const [invoiceRow] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoiceRow) throw new Error('Invoice not found');

  if (invoiceRow.jofotaraStatus === 'submitted') {
    throw new Error('Invoice has already been submitted to JoFotara');
  }

  const lineItemRows = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  if (lineItemRows.length === 0) {
    throw new Error('Invoice has no line items');
  }

  // Load client
  let clientRow = null;
  if (invoiceRow.clientId) {
    const [c] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoiceRow.clientId))
      .limit(1);
    clientRow = c || null;
  }

  // Load settings
  const [settingsRow] = await db.select().from(settings).limit(1);
  if (!settingsRow) throw new Error('Settings not found');

  // Validate
  const validationErrors = validateForJofotara(
    invoiceRow,
    clientRow,
    settingsRow,
  );
  if (validationErrors.length > 0) {
    throw new Error(
      `Validation failed: ${validationErrors.join('; ')}`,
    );
  }

  const uuid = randomUUID();
  const invoiceType =
    options.invoiceType
    || (settingsRow.jofotaraInvoiceType as JofotaraInvoiceType)
    || 'general_sales';

  // Distribute invoice-level discount proportionally across line items
  const totalDiscount = parseFloat(
    String(invoiceRow.discountAmount || '0'),
  );
  const subtotal = parseFloat(String(invoiceRow.subtotal || '0'));
  const taxRate = parseFloat(String(invoiceRow.taxRate || '0'));

  // Tax category
  const taxCategory: 'S' | 'Z' | 'O' = taxRate > 0 ? 'S' : 'O';

  const xmlItems: XmlLineItem[] = lineItemRows.map((li, idx) => {
    const qty = parseFloat(String(li.quantity));
    const price = parseFloat(String(li.unitPrice));
    const lineAmount = qty * price;

    // Proportional discount
    let itemDiscount = 0;
    if (totalDiscount > 0 && subtotal > 0) {
      itemDiscount = Math.round(
        ((lineAmount / subtotal) * totalDiscount) * 100,
      ) / 100;
    }

    return {
      id: idx + 1,
      quantity: qty,
      unitPrice: price,
      discount: itemDiscount,
      description: li.description,
      taxCategory,
      taxPercent: taxRate,
    };
  });

  // Fix rounding remainder: ensure discounts sum exactly to totalDiscount
  if (totalDiscount > 0 && xmlItems.length > 0) {
    const discountSum = xmlItems.reduce((s, i) => s + i.discount, 0);
    const remainder = Math.round(
      (totalDiscount - discountSum) * 100,
    ) / 100;
    if (remainder !== 0) {
      xmlItems[xmlItems.length - 1].discount += remainder;
    }
  }

  // Build XML
  const xmlContent = buildJofotaraXml({
    invoiceId: invoiceRow.invoiceNumber,
    uuid,
    issueDate: String(invoiceRow.issueDate).split('T')[0],
    invoiceType,
    paymentMethod: options.paymentMethod,
    note: invoiceRow.notes || undefined,
    sellerName: settingsRow.businessName,
    sellerTin: settingsRow.jofotaraCompanyTin!,
    customerId: clientRow!.taxId!,
    customerIdType: 'TIN',
    customerName: clientRow!.name,
    customerPhone: clientRow!.phone || undefined,
    customerCityCode: clientRow!.cityCode || undefined,
    customerPostalCode: clientRow!.postalCode || undefined,
    incomeSourceSequence: settingsRow.jofotaraIncomeSourceSequence!,
    lineItems: xmlItems,
  });

  // Update status to pending
  await db
    .update(invoices)
    .set({
      jofotaraStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  // Submit to API
  const response = await submitToJofotara(
    settingsRow.jofotaraClientId!,
    decryptSecret(settingsRow.jofotaraClientSecret as string)!,
    xmlContent,
  );

  const finalStatus = response.success ? 'submitted' : 'failed';

  // Log submission
  const [submission] = await db
    .insert(jofotaraSubmissions)
    .values({
      invoiceId,
      uuid: response.uuid || uuid,
      status: finalStatus,
      invoiceNumber: response.invoiceNumber,
      qrCode: response.qrCode,
      xmlContent,
      rawResponse: response.rawResponse,
      errorMessage: response.errors.length > 0
        ? response.errors.map((e) => e.message).join('; ')
        : null,
      isCreditInvoice: false,
    })
    .returning();

  // Update invoice
  await db
    .update(invoices)
    .set({
      jofotaraUuid: response.uuid || uuid,
      jofotaraStatus: finalStatus,
      jofotaraQrCode: response.qrCode,
      jofotaraInvoiceNumber: response.invoiceNumber,
      jofotaraSubmittedAt: response.success ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  // Activity log
  await db.insert(activityLog).values({
    entityType: 'invoice',
    entityId: invoiceId,
    action: response.success
      ? 'jofotara_submitted'
      : 'jofotara_failed',
    description: response.success
      ? `Submitted to JoFotara (UUID: ${response.uuid})`
      : `JoFotara submission failed: ${
        response.errors.map((e) => e.message).join('; ')
      }`,
  });

  return {
    success: response.success,
    submission,
    errors: response.errors,
  };
}

export async function submitCreditInvoice(
  invoiceId: number,
  options: CreditOptions,
) {
  // Load the original invoice to reference
  const [originalInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, options.originalInvoiceId))
    .limit(1);

  if (!originalInvoice) {
    throw new Error('Original invoice not found');
  }
  if (!originalInvoice.jofotaraUuid) {
    throw new Error(
      'Original invoice has not been submitted to JoFotara',
    );
  }

  // Load the current invoice (credit note)
  const [invoiceRow] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoiceRow) throw new Error('Credit invoice not found');

  const lineItemRows = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  let clientRow = null;
  if (invoiceRow.clientId) {
    const [c] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoiceRow.clientId))
      .limit(1);
    clientRow = c || null;
  }

  const [settingsRow] = await db.select().from(settings).limit(1);
  if (!settingsRow) throw new Error('Settings not found');

  // Validate before proceeding
  const validationErrors = validateForJofotara(
    invoiceRow,
    clientRow,
    settingsRow,
  );
  if (validationErrors.length > 0) {
    throw new Error(
      `Validation failed: ${validationErrors.join('; ')}`,
    );
  }

  const uuid = randomUUID();
  const invoiceType =
    (settingsRow.jofotaraInvoiceType as JofotaraInvoiceType)
    || 'general_sales';
  const taxRate = parseFloat(String(invoiceRow.taxRate || '0'));

  const xmlItems: XmlLineItem[] = lineItemRows.map((li, idx) => ({
    id: idx + 1,
    quantity: parseFloat(String(li.quantity)),
    unitPrice: parseFloat(String(li.unitPrice)),
    discount: 0,
    description: li.description,
    taxCategory: taxRate > 0 ? 'S' as const : 'O' as const,
    taxPercent: taxRate,
  }));

  const xmlContent = buildJofotaraXml({
    invoiceId: invoiceRow.invoiceNumber,
    uuid,
    issueDate: String(invoiceRow.issueDate).split('T')[0],
    invoiceType,
    paymentMethod: options.paymentMethod || 'cash',
    isCreditInvoice: true,
    originalInvoiceId: originalInvoice.invoiceNumber,
    originalInvoiceUuid: originalInvoice.jofotaraUuid,
    originalFullAmount: parseFloat(String(originalInvoice.total)),
    reasonForReturn: options.reasonForReturn,
    sellerName: settingsRow.businessName,
    sellerTin: settingsRow.jofotaraCompanyTin!,
    customerId: clientRow!.taxId!,
    customerIdType: 'TIN',
    customerName: clientRow!.name,
    customerPhone: clientRow!.phone || undefined,
    customerCityCode: clientRow!.cityCode || undefined,
    customerPostalCode: clientRow!.postalCode || undefined,
    incomeSourceSequence: settingsRow.jofotaraIncomeSourceSequence!,
    lineItems: xmlItems,
  });

  // Update status to pending before API call
  await db
    .update(invoices)
    .set({
      jofotaraStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  const response = await submitToJofotara(
    settingsRow.jofotaraClientId!,
    decryptSecret(settingsRow.jofotaraClientSecret as string)!,
    xmlContent,
  );

  const finalStatus = response.success ? 'submitted' : 'failed';

  const [submission] = await db
    .insert(jofotaraSubmissions)
    .values({
      invoiceId,
      uuid: response.uuid || uuid,
      status: finalStatus,
      invoiceNumber: response.invoiceNumber,
      qrCode: response.qrCode,
      xmlContent,
      rawResponse: response.rawResponse,
      errorMessage: response.errors.length > 0
        ? response.errors.map((e) => e.message).join('; ')
        : null,
      isCreditInvoice: true,
      originalInvoiceId: String(options.originalInvoiceId),
      reasonForReturn: options.reasonForReturn,
    })
    .returning();

  await db
    .update(invoices)
    .set({
      jofotaraUuid: response.uuid || uuid,
      jofotaraStatus: finalStatus,
      jofotaraQrCode: response.qrCode,
      jofotaraInvoiceNumber: response.invoiceNumber,
      jofotaraSubmittedAt: response.success ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  await db.insert(activityLog).values({
    entityType: 'invoice',
    entityId: invoiceId,
    action: response.success
      ? 'jofotara_credit_submitted'
      : 'jofotara_credit_failed',
    description: response.success
      ? `Credit note submitted to JoFotara (UUID: ${response.uuid})`
      : `Credit note failed: ${
        response.errors.map((e) => e.message).join('; ')
      }`,
  });

  return {
    success: response.success,
    submission,
    errors: response.errors,
  };
}

export async function getSubmissionHistory(invoiceId: number) {
  return db
    .select()
    .from(jofotaraSubmissions)
    .where(eq(jofotaraSubmissions.invoiceId, invoiceId))
    .orderBy(desc(jofotaraSubmissions.createdAt));
}

export async function getSubmissionXml(invoiceId: number) {
  const [submission] = await db
    .select()
    .from(jofotaraSubmissions)
    .where(eq(jofotaraSubmissions.invoiceId, invoiceId))
    .orderBy(desc(jofotaraSubmissions.createdAt))
    .limit(1);

  return submission?.xmlContent || null;
}

export async function preValidateInvoice(invoiceId: number) {
  const [invoiceRow] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoiceRow) throw new Error('Invoice not found');

  let clientRow = null;
  if (invoiceRow.clientId) {
    const [c] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoiceRow.clientId))
      .limit(1);
    clientRow = c || null;
  }

  const [settingsRow] = await db.select().from(settings).limit(1);
  if (!settingsRow) throw new Error('Settings not found');

  const lineItemRows = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  const errors = validateForJofotara(invoiceRow, clientRow, settingsRow);

  if (lineItemRows.length === 0) {
    errors.push('Invoice has no line items');
  }

  return {
    valid: errors.length === 0,
    errors,
    invoice: invoiceRow,
    client: clientRow,
  };
}
