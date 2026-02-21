import { format, formatDistanceToNow } from 'date-fns';

export function formatCurrency(
  amount: number,
  currency = 'USD',
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'MM/dd/yyyy');
}

export function formatTimeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatInvoiceNumber(
  prefix: string,
  num: number,
): string {
  return `${prefix}-${String(num).padStart(4, '0')}`;
}
