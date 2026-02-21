import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';

export function InvoiceLineItems() {
  const { t } = useTranslation('common');
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
        <h3 className="text-sm font-semibold">{t('lineItems')}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            append({ description: '', quantity: 1, unitPrice: 0 })
          }
        >
          <Plus className="h-4 w-4" />
          {t('addItem')}
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="rounded-lg border-2 border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground">{t('noLineItems')}</p>
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
            {t('addFirstItem')}
          </Button>
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-5">{t('description')}</div>
            <div className="col-span-2">{t('quantity')}</div>
            <div className="col-span-2">{t('unitPrice')}</div>
            <div className="col-span-2 text-right">{t('amount')}</div>
            <div className="col-span-1" />
          </div>

          {fields.map((field, index) => {
            const qty = Number(watchedItems?.[index]?.quantity) || 0;
            const price = Number(watchedItems?.[index]?.unitPrice) || 0;
            const amount = qty * price;
            const lineErrors = (
              errors.lineItems as Record<string, unknown>
            )?.[index] as
              | Record<string, { message?: string }>
              | undefined;

            return (
              <div
                key={field.id}
                className="grid grid-cols-12 items-start gap-3"
              >
                <div className="col-span-5">
                  <Input
                    placeholder={t('itemDescription')}
                    aria-invalid={!!lineErrors?.description}
                    {...register(`lineItems.${index}.description`)}
                  />
                  {lineErrors?.description?.message && (
                    <p className="mt-1 text-xs text-destructive">
                      {lineErrors.description.message}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="1"
                    aria-invalid={!!lineErrors?.quantity}
                    {...register(`lineItems.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                  {lineErrors?.quantity?.message && (
                    <p className="mt-1 text-xs text-destructive">
                      {lineErrors.quantity.message}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    aria-invalid={!!lineErrors?.unitPrice}
                    {...register(`lineItems.${index}.unitPrice`, {
                      valueAsNumber: true,
                    })}
                  />
                  {lineErrors?.unitPrice?.message && (
                    <p className="mt-1 text-xs text-destructive">
                      {lineErrors.unitPrice.message}
                    </p>
                  )}
                </div>
                <div className="col-span-2 flex h-9 items-center justify-end text-sm font-medium">
                  {formatCurrency(amount, currency)}
                </div>
                <div className="col-span-1 flex h-9 items-center justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => remove(index)}
                    aria-label={t('removeItem')}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {typeof errors.lineItems?.message === 'string' && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {errors.lineItems.message}
        </p>
      )}
    </div>
  );
}
