import type { TransactionType, TransactionCategory } from '@vibe/shared';

const PAYPAL_URLS = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
} as const;

type PayPalEnv = keyof typeof PAYPAL_URLS;

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalTransactionDetail {
  transaction_info: {
    transaction_id: string;
    transaction_event_code: string;
    transaction_initiation_date: string;
    transaction_updated_date: string;
    transaction_amount: {
      currency_code: string;
      value: string;
    };
    fee_amount?: {
      currency_code: string;
      value: string;
    };
    transaction_status: string;
    transaction_subject?: string;
    transaction_note?: string;
  };
  payer_info?: {
    email_address?: string;
    payer_name?: { given_name?: string; surname?: string };
    account_id?: string;
  };
  cart_info?: {
    item_details?: Array<{
      item_name?: string;
      item_description?: string;
    }>;
  };
}

interface PayPalTransactionsResponse {
  transaction_details: PayPalTransactionDetail[];
  total_items: number;
  total_pages: number;
  page: number;
  links: Array<{ href: string; rel: string }>;
}

export interface MappedTransaction {
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  date: string;
  description: string;
  notes: string | null;
  bankReference: string;
  supplierName: string | null;
  isFromBank: true;
  bankSyncedAt: Date;
}

/**
 * Get a PayPal OAuth2 access token using client credentials.
 */
export async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  environment: PayPalEnv,
): Promise<{ accessToken: string; expiresIn: number }> {
  const base = PAYPAL_URLS[environment];
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `PayPal auth failed (${res.status}): ${body}`,
    );
  }

  const data: PayPalTokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Fetch transactions from PayPal Reporting API for a given date range.
 * Returns all pages concatenated.
 */
export async function fetchPayPalTransactions(
  accessToken: string,
  environment: PayPalEnv,
  startDate: string,
  endDate: string,
): Promise<PayPalTransactionDetail[]> {
  const base = PAYPAL_URLS[environment];
  const allTransactions: PayPalTransactionDetail[] = [];

  // PayPal limits date ranges to 31 days
  const chunks = splitDateRange(startDate, endDate);

  for (const { start, end } of chunks) {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const params = new URLSearchParams({
        start_date: `${start}T00:00:00-0000`,
        end_date: `${end}T23:59:59-0000`,
        page_size: '100',
        page: String(page),
        fields: 'transaction_info,payer_info,cart_info',
      });

      const res = await fetch(
        `${base}/v1/reporting/transactions?${params}`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        },
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `PayPal transactions fetch failed (${res.status}): ${body}`,
        );
      }

      const data: PayPalTransactionsResponse = await res.json();
      allTransactions.push(...(data.transaction_details ?? []));
      totalPages = data.total_pages || 1;
      page++;
    }
  }

  return allTransactions;
}

/**
 * Map a PayPal transaction to our local transaction schema.
 */
export function mapPayPalTransactionToLocal(
  txn: PayPalTransactionDetail,
): MappedTransaction | null {
  const info = txn.transaction_info;

  // Skip non-completed transactions
  if (info.transaction_status !== 'S') return null;

  const rawAmount = parseFloat(info.transaction_amount.value);
  if (isNaN(rawAmount) || rawAmount === 0) return null;

  const isIncome = rawAmount > 0;
  const amount = Math.abs(rawAmount);

  // Build description from available info
  const payerName = txn.payer_info?.payer_name
    ? [txn.payer_info.payer_name.given_name, txn.payer_info.payer_name.surname]
      .filter(Boolean).join(' ')
    : null;
  const itemName = txn.cart_info?.item_details?.[0]?.item_name;
  const subject = info.transaction_subject;

  const descParts = [
    subject || itemName || (isIncome ? 'PayPal payment received' : 'PayPal payment sent'),
    payerName ? `(${payerName})` : null,
  ].filter(Boolean);

  const feeNote = info.fee_amount
    ? `PayPal fee: ${info.fee_amount.value} ${info.fee_amount.currency_code}`
    : null;

  return {
    type: isIncome ? 'income' : 'expense',
    category: isIncome ? 'invoice_payment' : 'other' as TransactionCategory,
    amount,
    date: info.transaction_initiation_date.split('T')[0],
    description: descParts.join(' ').slice(0, 500),
    notes: [info.transaction_note, feeNote].filter(Boolean).join(' | ') || null,
    bankReference: info.transaction_id,
    supplierName: isIncome ? null : (payerName || null),
    isFromBank: true,
    bankSyncedAt: new Date(),
  };
}

/**
 * Split a date range into 31-day chunks (PayPal API limit).
 */
export function splitDateRange(
  startDate: string,
  endDate: string,
): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  const end = new Date(endDate);
  let current = new Date(startDate);

  while (current <= end) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + 30);

    const actualEnd = chunkEnd > end ? end : chunkEnd;

    chunks.push({
      start: current.toISOString().split('T')[0],
      end: actualEnd.toISOString().split('T')[0],
    });

    current = new Date(actualEnd);
    current.setDate(current.getDate() + 1);
  }

  return chunks;
}
