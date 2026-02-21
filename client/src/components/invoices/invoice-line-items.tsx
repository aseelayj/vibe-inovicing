import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

export function InvoiceLineItems() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const watchedItems = watch('lineItems');
  const currency = watch('currency') || 'USD';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            append({ description: '', quantity: 1, unitPrice: 0 })
          }
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-500">No line items yet.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              append({ description: '', quantity: 1, unitPrice: 0 })
            }
          >
            <Plus className="h-4 w-4" />
            Add your first item
          </Button>
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <div className="col-span-5">Description</div>
            <div className="col-span-2">Quantity</div>
            <div className="col-span-2">Unit Price</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-1" />
          </div>

          {fields.map((field, index) => {
            const qty = Number(watchedItems?.[index]?.quantity) || 0;
            const price = Number(watchedItems?.[index]?.unitPrice) || 0;
            const amount = qty * price;
            const lineErrors = (errors.lineItems as Record<string, unknown>)?.[
              index
            ] as Record<string, { message?: string }> | undefined;

            return (
              <div key={field.id} className="grid grid-cols-12 items-start gap-3">
                <div className="col-span-5">
                  <Input
                    placeholder="Item description"
                    error={lineErrors?.description?.message}
                    {...register(`lineItems.${index}.description`)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="1"
                    error={lineErrors?.quantity?.message}
                    {...register(`lineItems.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    error={lineErrors?.unitPrice?.message}
                    {...register(`lineItems.${index}.unitPrice`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="col-span-2 flex h-10 items-center justify-end text-sm font-medium text-gray-700">
                  {formatCurrency(amount, currency)}
                </div>
                <div className="col-span-1 flex h-10 items-center justify-center">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {typeof errors.lineItems?.message === 'string' && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {errors.lineItems.message}
        </p>
      )}
    </div>
  );
}
