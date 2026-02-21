import { useEffect } from 'react';
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
  filingStatus: string;
  personalExemption: number;
  familyExemption: number;
  additionalExemptions: number;
}

export function SettingsPage() {
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
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Settings</h2>
        <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
          Configure your business profile and invoice defaults
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>
              Your business details appear on invoices and quotes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                placeholder="Your Business Name"
                {...register('businessName', {
                  required: 'Business name is required',
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
                <Label htmlFor="businessEmail">Email</Label>
                <Input
                  id="businessEmail"
                  type="email"
                  placeholder="billing@example.com"
                  {...register('businessEmail', {
                    required: 'Email is required',
                  })}
                />
                {errors.businessEmail?.message && (
                  <p className="text-sm text-destructive">
                    {errors.businessEmail.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessPhone">Phone</Label>
                <Input
                  id="businessPhone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  {...register('businessPhone')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAddress">Address</Label>
              <Textarea
                id="businessAddress"
                rows={3}
                placeholder="Your business address..."
                {...register('businessAddress')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / VAT Number</Label>
              <Input
                id="taxId"
                placeholder="XX-XXXXXXX"
                {...register('taxId')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Defaults</CardTitle>
            <CardDescription>
              Default values for new invoices and quotes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select
                  value={watch('defaultCurrency') || 'USD'}
                  onValueChange={(val) => {
                    setValue('defaultCurrency', val, { shouldDirty: true });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
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
                <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
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
                Default Payment Terms (days)
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
                <Label htmlFor="invoicePrefix">Taxable Invoice Prefix</Label>
                <Input
                  id="invoicePrefix"
                  placeholder="INV"
                  maxLength={10}
                  {...register('invoicePrefix')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exemptInvoicePrefix">
                  Exempt Invoice Prefix
                </Label>
                <Input
                  id="exemptInvoicePrefix"
                  placeholder="EINV"
                  maxLength={10}
                  {...register('exemptInvoicePrefix')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotePrefix">Quote Prefix</Label>
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
            <CardTitle>JoFotara E-Invoicing</CardTitle>
            <CardDescription>
              Configure Jordan&apos;s official e-invoicing system
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
                Enable JoFotara e-invoicing
              </Label>
            </div>

            {watch('jofotaraEnabled') && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraClientId">
                      Client ID
                    </Label>
                    <Input
                      id="jofotaraClientId"
                      placeholder="UUID from JoFotara portal"
                      {...register('jofotaraClientId')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraClientSecret">
                      Client Secret
                    </Label>
                    <Input
                      id="jofotaraClientSecret"
                      type="password"
                      placeholder="Secret from JoFotara portal"
                      {...register('jofotaraClientSecret')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraCompanyTin">
                      Company TIN
                    </Label>
                    <Input
                      id="jofotaraCompanyTin"
                      placeholder="8-digit TIN"
                      {...register('jofotaraCompanyTin')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jofotaraIncomeSourceSequence">
                      Income Source Sequence
                    </Label>
                    <Input
                      id="jofotaraIncomeSourceSequence"
                      placeholder="Income source ID"
                      {...register('jofotaraIncomeSourceSequence')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Default Invoice Type</Label>
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
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOFOTARA_INVOICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace(/_/g, ' ').replace(/\b\w/g, (c) =>
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
            <CardTitle>Income Tax Exemptions (إعفاءات ضريبة الدخل)</CardTitle>
            <CardDescription>
              Configure exemptions for annual income tax calculation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Filing Status</Label>
              <Select
                value={watch('filingStatus') || 'single'}
                onValueChange={(val) =>
                  setValue('filingStatus', val, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">
                    Single (أعزب)
                  </SelectItem>
                  <SelectItem value="married">
                    Married (متزوج)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="personalExemption">
                  Personal Exemption (JOD)
                </Label>
                <Input
                  id="personalExemption"
                  type="number"
                  min="0"
                  step="1"
                  {...register('personalExemption', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Default: 9,000 JOD
                </p>
              </div>
              {watch('filingStatus') === 'married' && (
                <div className="space-y-2">
                  <Label htmlFor="familyExemption">
                    Family Exemption (JOD)
                  </Label>
                  <Input
                    id="familyExemption"
                    type="number"
                    min="0"
                    step="1"
                    {...register('familyExemption', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: 9,000 JOD (if married)
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalExemptions">
                Additional Exemptions (JOD)
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
                Medical, education, rent, housing loan interest — max 3,000 JOD
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
          Save Settings
        </Button>
      </form>
    </div>
  );
}
