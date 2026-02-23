import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { renderInvoiceEmailHtml, renderReminderEmailHtml } from '../templates/invoice-email.js';
import { renderQuoteEmailHtml } from '../templates/quote-email.js';
import { wrapLinksForTracking } from '../utils/template-renderer.js';
import { decryptSecret } from '../utils/crypto.js';

interface SendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export async function sendEmail(
  payload: SendEmailPayload,
): Promise<{ id: string }> {
  const [row] = await db.select().from(settings).limit(1);
  const provider = row?.emailProvider ?? 'resend';

  if (provider === 'smtp' && row?.smtpHost) {
    const port = row.smtpPort ?? 587;
    // secure=true means direct TLS (port 465).
    // For port 587 use STARTTLS upgrade instead.
    const secure = row.smtpSecure && port === 465;

    const transporter = nodemailer.createTransport({
      host: row.smtpHost,
      port,
      secure,
      auth: row.smtpUsername
        ? { user: row.smtpUsername, pass: decryptSecret(row.smtpPassword) ?? '' }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    try {
      await transporter.verify();
    } catch (err: any) {
      throw new Error(`SMTP connection failed: ${err.message}`);
    }

    const info = await transporter.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    return { id: info.messageId ?? '' };
  }

  // Default: Resend — use DB key first, fall back to env
  const apiKey = decryptSecret(row?.resendApiKey) || env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('No Resend API key configured. Set it in Settings > Email or RESEND_API_KEY env.');
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return { id: data?.id || '' };
}

export async function sendInvoiceEmail(params: {
  to: string;
  subject: string;
  body: string;
  pdfBuffer: Buffer;
  invoiceNumber: string;
  businessName: string;
  clientName: string;
  total: string;
  currency: string;
  dueDate: string;
  headerColor?: string;
  trackingPixelUrl?: string;
  emailLogId?: number;
}): Promise<{ id: string }> {
  let html = renderInvoiceEmailHtml({
    businessName: params.businessName,
    clientName: params.clientName,
    invoiceNumber: params.invoiceNumber,
    total: params.total,
    currency: params.currency,
    dueDate: params.dueDate,
    body: params.body,
    headerColor: params.headerColor,
    trackingPixelUrl: params.trackingPixelUrl,
  });

  if (params.emailLogId) {
    html = wrapLinksForTracking(html, params.emailLogId, env.SERVER_BASE_URL);
  }

  return sendEmail({
    from: `${params.businessName} <${env.FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html,
    attachments: [{
      filename: `${params.invoiceNumber}.pdf`,
      content: params.pdfBuffer,
    }],
  });
}

export async function sendQuoteEmail(params: {
  to: string;
  subject: string;
  body: string;
  pdfBuffer: Buffer;
  quoteNumber: string;
  businessName: string;
  clientName: string;
  total: string;
  currency: string;
  expiryDate: string | null;
  headerColor?: string;
  trackingPixelUrl?: string;
  emailLogId?: number;
}): Promise<{ id: string }> {
  let html = renderQuoteEmailHtml({
    businessName: params.businessName,
    clientName: params.clientName,
    quoteNumber: params.quoteNumber,
    total: params.total,
    currency: params.currency,
    expiryDate: params.expiryDate,
    body: params.body,
    headerColor: params.headerColor,
    trackingPixelUrl: params.trackingPixelUrl,
  });

  if (params.emailLogId) {
    html = wrapLinksForTracking(html, params.emailLogId, env.SERVER_BASE_URL);
  }

  return sendEmail({
    from: `${params.businessName} <${env.FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html,
    attachments: [{
      filename: `${params.quoteNumber}.pdf`,
      content: params.pdfBuffer,
    }],
  });
}

export async function sendPaymentReminder(params: {
  to: string;
  subject: string;
  body: string;
  businessName: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  daysOverdue: number;
  headerColor?: string;
  trackingPixelUrl?: string;
  emailLogId?: number;
}): Promise<{ id: string }> {
  let html = renderReminderEmailHtml({
    businessName: params.businessName,
    clientName: params.clientName,
    invoiceNumber: params.invoiceNumber,
    total: params.total,
    dueDate: params.dueDate,
    daysOverdue: params.daysOverdue,
    body: params.body,
    headerColor: params.headerColor,
    trackingPixelUrl: params.trackingPixelUrl,
  });

  if (params.emailLogId) {
    html = wrapLinksForTracking(html, params.emailLogId, env.SERVER_BASE_URL);
  }

  return sendEmail({
    from: `${params.businessName} <${env.FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html,
  });
}
