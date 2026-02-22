import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addDays } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createInvoiceSchema, CURRENCIES } from '@vibe/shared';
import type { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InvoiceLineItems } from '@/components/invoices/invoice-line-items';
import { InvoicePreview } from '@/components/invoices/invoice-preview';
import { ClientPicker } from '@/components/clients/client-picker';
import { useSettings } from '@/hooks/use-settings';

type InvoiceFormValues = z.infer<typeof createInvoiceSchema>;

export type InvoiceAction = 'draft' | 'publish' | 'send' | 'write_off';

export interface InvoiceFormProps {
  defaultValues?: Partial<InvoiceFormValues> & { clientName?: string };
  onSubmit: (data: InvoiceFormValues, action: InvoiceAction) => void;
  isLoading?: boolean;
}

export function InvoiceForm({
  defaultValues,
  onSubmit,
  isLoading,
}: InvoiceFormProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');
  const { data: appSettings } = useSettings();
  const configuredTaxRate = appSettings?.defaultTaxRate || 16;
  const [submitAction, setSubmitAction] = useState<InvoiceAction>('draft');

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
      isTaxable: defaultValues?.isTaxable ?? false,
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
  const isTaxable = watch('isTaxable') ?? false;
  const taxRate = isTaxable ? configuredTaxRate : 0;
  const discount = Number(watch('discountAmount')) || 0;

  const subtotal = watchedItems.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const taxAmount = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + taxAmount;

  const handleFormSubmit = (data: InvoiceFormValues) => {
    onSubmit(data, submitAction);
  };

  const formatCurrencyValue = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>{t('invoiceDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="isTaxable" className="text-sm font-medium">
                      {t('subjectToTax')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isTaxable
                        ? t('taxableDescription')
                        : t('exemptDescription')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    id="isTaxable"
                    aria-checked={isTaxable}
                    onClick={() => {
                      const next = !isTaxable;
                      setValue('isTaxable', next, { shouldDirty: true });
                      setValue('taxRate', next ? configuredTaxRate : 0);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      isTaxable ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                        isTaxable ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <ClientPicker
                  value={watch('clientId') ?? null}
                  onChange={(clientId) => setValue('clientId', clientId)}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">{t('issueDate')}</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      aria-invalid={!!errors.issueDate}
                      {...register('issueDate')}
                    />
                    {errors.issueDate && (
                      <p className="text-sm text-destructive">
                        {errors.issueDate.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">{t('dueDate')}</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      aria-invalid={!!errors.dueDate}
                      {...register('dueDate')}
                    />
                    {errors.dueDate && (
                      <p className="text-sm text-destructive">
                        {errors.dueDate.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{tc('currency')}</Label>
                  <Select
                    value={currency}
                    onValueChange={(val) =>
                      setValue(
                        'currency',
                        val as InvoiceFormValues['currency'],
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectCurrency')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.currency && (
                    <p className="text-sm text-destructive">
                      {errors.currency.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <InvoiceLineItems />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tc('summary')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">{t('taxRatePercent')}</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      value={taxRate}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('taxRateHint')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountAmount">{t('discountAmount')}</Label>
                    <Input
                      id="discountAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      aria-invalid={!!errors.discountAmount}
                      {...register('discountAmount', {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.discountAmount && (
                      <p className="text-sm text-destructive">
                        {errors.discountAmount.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 space-y-2 pt-4">
                  <Separator />
                  <div className="flex justify-between pt-2 text-sm">
                    <span className="text-muted-foreground">{tc('subtotal')}</span>
                    <span>{formatCurrencyValue(subtotal)}</span>
                  </div>
                  {isTaxable && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tc('tax')} ({taxRate}%)
                      </span>
                      <span>{formatCurrencyValue(taxAmount)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{tc('discount')}</span>
                      <span className="text-destructive">
                        -{formatCurrencyValue(discount)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between pt-2 text-base font-bold">
                    <span>{tc('total')}</span>
                    <span>{formatCurrencyValue(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('additionalInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">{tc('notes')}</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder={t('notesPlaceholder')}
                    {...register('notes')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terms">{t('termsAndConditions')}</Label>
                  <Textarea
                    id="terms"
                    rows={3}
                    placeholder={t('termsPlaceholder')}
                    {...register('terms')}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="submit"
                variant="secondary"
                disabled={isLoading}
                onClick={() => setSubmitAction('draft')}
              >
                {isLoading && submitAction === 'draft'
                  ? tc('saving')
                  : t('saveAsDraft')}
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                onClick={() => setSubmitAction('publish')}
              >
                {isLoading && submitAction === 'publish'
                  ? t('publishing')
                  : t('saveAndPublish')}
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={isLoading}
                onClick={() => setSubmitAction('send')}
              >
                {isLoading && submitAction === 'send'
                  ? t('sending')
                  : t('saveAndSendEmail')}
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={isLoading}
                onClick={() => setSubmitAction('write_off')}
                className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
              >
                {isLoading && submitAction === 'write_off'
                  ? tc('saving')
                  : t('saveAsWriteOff')}
              </Button>
            </div>
          </div>

          <div className="hidden xl:col-span-2 xl:block">
            <div className="sticky top-24">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {t('livePreview')}
              </h3>
              <InvoicePreview />
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
