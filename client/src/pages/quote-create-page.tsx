import { useNavigate } from 'react-router';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addDays } from 'date-fns';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { createQuoteSchema, CURRENCIES } from '@vibe/shared';
import type { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ClientPicker } from '@/components/clients/client-picker';
import { useCreateQuote } from '@/hooks/use-quotes';
import { formatCurrency } from '@/lib/format';

type QuoteFormValues = z.infer<typeof createQuoteSchema>;

export function QuoteCreatePage() {
  const navigate = useNavigate();
  const createQuote = useCreateQuote();

  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultExpiry = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const methods = useForm<QuoteFormValues>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      clientId: null,
      issueDate: today,
      expiryDate: defaultExpiry,
      currency: 'USD',
      taxRate: 0,
      discountAmount: 0,
      notes: '',
      terms: '',
      lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const watchedItems = watch('lineItems') || [];
  const currency = watch('currency') || 'USD';
  const taxRate = Number(watch('taxRate')) || 0;
  const discount = Number(watch('discountAmount')) || 0;

  const subtotal = watchedItems.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const onSubmit = async (data: QuoteFormValues) => {
    try {
      const quote = await createQuote.mutateAsync(data as Record<string, unknown>);
      navigate(`/quotes/${quote.id}`);
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/quotes"
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Create Quote</h2>
          <p className="mt-1 text-sm text-gray-500">
            Fill in the details for a new quote
          </p>
        </div>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Quote Details
            </h3>
            <div className="space-y-4">
              <ClientPicker
                value={watch('clientId') ?? null}
                onChange={(clientId) => setValue('clientId', clientId)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Issue Date"
                  type="date"
                  error={errors.issueDate?.message}
                  {...register('issueDate')}
                />
                <Input
                  label="Expiry Date"
                  type="date"
                  error={errors.expiryDate?.message}
                  {...register('expiryDate')}
                />
              </div>
              <Select
                label="Currency"
                error={errors.currency?.message}
                {...register('currency')}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Line Items
              </h3>
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
                  const qty = Number(watchedItems[index]?.quantity) || 0;
                  const price = Number(watchedItems[index]?.unitPrice) || 0;
                  const amount = qty * price;

                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-12 items-start gap-3"
                    >
                      <div className="col-span-5">
                        <Input
                          placeholder="Item description"
                          {...register(`lineItems.${index}.description`)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="1"
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

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tax Rate (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                {...register('taxRate', { valueAsNumber: true })}
              />
              <Input
                label="Discount Amount"
                type="number"
                min="0"
                step="0.01"
                {...register('discountAmount', { valueAsNumber: true })}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2 border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount, currency)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-red-600">
                      -{formatCurrency(discount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Additional Info
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="notes"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Notes visible to the client..."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  {...register('notes')}
                />
              </div>
              <div>
                <label
                  htmlFor="terms"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Terms & Conditions
                </label>
                <textarea
                  id="terms"
                  rows={3}
                  placeholder="Terms and conditions..."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  {...register('terms')}
                />
              </div>
            </div>
          </div>

          <Button type="submit" loading={createQuote.isPending}>
            Save Quote
          </Button>
        </form>
      </FormProvider>
    </div>
  );
}
