/**
 * Bank Al Etihad API Discovery Script
 *
 * Launches a visible Chrome window to the bank portal.
 * You log in manually (credentials + OTP) and browse around.
 * The script silently captures all XHR/Fetch API calls via CDP.
 *
 * On Ctrl+C it writes a JSON report and prints a summary table.
 *
 * Usage: npx tsx server/src/scripts/bank-api-discovery.ts
 */

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_URL = 'https://business.bankaletihad.com/en';
const REPORT_PATH = resolve(__dirname, 'bank-api-report.json');

// Extensions to skip (static assets, analytics, etc.)
const SKIP_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)/i;
const SKIP_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'hotjar.com',
  'clarity.ms',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

interface CapturedRequest {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseStatus: number | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  timestamp: string;
}

const captured: CapturedRequest[] = [];
const urlCounts = new Map<string, { method: string; count: number; hasAuth: boolean }>();

function shouldSkip(url: string): boolean {
  if (SKIP_EXTENSIONS.test(url)) return true;
  try {
    const hostname = new URL(url).hostname;
    return SKIP_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

function getAuthHeader(headers: Record<string, string>): string | null {
  for (const [key, val] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (
      lower === 'authorization'
      || lower === 'x-auth-token'
      || lower === 'x-csrf-token'
      || lower === 'x-xsrf-token'
    ) {
      return `${key}: ${val.slice(0, 30)}...`;
    }
  }
  // Check cookies for session tokens
  if (headers['cookie'] || headers['Cookie']) {
    return 'Cookie (session)';
  }
  return null;
}

function printSummary() {
  console.log('\n' + '='.repeat(100));
  console.log('  API DISCOVERY REPORT');
  console.log('='.repeat(100));
  console.log(
    `\n  Total captured API calls: ${captured.length}`,
  );
  console.log(`  Unique endpoints: ${urlCounts.size}\n`);

  // Print summary table
  console.log(
    '  METHOD  | COUNT | AUTH            | URL',
  );
  console.log('  ' + '-'.repeat(96));

  const sorted = [...urlCounts.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  );
  for (const [url, info] of sorted) {
    const method = info.method.padEnd(7);
    const count = String(info.count).padStart(5);
    const auth = info.hasAuth ? 'Yes' : 'No ';
    console.log(`  ${method} | ${count} | ${auth.padEnd(15)} | ${url}`);
  }

  // Highlight auth-related endpoints
  const authEndpoints = captured.filter((r) => {
    const lower = r.url.toLowerCase();
    return (
      lower.includes('login')
      || lower.includes('auth')
      || lower.includes('otp')
      || lower.includes('token')
      || lower.includes('session')
      || lower.includes('verify')
    );
  });

  if (authEndpoints.length > 0) {
    console.log('\n  AUTH-RELATED ENDPOINTS:');
    console.log('  ' + '-'.repeat(96));
    const seen = new Set<string>();
    for (const r of authEndpoints) {
      const key = `${r.method} ${r.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  ${r.method.padEnd(7)} | ${r.url}`);
      if (r.requestBody) {
        try {
          const body = JSON.parse(r.requestBody);
          const keys = Object.keys(body);
          console.log(`          | Request keys: ${keys.join(', ')}`);
        } catch {
          console.log(`          | Request body: ${r.requestBody.slice(0, 100)}`);
        }
      }
      if (r.responseBody) {
        try {
          const body = JSON.parse(r.responseBody);
          const keys = Object.keys(body);
          console.log(`          | Response keys: ${keys.join(', ')}`);
        } catch {
          console.log(`          | Response: (non-JSON)`);
        }
      }
    }
  }

  // Write full report
  writeFileSync(REPORT_PATH, JSON.stringify(captured, null, 2), 'utf-8');
  console.log(`\n  Full report saved to: ${REPORT_PATH}`);
  console.log('='.repeat(100) + '\n');
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  Bank Al Etihad - API Discovery Tool');
  console.log('='.repeat(70));
  console.log(`
  This script will open a Chrome window to the bank portal.

  INSTRUCTIONS:
  1. Log in with your credentials (username + password)
  2. Complete OTP verification when prompted
  3. Browse to: Account details, Transaction history, Transfers
  4. Try different date ranges for transaction lists
  5. When done, press Ctrl+C to see the API report

  All API calls will be silently captured in the background.
`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const page = await browser.newPage();

  // Create a CDP session for network interception
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');

  // Track pending requests
  const pendingRequests = new Map<string, CapturedRequest>();

  cdp.on('Network.requestWillBeSent', (params: any) => {
    const { requestId, request } = params;
    const { url, method, headers, postData } = request;

    if (shouldSkip(url)) return;

    // Only capture XHR/Fetch (skip document/stylesheet/script)
    const type = params.type;
    if (type === 'Document' || type === 'Stylesheet' || type === 'Script'
      || type === 'Image' || type === 'Font') {
      return;
    }

    const entry: CapturedRequest = {
      method,
      url,
      requestHeaders: headers || {},
      requestBody: postData || null,
      responseStatus: null,
      responseHeaders: {},
      responseBody: null,
      timestamp: new Date().toISOString(),
    };

    pendingRequests.set(requestId, entry);
  });

  cdp.on('Network.responseReceived', (params: any) => {
    const { requestId, response } = params;
    const entry = pendingRequests.get(requestId);
    if (!entry) return;

    entry.responseStatus = response.status;
    entry.responseHeaders = response.headers || {};

    // Try to get response body asynchronously
    cdp.send('Network.getResponseBody', { requestId })
      .then((result: any) => {
        entry.responseBody = result.body || null;
      })
      .catch(() => {
        // Response body might not be available
      });
  });

  cdp.on('Network.loadingFinished', (params: any) => {
    const { requestId } = params;
    const entry = pendingRequests.get(requestId);
    if (!entry) return;

    // Finalize: try to get response body one more time, then store
    cdp.send('Network.getResponseBody', { requestId })
      .then((result: any) => {
        if (result.body) entry.responseBody = result.body;
      })
      .catch(() => {})
      .finally(() => {
        captured.push(entry);
        pendingRequests.delete(requestId);

        // Update URL counter
        const key = entry.url.replace(/\?.*/, ''); // strip query params for counting
        const existing = urlCounts.get(key);
        const hasAuth = !!getAuthHeader(entry.requestHeaders);
        if (existing) {
          existing.count++;
          if (hasAuth) existing.hasAuth = true;
        } else {
          urlCounts.set(key, { method: entry.method, count: 1, hasAuth });
        }

        // Print live log (full URL, no truncation)
        const statusStr = entry.responseStatus
          ? `[${entry.responseStatus}]`
          : '[---]';
        const authStr = hasAuth ? ' [AUTH]' : '';
        console.log(
          `  ${statusStr} ${entry.method.padEnd(6)} ${entry.url}${authStr}`,
        );
      });
  });

  // Handle graceful shutdown
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Flush any pending requests
    for (const [, entry] of pendingRequests) {
      captured.push(entry);
    }

    printSummary();

    try {
      await browser.close();
    } catch {
      // browser might already be closed
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Navigate to bank portal
  console.log(`  Navigating to ${BANK_URL}...\n`);
  await page.goto(BANK_URL, { waitUntil: 'domcontentloaded' });
  console.log('  Page loaded. Capturing API calls...\n');

  // Keep running until browser is closed or Ctrl+C
  browser.on('disconnected', () => {
    if (!isShuttingDown) {
      printSummary();
      process.exit(0);
    }
  });

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
