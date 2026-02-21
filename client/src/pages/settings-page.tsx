import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import {
  CURRENCIES,
  JOFOTARA_INVOICE_TYPES,
  FILING_STATUSES,
} from '@vibe/shared';
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

interface SettingsFormValues {
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
  jofotaraEnabled: boolean;
  jofotaraClientId: string;
  jofotaraClientSecret: string;
  jofotaraCompanyTin: string;
  jofotaraIncomeSourceSequence: string;
  jofotaraInvoiceType: string;
  paypalEnabled: boolean;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalEnvironment: string;
  filingStatus: string;
  personalExemption: number;
  familyExemption: number;
  additionalExemptions: number;
}

export function SettingsPage() {
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
  } = useForm<SettingsFormValues>();

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
        jofotaraEnabled: settings.jofotaraEnabled || false,
        jofotaraClientId: settings.jofotaraClientId || '',
        jofotaraClientSecret: settings.jofotaraClientSecret || '',
        jofotaraCompanyTin: settings.jofotaraCompanyTin || '',
        jofotaraIncomeSourceSequence:
          settings.jofotaraIncomeSourceSequence || '',
        jofotaraInvoiceType:
          settings.jofotaraInvoiceType || 'general_sales',
        paypalEnabled: settings.paypalEnabled || false,
        paypalClientId: settings.paypalClientId || '',
        paypalClientSecret: settings.paypalClientSecret || '',
        paypalEnvironment: settings.paypalEnvironment || 'sandbox',
        filingStatus: (settings as any).filingStatus || 'single',
        personalExemption: (settings as any).personalExemption ?? 9000,
        familyExemption: (settings as any).familyExemption ?? 9000,
        additionalExemptions: (settings as any).additionalExemptions ?? 0,
      });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingSpinner />;

  const onSubmit = (data: SettingsFormValues) => {
    updateSettings.mutate(data as Record<string, unknown>);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
        <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
          {t('subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('businessInfo')}</CardTitle>
            <CardDescription>
              {t('businessInfoDesc')}
            </CardDescription>
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
            <CardDescription>
              {t('invoiceDefaultsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('defaultCurrency')}</Label>
                <Select
                  value={watch('defaultCurrency') || 'USD'}
                  onValueChange={(val) => {
                    setValue('defaultCurrency', val, { shouldDirty: true });
                  }}
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

        <Card>
          <CardHeader>
            <CardTitle>{t('jofotaraTitle')}</CardTitle>
            <CardDescription>
              {t('jofotaraDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="jofotaraEnabled"
                className="h-4 w-4 rounded border-gray-300"
                {...register('jofotaraEnabled')}
              />
              <Label htmlFor="jofotaraEnabled">
                {t('enableJofotara')}
              </Label>
            </div>

            {watch('jofotaraEnabled') && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraClientId">
                      {t('jofotaraClientId')}
                    </Label>
                    <Input
                      id="jofotaraClientId"
                      placeholder={t('jofotaraClientIdPlaceholder')}
                      {...register('jofotaraClientId')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraClientSecret">
                      {t('jofotaraClientSecret')}
                    </Label>
                    <Input
                      id="jofotaraClientSecret"
                      type="password"
                      placeholder={t('jofotaraClientSecretPlaceholder')}
                      {...register('jofotaraClientSecret')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraCompanyTin">
                      {t('jofotaraCompanyTin')}
                    </Label>
                    <Input
                      id="jofotaraCompanyTin"
                      placeholder={t('jofotaraCompanyTinPlaceholder')}
                      {...register('jofotaraCompanyTin')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraIncomeSourceSequence">
                      {t('jofotaraIncomeSourceSeq')}
                    </Label>
                    <Input
                      id="jofotaraIncomeSourceSequence"
                      placeholder={t('jofotaraIncomeSourceSeqPlaceholder')}
                      {...register('jofotaraIncomeSourceSequence')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('jofotaraDefaultInvoiceType')}</Label>
                  <Select
                    value={
                      watch('jofotaraInvoiceType') || 'general_sales'
                    }
                    onValueChange={(val) =>
                      setValue('jofotaraInvoiceType', val, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      {JOFOTARA_INVOICE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, (c) =>
                            c.toUpperCase(),
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('paypalTitle')}</CardTitle>
            <CardDescription>
              {t('paypalDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="paypalEnabled"
                className="h-4 w-4 rounded border-gray-300"
                {...register('paypalEnabled')}
              />
              <Label htmlFor="paypalEnabled">
                {t('enablePaypal')}
              </Label>
            </div>

            {watch('paypalEnabled') && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paypalClientId">
                      {t('paypalClientId')}
                    </Label>
                    <Input
                      id="paypalClientId"
                      placeholder={t('paypalClientIdPlaceholder')}
                      {...register('paypalClientId')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypalClientSecret">
                      {t('paypalClientSecret')}
                    </Label>
                    <Input
                      id="paypalClientSecret"
                      type="password"
                      placeholder={t('paypalClientSecretPlaceholder')}
                      {...register('paypalClientSecret')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('paypalEnvironment')}</Label>
                  <Select
                    value={watch('paypalEnvironment') || 'sandbox'}
                    onValueChange={(val) =>
                      setValue('paypalEnvironment', val, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectEnvironment')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">
                        {t('paypalSandbox')}
                      </SelectItem>
                      <SelectItem value="live">
                        {t('paypalLive')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('paypalEnvironmentHint')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('incomeTaxExemptions')} ({t('incomeTaxExemptionsAr')})</CardTitle>
            <CardDescription>
              {t('incomeTaxExemptionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('filingStatus')}</Label>
              <Select
                value={watch('filingStatus') || 'single'}
                onValueChange={(val) =>
                  setValue('filingStatus', val, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">
                    {t('single')} ({t('singleAr')})
                  </SelectItem>
                  <SelectItem value="married">
                    {t('married')} ({t('marriedAr')})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="personalExemption">
                  {t('personalExemption')}
                </Label>
                <Input
                  id="personalExemption"
                  type="number"
                  min="0"
                  step="1"
                  {...register('personalExemption', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  {t('personalExemptionDefault')}
                </p>
              </div>
              {watch('filingStatus') === 'married' && (
                <div className="space-y-2">
                  <Label htmlFor="familyExemption">
                    {t('familyExemption')}
                  </Label>
                  <Input
                    id="familyExemption"
                    type="number"
                    min="0"
                    step="1"
                    {...register('familyExemption', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('familyExemptionDefault')}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalExemptions">
                {t('additionalExemptions')}
              </Label>
              <Input
                id="additionalExemptions"
                type="number"
                min="0"
                max="3000"
                step="1"
                {...register('additionalExemptions', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                {t('additionalExemptionsDesc')}
              </p>
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
    </div>
  );
}
