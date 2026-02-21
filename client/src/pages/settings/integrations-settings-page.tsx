import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { JOFOTARA_INVOICE_TYPES } from '@vibe/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface IntegrationsFormValues {
  geminiApiKey: string;
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
}

export function IntegrationsSettingsPage() {
  const { t } = useTranslation('settings');
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty },
  } = useForm<IntegrationsFormValues>();

  useEffect(() => {
    if (settings) {
      reset({
        geminiApiKey: settings.geminiApiKey || '',
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
      });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingSpinner />;

  const onSubmit = (data: IntegrationsFormValues) => {
    updateSettings.mutate(data as Record<string, unknown>);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('geminiTitle')}</CardTitle>
          <CardDescription>{t('geminiDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="geminiApiKey">{t('geminiApiKey')}</Label>
            <Input
              id="geminiApiKey"
              type="password"
              placeholder={t('geminiApiKeyPlaceholder')}
              {...register('geminiApiKey')}
            />
            <p className="text-xs text-muted-foreground">
              {t('geminiApiKeyHint')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('jofotaraTitle')}</CardTitle>
          <CardDescription>{t('jofotaraDesc')}</CardDescription>
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
                  value={watch('jofotaraInvoiceType') || 'general_sales'}
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
          <CardDescription>{t('paypalDesc')}</CardDescription>
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
