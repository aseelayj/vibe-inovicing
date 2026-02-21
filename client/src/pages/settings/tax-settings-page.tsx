import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
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

interface TaxFormValues {
  filingStatus: string;
  personalExemption: number;
  familyExemption: number;
  additionalExemptions: number;
}

export function TaxSettingsPage() {
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
  } = useForm<TaxFormValues>();

  useEffect(() => {
    if (settings) {
      reset({
        filingStatus: (settings as any).filingStatus || 'single',
        personalExemption: (settings as any).personalExemption ?? 9000,
        familyExemption: (settings as any).familyExemption ?? 9000,
        additionalExemptions: (settings as any).additionalExemptions ?? 0,
      });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingSpinner />;

  const onSubmit = (data: TaxFormValues) => {
    updateSettings.mutate(data as Record<string, unknown>);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {t('incomeTaxExemptions')} ({t('incomeTaxExemptionsAr')})
          </CardTitle>
          <CardDescription>{t('incomeTaxExemptionsDesc')}</CardDescription>
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
  );
}
