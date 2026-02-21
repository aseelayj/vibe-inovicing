import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import i18n from '@/lib/i18n';

function getLocale() {
  return i18n.language === 'ar' ? 'ar' : 'en-US';
}

function getDateFnsLocale() {
  return i18n.language === 'ar' ? { locale: ar } : {};
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

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy', getDateFnsLocale());
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'MM/dd/yyyy', getDateFnsLocale());
}

export function formatTimeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), {
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
