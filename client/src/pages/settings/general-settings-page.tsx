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
  exemptInvoicePrefix: string;
  quotePrefix: string;
  autoRemindersEnabled: boolean;
  reminderDaysAfterDue: string;
  lateFeeEnabled: boolean;
  lateFeeType: string;
  lateFeeValue: number;
  lateFeeGracePeriod: number;
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
        exemptInvoicePrefix: settings.exemptInvoicePrefix || 'EINV',
        quotePrefix: settings.quotePrefix || 'QTE',
        autoRemindersEnabled: settings.autoRemindersEnabled ?? false,
        reminderDaysAfterDue: ((settings.reminderDaysAfterDue as number[]) || [3, 7, 14, 30]).join(', '),
        lateFeeEnabled: settings.lateFeeEnabled ?? false,
        lateFeeType: settings.lateFeeType || 'percentage',
        lateFeeValue: settings.lateFeeValue || 0,
        lateFeeGracePeriod: settings.lateFeeGracePeriod || 0,
      });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingSpinner />;

  const onSubmit = (data: GeneralFormValues) => {
    const { reminderDaysAfterDue, ...rest } = data;
    const payload: Record<string, unknown> = {
      ...rest,
      reminderDaysAfterDue: reminderDaysAfterDue
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0),
    };
    updateSettings.mutate(payload);
  };

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="invoicePrefix">{t('taxableInvoicePrefix')}</Label>
              <Input
                id="invoicePrefix"
                placeholder="INV"
                maxLength={10}
                {...register('invoicePrefix')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exemptInvoicePrefix">
                {t('exemptInvoicePrefix')}
              </Label>
              <Input
                id="exemptInvoicePrefix"
                placeholder="EINV"
                maxLength={10}
                {...register('exemptInvoicePrefix')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotePrefix">{t('quotePrefix')}</Label>
              <Input
                id="quotePrefix"
                placeholder="QTE"
                maxLength={10}
                {...register('quotePrefix')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto Reminders & Late Fees */}
      <Card>
        <CardHeader>
          <CardTitle>{t('autoReminders')}</CardTitle>
          <CardDescription>{t('autoRemindersDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoRemindersEnabled"
              className="h-4 w-4 rounded border-gray-300"
              {...register('autoRemindersEnabled')}
            />
            <Label htmlFor="autoRemindersEnabled">{t('enableAutoReminders')}</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminderDaysAfterDue">{t('reminderDays')}</Label>
            <Input
              id="reminderDaysAfterDue"
              placeholder="3, 7, 14, 30"
              {...register('reminderDaysAfterDue')}
            />
            <p className="text-xs text-muted-foreground">{t('reminderDaysHint')}</p>
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="lateFeeEnabled"
                className="h-4 w-4 rounded border-gray-300"
                {...register('lateFeeEnabled')}
              />
              <Label htmlFor="lateFeeEnabled">{t('enableLateFees')}</Label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lateFeeType">{t('lateFeeType')}</Label>
              <select
                id="lateFeeType"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                {...register('lateFeeType')}
              >
                <option value="percentage">{t('percentage')}</option>
                <option value="fixed">{t('fixedAmount')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lateFeeValue">{t('lateFeeValue')}</Label>
              <Input
                id="lateFeeValue"
                type="number"
                step="0.01"
                min="0"
                {...register('lateFeeValue', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lateFeeGracePeriod">{t('gracePeriod')}</Label>
              <Input
                id="lateFeeGracePeriod"
                type="number"
                min="0"
                {...register('lateFeeGracePeriod', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">{t('gracePeriodHint')}</p>
            </div>
          </div>
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
