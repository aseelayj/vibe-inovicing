import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function InvoicePreview() {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');
  const { watch } = useFormContext();
  const { data: settings } = useSettings();

  const values = watch();
  const lineItems = values.lineItems || [];
  const currency = values.currency || 'USD';

  const subtotal = lineItems.reduce(
    (sum: number, item: { quantity?: number; unitPrice?: number }) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    },
    0,
  );

  const taxRate = Number(values.taxRate) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const discountAmount = Number(values.discountAmount) || 0;
  const total = subtotal + taxAmount - discountAmount;

  return (
    <Card>
      <CardContent className="p-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {settings?.businessName || t('yourBusiness')}
            </h2>
            {settings?.businessEmail && (
              <p className="mt-1 text-sm text-muted-foreground">
                {settings.businessEmail}
              </p>
            )}
            {settings?.businessPhone && (
              <p className="text-sm text-muted-foreground">
                {settings.businessPhone}
              </p>
            )}
            {settings?.businessAddress && (
              <p className="text-sm text-muted-foreground">
                {settings.businessAddress}
              </p>
            )}
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-bold text-primary">{t('invoice')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('draft')}</p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('billTo')}
            </p>
            <p className="mt-1 text-sm font-medium">
              {values.clientName || t('selectAClient')}
            </p>
          </div>
          <div className="space-y-2 text-right">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('issueDate')}
              </p>
              <p className="text-sm">
                {values.issueDate ? formatDate(values.issueDate) : '--'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('dueDate')}
              </p>
              <p className="text-sm">
                {values.dueDate ? formatDate(values.dueDate) : '--'}
              </p>
            </div>
          </div>
        </div>

        <table className="mb-8 w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tc('description')}
              </th>
              <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tc('qty')}
              </th>
              <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tc('price')}
              </th>
              <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tc('amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 text-center text-muted-foreground"
                >
                  {tc('noLineItems')}
                </td>
              </tr>
            ) : (
              lineItems.map(
                (
                  item: {
                    description?: string;
                    quantity?: number;
                    unitPrice?: number;
                  },
                  i: number,
                ) => {
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.unitPrice) || 0;
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2">
                        {item.description || tc('untitledItem')}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {qty}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {formatCurrency(price, currency)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(qty * price, currency)}
                      </td>
                    </tr>
                  );
                },
              )
            )}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{tc('subtotal')}</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {tc('tax')} ({taxRate}%)
                </span>
                <span>{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{tc('discount')}</span>
                <span className="text-destructive">
                  -{formatCurrency(discountAmount, currency)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>{tc('total')}</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>

        {values.notes && (
          <div className="mt-8 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tc('notes')}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {values.notes}
            </p>
          </div>
        )}

        {values.terms && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tc('terms')}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {values.terms}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
