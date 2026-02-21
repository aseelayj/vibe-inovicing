import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addDays } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { createInvoiceSchema, CURRENCIES } from '@vibe/shared';
import type { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { InvoiceLineItems } from '@/components/invoices/invoice-line-items';
import { InvoicePreview } from '@/components/invoices/invoice-preview';
import { ClientPicker } from '@/components/clients/client-picker';
import { AiGenerateDialog } from '@/components/ai/ai-generate-dialog';

type InvoiceFormValues = z.infer<typeof createInvoiceSchema>;

export interface InvoiceFormProps {
  defaultValues?: Partial<InvoiceFormValues> & { clientName?: string };
  onSubmit: (data: InvoiceFormValues, action: 'draft' | 'send') => void;
  isLoading?: boolean;
}

export function InvoiceForm({
  defaultValues,
  onSubmit,
  isLoading,
}: InvoiceFormProps) {
  const [showAi, setShowAi] = useState(false);
  const [submitAction, setSubmitAction] = useState<'draft' | 'send'>('draft');

  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultDue = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      clientId: defaultValues?.clientId ?? null,
      issueDate: defaultValues?.issueDate ?? today,
      dueDate: defaultValues?.dueDate ?? defaultDue,
      currency: defaultValues?.currency ?? 'USD',
      taxRate: defaultValues?.taxRate ?? 0,
      discountAmount: defaultValues?.discountAmount ?? 0,
      notes: defaultValues?.notes ?? '',
      terms: defaultValues?.terms ?? '',
      lineItems: defaultValues?.lineItems ?? [
        { description: '', quantity: 1, unitPrice: 0 },
      ],
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = methods;

  const watchedItems = watch('lineItems') || [];
  const currency = watch('currency') || 'USD';
  const taxRate = Number(watch('taxRate')) || 0;
  const discount = Number(watch('discountAmount')) || 0;

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  const handleFormSubmit = (data: InvoiceFormValues) => {
    onSubmit(data, submitAction);
  };

  const handleAiResult = (result: {
    clientId: number | null;
    clientName: string;
    lineItems: { description: string; quantity: number; unitPrice: number }[];
    notes: string;
    dueInDays: number;
    currency: string;
  }) => {
    if (result.clientId) {
      setValue('clientId', result.clientId);
    }
    if (result.lineItems?.length) {
      setValue('lineItems', result.lineItems);
    }
    if (result.notes) {
      setValue('notes', result.notes);
    }
    if (result.dueInDays) {
      setValue('dueDate', format(addDays(new Date(), result.dueInDays), 'yyyy-MM-dd'));
    }
    if (result.currency) {
      setValue('currency', result.currency as InvoiceFormValues['currency']);
    }
    setShowAi(false);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">
                  Invoice Details
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAi(true)}
                >
                  <Sparkles className="h-4 w-4 text-primary-500" />
                  AI Generate
                </Button>
              </div>

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
                    label="Due Date"
                    type="date"
                    error={errors.dueDate?.message}
                    {...register('dueDate')}
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
              <InvoiceLineItems />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                Summary
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Tax Rate (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  error={errors.taxRate?.message}
                  {...register('taxRate', { valueAsNumber: true })}
                />
                <Input
                  label="Discount Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  error={errors.discountAmount?.message}
                  {...register('discountAmount', { valueAsNumber: true })}
                />
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-700">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency,
                    }).format(subtotal)}
                  </span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({taxRate}%)</span>
                    <span className="text-gray-700">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency,
                      }).format(taxAmount)}
                    </span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-red-600">
                      -{new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency,
                      }).format(discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                  <span>Total</span>
                  <span>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency,
                    }).format(total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                Additional Info
              </h2>
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
                    placeholder="Payment terms, late fees, etc..."
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    {...register('terms')}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                variant="secondary"
                loading={isLoading && submitAction === 'draft'}
                disabled={isLoading}
                onClick={() => setSubmitAction('draft')}
              >
                Save as Draft
              </Button>
              <Button
                type="submit"
                loading={isLoading && submitAction === 'send'}
                disabled={isLoading}
                onClick={() => setSubmitAction('send')}
              >
                Save & Send
              </Button>
            </div>
          </div>

          <div className="hidden xl:col-span-2 xl:block">
            <div className="sticky top-24">
              <h3 className="mb-3 text-sm font-semibold text-gray-500">
                Live Preview
              </h3>
              <InvoicePreview />
            </div>
          </div>
        </div>
      </form>

      <AiGenerateDialog
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        onResult={handleAiResult}
      />
    </FormProvider>
  );
}
