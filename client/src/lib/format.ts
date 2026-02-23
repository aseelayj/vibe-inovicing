import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import i18n from '@/lib/i18n';

function getLocale() {
  return i18n.language === 'ar' ? 'ar' : 'en-US';
}

function getDateFnsLocale() {
  return i18n.language === 'ar' ? { locale: ar } : {};
}

/** Ensure timestamp strings without timezone are treated as UTC */
function parseDate(date: string | Date | null | undefined): Date {
  if (!date) return new Date(NaN);
  if (date instanceof Date) return date;
  if (typeof date !== 'string' || date.trim() === '') return new Date(NaN);
  // If the string has no timezone indicator, append Z to treat as UTC
  if (!date.endsWith('Z') && !date.includes('+') && !/\d{2}:\d{2}$/.test(date)) {
    return new Date(date + 'Z');
  }
  return new Date(date);
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'USD',
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = parseDate(date);
  if (isNaN(d.getTime())) return '--';
  return format(d, 'MMM d, yyyy', getDateFnsLocale());
}

export function formatDateShort(date: string | Date | null | undefined): string {
  const d = parseDate(date);
  if (isNaN(d.getTime())) return '--';
  return format(d, 'MM/dd/yyyy', getDateFnsLocale());
}

export function formatTimeAgo(date: string | Date | null | undefined): string {
  const d = parseDate(date);
  if (isNaN(d.getTime())) return '--';
  return formatDistanceToNow(d, {
    addSuffix: true,
    ...getDateFnsLocale(),
  });
}

export function formatInvoiceNumber(
  prefix: string,
  num: number,
): string {
  return `${prefix}-${String(num).padStart(4, '0')}`;
}
