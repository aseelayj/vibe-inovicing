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

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
