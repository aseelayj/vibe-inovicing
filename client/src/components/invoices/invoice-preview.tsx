import { useFormContext } from 'react-hook-form';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, formatDate } from '@/lib/format';

export function InvoicePreview() {
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
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {settings?.businessName || 'Your Business'}
          </h2>
          {settings?.businessEmail && (
            <p className="mt-1 text-sm text-gray-500">
              {settings.businessEmail}
            </p>
          )}
          {settings?.businessPhone && (
            <p className="text-sm text-gray-500">{settings.businessPhone}</p>
          )}
          {settings?.businessAddress && (
            <p className="text-sm text-gray-500">{settings.businessAddress}</p>
          )}
        </div>
        <div className="text-right">
          <h3 className="text-2xl font-bold text-primary-500">INVOICE</h3>
          <p className="mt-1 text-sm text-gray-500">Draft</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Bill To
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {values.clientName || 'Select a client'}
          </p>
        </div>
        <div className="space-y-2 text-right">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Issue Date
            </p>
            <p className="text-sm text-gray-700">
              {values.issueDate ? formatDate(values.issueDate) : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Due Date
            </p>
            <p className="text-sm text-gray-700">
              {values.dueDate ? formatDate(values.dueDate) : '--'}
            </p>
          </div>
        </div>
      </div>

      <table className="mb-8 w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              Description
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
              Qty
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
              Price
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-gray-400">
                No line items
              </td>
            </tr>
          ) : (
            lineItems.map(
              (
                item: { description?: string; quantity?: number; unitPrice?: number },
                i: number,
              ) => {
                const qty = Number(item.quantity) || 0;
                const price = Number(item.unitPrice) || 0;
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-700">
                      {item.description || 'Untitled item'}
                    </td>
                    <td className="py-2 text-right text-gray-600">{qty}</td>
                    <td className="py-2 text-right text-gray-600">
                      {formatCurrency(price, currency)}
                    </td>
                    <td className="py-2 text-right font-medium text-gray-700">
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
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-700">
              {formatCurrency(subtotal, currency)}
            </span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax ({taxRate}%)</span>
              <span className="text-gray-700">
                {formatCurrency(taxAmount, currency)}
              </span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span className="text-red-600">
                -{formatCurrency(discountAmount, currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">
              {formatCurrency(total, currency)}
            </span>
          </div>
        </div>
      </div>

      {values.notes && (
        <div className="mt-8 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
            {values.notes}
          </p>
        </div>
      )}

      {values.terms && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Terms
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
            {values.terms}
          </p>
        </div>
      )}
    </div>
  );
}
