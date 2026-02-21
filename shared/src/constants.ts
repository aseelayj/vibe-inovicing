export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled',
] as const;

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
] as const;

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'credit_card',
  'check',
  'other',
] as const;

export const RECURRING_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD',
  'JPY', 'CHF', 'SAR', 'AED', 'JOD',
] as const;

export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export type QuoteStatus = typeof QUOTE_STATUSES[number];
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type RecurringFrequency = typeof RECURRING_FREQUENCIES[number];
export type Currency = typeof CURRENCIES[number];
