import { Resend } from 'resend';
import { env } from '../env.js';
import { renderInvoiceEmailHtml, renderReminderEmailHtml } from '../templates/invoice-email.js';
import { renderQuoteEmailHtml } from '../templates/quote-email.js';

const resend = new Resend(env.RESEND_API_KEY);

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
}): Promise<{ id: string }> {
  const html = renderInvoiceEmailHtml({
    businessName: params.businessName,
    clientName: params.clientName,
    invoiceNumber: params.invoiceNumber,
    total: params.total,
    currency: params.currency,
    dueDate: params.dueDate,
    body: params.body,
  });

  const { data, error } = await resend.emails.send({
    from: `${params.businessName} <${env.FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html,
    attachments: [{
      filename: `${params.invoiceNumber}.pdf`,
      content: params.pdfBuffer,
    }],
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return { id: data?.id || '' };
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
}): Promise<{ id: string }> {
  const html = renderQuoteEmailHtml({
    businessName: params.businessName,
    clientName: params.clientName,
    quoteNumber: params.quoteNumber,
    total: params.total,
    currency: params.currency,
    expiryDate: params.expiryDate,
    body: params.body,
  });

  const { data, error } = await resend.emails.send({
    from: `${params.businessName} <${env.FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html,
    attachments: [{
      filename: `${params.quoteNumber}.pdf`,
      content: params.pdfBuffer,
    }],
  });

  if (error) {
    throw new Error(`Quote email send failed: ${error.message}`);
  }

  return { id: data?.id || '' };
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
}): Promise<{ id: string }> {
  const html = renderReminderEmailHtml({
    businessName: params.businessName,
    clientName: params.clientName,
    invoiceNumber: params.invoiceNumber,
    total: params.total,
    dueDate: params.dueDate,
    daysOverdue: params.daysOverdue,
    body: params.body,
  });

  const { data, error } = await resend.emails.send({
    from: `${params.businessName} <${env.FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html,
  });

  if (error) {
    throw new Error(`Reminder send failed: ${error.message}`);
  }

  return { id: data?.id || '' };
}
