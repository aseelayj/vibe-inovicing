export function formatInvoiceNumber(
  prefix: string,
  num: number,
): string {
  return `${prefix}-${String(num).padStart(4, '0')}`;
}
