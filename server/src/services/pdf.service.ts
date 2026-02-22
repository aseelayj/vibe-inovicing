import puppeteer, { type Browser } from 'puppeteer';
import { renderInvoiceHtml } from '../templates/invoice-pdf.js';
import { renderQuoteHtml } from '../templates/quote-pdf.js';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function renderPdf(html: string): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function generateInvoicePdf(data: {
  invoice: any;
  lineItems: any[];
  client: any;
  settings: any;
}): Promise<Buffer> {
  const html = await renderInvoiceHtml(data);
  return renderPdf(html);
}

export async function generateQuotePdf(data: {
  quote: any;
  lineItems: any[];
  client: any;
  settings: any;
}): Promise<Buffer> {
  const html = renderQuoteHtml(data);
  return renderPdf(html);
}

export async function generateReceiptPdf(data: {
  payment: any;
  invoice: any;
  client: any;
  settings: any;
}): Promise<Buffer> {
  const { payment, invoice, client, settings: s } = data;
  const amount = parseFloat(String(payment.amount));
  const formatMoney = (v: number) => v.toFixed(2);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; margin: 0; padding: 0; }
  .container { max-width: 700px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2563eb; }
  .header h1 { font-size: 24px; color: #2563eb; margin: 0; }
  .business { text-align: right; font-size: 12px; color: #666; }
  .business strong { color: #1a1a1a; font-size: 14px; display: block; margin-bottom: 4px; }
  .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .info-box { background: #f8fafc; padding: 16px; border-radius: 8px; }
  .info-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 8px; }
  .info-box p { margin: 2px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
  td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
  .amount { font-size: 28px; font-weight: 700; color: #166534; text-align: center; margin: 30px 0; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
</style></head><body>
<div class="container">
  <div class="header">
    <div>
      <h1>Payment Receipt</h1>
      <div class="badge">PAID</div>
    </div>
    <div class="business">
      <strong>${s?.businessName || 'Business'}</strong>
      ${s?.businessEmail || ''}<br/>
      ${s?.businessPhone || ''}<br/>
      ${(s?.businessAddress || '').replace(/\n/g, '<br/>')}
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Received From</h3>
      <p><strong>${client.name}</strong></p>
      ${client.company ? `<p>${client.company}</p>` : ''}
      ${client.email ? `<p>${client.email}</p>` : ''}
    </div>
    <div class="info-box">
      <h3>Receipt Details</h3>
      <p><strong>Receipt #:</strong> REC-${String(payment.id).padStart(4, '0')}</p>
      <p><strong>Date:</strong> ${payment.paymentDate}</p>
      <p><strong>Method:</strong> ${(payment.paymentMethod || 'N/A').replace(/_/g, ' ')}</p>
      ${payment.reference ? `<p><strong>Reference:</strong> ${payment.reference}</p>` : ''}
    </div>
  </div>

  <div class="amount">${invoice.currency} ${formatMoney(amount)}</div>

  <table>
    <thead>
      <tr>
        <th>Invoice</th>
        <th>Invoice Total</th>
        <th>Amount Paid</th>
        <th>Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${invoice.invoiceNumber}</td>
        <td>${invoice.currency} ${parseFloat(String(invoice.total)).toFixed(2)}</td>
        <td>${invoice.currency} ${formatMoney(amount)}</td>
        <td>${invoice.currency} ${(parseFloat(String(invoice.total)) - parseFloat(String(invoice.amountPaid))).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${payment.notes ? `<div style="margin-top: 20px; padding: 12px; background: #fffbeb; border-radius: 8px; font-size: 12px;"><strong>Notes:</strong> ${payment.notes}</div>` : ''}

  <div class="footer">
    <p>Thank you for your payment</p>
    <p>${s?.businessName || ''}</p>
  </div>
</div>
</body></html>`;

  return renderPdf(html);
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
