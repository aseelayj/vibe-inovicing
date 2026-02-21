import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CURRENCIES } from '@vibe/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
  quotePrefix: string;
}

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
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
        quotePrefix: settings.quotePrefix || 'QTE',
      });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingSpinner />;

  const onSubmit = (data: SettingsFormValues) => {
    updateSettings.mutate(data as Record<string, unknown>);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure your business profile and invoice defaults
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Business Information
          </h3>
          <div className="space-y-4">
            <Input
              label="Business Name"
              placeholder="Your Business Name"
              error={errors.businessName?.message}
              {...register('businessName', {
                required: 'Business name is required',
              })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="billing@example.com"
                error={errors.businessEmail?.message}
                {...register('businessEmail', {
                  required: 'Email is required',
                })}
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                {...register('businessPhone')}
              />
            </div>
            <div>
              <label
                htmlFor="businessAddress"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Address
              </label>
              <textarea
                id="businessAddress"
                rows={3}
                placeholder="Your business address..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                {...register('businessAddress')}
              />
            </div>
            <Input
              label="Tax ID / VAT Number"
              placeholder="XX-XXXXXXX"
              {...register('taxId')}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Invoice Defaults
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Default Currency" {...register('defaultCurrency')}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Input
                label="Default Tax Rate (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                {...register('defaultTaxRate', { valueAsNumber: true })}
              />
            </div>
            <Input
              label="Default Payment Terms (days)"
              type="number"
              min="1"
              {...register('defaultPaymentTerms', { valueAsNumber: true })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Invoice Prefix"
                placeholder="INV"
                maxLength={10}
                {...register('invoicePrefix')}
              />
              <Input
                label="Quote Prefix"
                placeholder="QTE"
                maxLength={10}
                {...register('quotePrefix')}
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          loading={updateSettings.isPending}
          disabled={!isDirty}
        >
          Save Settings
        </Button>
      </form>
    </div>
  );
}
