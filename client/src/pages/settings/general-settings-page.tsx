import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { CURRENCIES } from '@vibe/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';

interface GeneralFormValues {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  taxId: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  defaultPaymentTerms: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  exemptInvoicePrefix: string;
  nextExemptInvoiceNumber: number;
  writeOffPrefix: string;
  nextWriteOffNumber: number;
  quotePrefix: string;
  nextQuoteNumber: number;
  numberSeparator: string;
  numberPadding: number;
}

function NumberPreview({ prefix, nextNum, separator, padding }: {
  prefix: string; nextNum: number; separator: string; padding: number;
}) {
  const formatted = `${prefix}${separator}${String(nextNum).padStart(padding, '0')}`;
  return (
    <span className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
      {formatted}
    </span>
  );
}

export function GeneralSettingsPage() {
  const { t } = useTranslation('settings');
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<GeneralFormValues>();

  useEffect(() => {
    if (settings) {
      reset({
        businessName: settings.businessName || '',
        businessEmail: settings.businessEmail || '',
        businessPhone: settings.businessPhone || '',
        businessAddress: settings.businessAddress || '',
        taxId: settings.taxId || '',
        defaultCurrency: settings.defaultCurrency || 'USD',
        defaultTaxRate: settings.defaultTaxRate || 0,
        defaultPaymentTerms: settings.defaultPaymentTerms || 30,
        invoicePrefix: settings.invoicePrefix || 'INV',
        nextInvoiceNumber: settings.nextInvoiceNumber || 1,
        exemptInvoicePrefix: settings.exemptInvoicePrefix || 'EINV',
        nextExemptInvoiceNumber: settings.nextExemptInvoiceNumber || 1,
        writeOffPrefix: (settings as any).writeOffPrefix || 'WO',
        nextWriteOffNumber: (settings as any).nextWriteOffNumber || 1,
        quotePrefix: settings.quotePrefix || 'QUO',
        nextQuoteNumber: settings.nextQuoteNumber || 1,
        numberSeparator: (settings as any).numberSeparator || '-',
        numberPadding: (settings as any).numberPadding || 4,
      });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingSpinner />;

  const onSubmit = (data: GeneralFormValues) => {
    updateSettings.mutate(data as Record<string, unknown>);
  };

  const sep = watch('numberSeparator') || '-';
  const pad = watch('numberPadding') || 4;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('businessInfo')}</CardTitle>
          <CardDescription>{t('businessInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">{t('businessName')}</Label>
            <Input
              id="businessName"
              placeholder={t('businessNamePlaceholder')}
              {...register('businessName', {
                required: t('businessNameRequired'),
              })}
            />
            {errors.businessName?.message && (
              <p className="text-sm text-destructive">
                {errors.businessName.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessEmail">{t('email')}</Label>
              <Input
                id="businessEmail"
                type="email"
                placeholder={t('emailPlaceholder')}
                {...register('businessEmail', {
                  required: t('emailRequired'),
                })}
              />
              {errors.businessEmail?.message && (
                <p className="text-sm text-destructive">
                  {errors.businessEmail.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessPhone">{t('phone')}</Label>
              <Input
                id="businessPhone"
                type="tel"
                placeholder={t('phonePlaceholder')}
                {...register('businessPhone')}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessAddress">{t('address')}</Label>
            <Textarea
              id="businessAddress"
              rows={3}
              placeholder={t('addressPlaceholder')}
              {...register('businessAddress')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">{t('taxIdVat')}</Label>
            <Input
              id="taxId"
              placeholder={t('taxIdPlaceholder')}
              {...register('taxId')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('invoiceDefaults')}</CardTitle>
          <CardDescription>{t('invoiceDefaultsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('defaultCurrency')}</Label>
              <input type="hidden" {...register('defaultCurrency')} />
              <Select
                value={watch('defaultCurrency') || 'USD'}
                onValueChange={(val) =>
                  setValue('defaultCurrency', val, { shouldDirty: true })
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTaxRate">{t('defaultTaxRate')}</Label>
              <Input
                id="defaultTaxRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                {...register('defaultTaxRate', { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPaymentTerms">
              {t('defaultPaymentTerms')}
            </Label>
            <Input
              id="defaultPaymentTerms"
              type="number"
              min="1"
              {...register('defaultPaymentTerms', { valueAsNumber: true })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('documentNumbering')}</CardTitle>
          <CardDescription>{t('documentNumberingDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Global format controls */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="numberSeparator">{t('separator')}</Label>
              <input type="hidden" {...register('numberSeparator')} />
              <Select
                value={watch('numberSeparator') || '-'}
                onValueChange={(val) =>
                  setValue('numberSeparator', val, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">{t('separatorDash')} (-)</SelectItem>
                  <SelectItem value="/">{t('separatorSlash')} (/)</SelectItem>
                  <SelectItem value=".">{t('separatorDot')} (.)</SelectItem>
                  <SelectItem value="">{t('separatorNone')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberPadding">{t('digitPadding')}</Label>
              <input type="hidden" {...register('numberPadding', { valueAsNumber: true })} />
              <Select
                value={String(watch('numberPadding') || 4)}
                onValueChange={(val) =>
                  setValue('numberPadding', Number(val), { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {t('digits')} ({String(1).padStart(n, '0')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Taxable Invoice sequence */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('taxableInvoiceSequence')}</Label>
              <NumberPreview
                prefix={watch('invoicePrefix') || 'INV'}
                nextNum={watch('nextInvoiceNumber') || 1}
                separator={sep}
                padding={pad}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="invoicePrefix" className="text-xs text-muted-foreground">
                  {t('prefix')}
                </Label>
                <Input
                  id="invoicePrefix"
                  placeholder="INV"
                  maxLength={10}
                  {...register('invoicePrefix')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nextInvoiceNumber" className="text-xs text-muted-foreground">
                  {t('nextNumber')}
                </Label>
                <Input
                  id="nextInvoiceNumber"
                  type="number"
                  min="1"
                  {...register('nextInvoiceNumber', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Exempt Invoice sequence */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('exemptInvoiceSequence')}</Label>
              <NumberPreview
                prefix={watch('exemptInvoicePrefix') || 'EINV'}
                nextNum={watch('nextExemptInvoiceNumber') || 1}
                separator={sep}
                padding={pad}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="exemptInvoicePrefix" className="text-xs text-muted-foreground">
                  {t('prefix')}
                </Label>
                <Input
                  id="exemptInvoicePrefix"
                  placeholder="EINV"
                  maxLength={10}
                  {...register('exemptInvoicePrefix')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nextExemptInvoiceNumber" className="text-xs text-muted-foreground">
                  {t('nextNumber')}
                </Label>
                <Input
                  id="nextExemptInvoiceNumber"
                  type="number"
                  min="1"
                  {...register('nextExemptInvoiceNumber', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Write-off sequence */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('writeOffSequence')}</Label>
              <NumberPreview
                prefix={watch('writeOffPrefix') || 'WO'}
                nextNum={watch('nextWriteOffNumber') || 1}
                separator={sep}
                padding={pad}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="writeOffPrefix" className="text-xs text-muted-foreground">
                  {t('prefix')}
                </Label>
                <Input
                  id="writeOffPrefix"
                  placeholder="WO"
                  maxLength={10}
                  {...register('writeOffPrefix')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nextWriteOffNumber" className="text-xs text-muted-foreground">
                  {t('nextNumber')}
                </Label>
                <Input
                  id="nextWriteOffNumber"
                  type="number"
                  min="1"
                  {...register('nextWriteOffNumber', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Quote sequence */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('quoteSequence')}</Label>
              <NumberPreview
                prefix={watch('quotePrefix') || 'QUO'}
                nextNum={watch('nextQuoteNumber') || 1}
                separator={sep}
                padding={pad}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="quotePrefix" className="text-xs text-muted-foreground">
                  {t('prefix')}
                </Label>
                <Input
                  id="quotePrefix"
                  placeholder="QUO"
                  maxLength={10}
                  {...register('quotePrefix')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nextQuoteNumber" className="text-xs text-muted-foreground">
                  {t('nextNumber')}
                </Label>
                <Input
                  id="nextQuoteNumber"
                  type="number"
                  min="1"
                  {...register('nextQuoteNumber', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('numberingWarning')}
          </p>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={!isDirty || updateSettings.isPending}
      >
        {updateSettings.isPending && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {t('saveSettings')}
      </Button>
    </form>
  );
}
