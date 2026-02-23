import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import {
  Loader2,
  AlertTriangle,
  Hash,
  Search,
  RefreshCw,
} from 'lucide-react';
import { CURRENCIES } from '@vibe/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import {
  useInvoiceGaps,
  useInvoiceNumberAudit,
  useBulkResequence,
} from '@/hooks/use-invoices';
import { formatDate } from '@/lib/format';

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
}

interface SequenceFormValues {
  nextInvoiceNumber: number;
  nextExemptInvoiceNumber: number;
  nextWriteOffNumber: number;
  nextQuoteNumber: number;
}

export function GeneralSettingsPage() {
  const { t } = useTranslation('settings');
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: gaps, isLoading: gapsLoading } = useInvoiceGaps();
  const { data: auditTrail } = useInvoiceNumberAudit();
  const bulkResequence = useBulkResequence();

  const [showResequence, setShowResequence] = useState(false);
  const [resequenceType, setResequenceType] = useState<
    'taxable' | 'exempt' | 'write_off'
  >('taxable');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<GeneralFormValues>();

  const seqForm = useForm<SequenceFormValues>();

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
        reminderDaysAfterDue: (
          (settings.reminderDaysAfterDue as number[]) || [3, 7, 14, 30]
        ).join(', '),
      });
      seqForm.reset({
        nextInvoiceNumber: settings.nextInvoiceNumber || 1,
        nextExemptInvoiceNumber: settings.nextExemptInvoiceNumber || 1,
        nextWriteOffNumber: settings.nextWriteOffNumber || 1,
        nextQuoteNumber: settings.nextQuoteNumber || 1,
      });
    }
  }, [settings, reset, seqForm]);

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

  const onSequenceSave = (data: SequenceFormValues) => {
    updateSettings.mutate(data as unknown as Record<string, unknown>);
  };

  const handleBulkResequence = async () => {
    try {
      await bulkResequence.mutateAsync({ type: resequenceType });
      setShowResequence(false);
    } catch {
      // handled by mutation
    }
  };

  const totalGaps = gaps?.reduce(
    (sum, g) => sum + g.missingNumbers.length,
    0,
  ) ?? 0;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Business Information - existing form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                <Label htmlFor="invoicePrefix">
                  {t('taxableInvoicePrefix')}
                </Label>
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

        {/* Auto Reminders */}
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
              <Label htmlFor="autoRemindersEnabled">
                {t('enableAutoReminders')}
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminderDaysAfterDue">
                {t('reminderDays')}
              </Label>
              <Input
                id="reminderDaysAfterDue"
                placeholder="3, 7, 14, 30"
                {...register('reminderDaysAfterDue')}
              />
              <p className="text-xs text-muted-foreground">
                {t('reminderDaysHint')}
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

      {/* ============================================================ */}
      {/* Sequence Management */}
      {/* ============================================================ */}
      <form
        onSubmit={seqForm.handleSubmit(onSequenceSave)}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>{t('sequenceManagement')}</CardTitle>
                <CardDescription>
                  {t('sequenceManagementDesc')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t('sequenceWarning')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nextInvoiceNumber">
                  {t('nextTaxableNumber')}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {settings?.invoicePrefix}-
                  </span>
                  <Input
                    id="nextInvoiceNumber"
                    type="number"
                    min="1"
                    className="w-28"
                    {...seqForm.register('nextInvoiceNumber', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextExemptInvoiceNumber">
                  {t('nextExemptNumber')}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {settings?.exemptInvoicePrefix}-
                  </span>
                  <Input
                    id="nextExemptInvoiceNumber"
                    type="number"
                    min="1"
                    className="w-28"
                    {...seqForm.register('nextExemptInvoiceNumber', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextWriteOffNumber">
                  {t('nextWriteOffNumber')}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {settings?.writeOffPrefix || 'WO'}-
                  </span>
                  <Input
                    id="nextWriteOffNumber"
                    type="number"
                    min="1"
                    className="w-28"
                    {...seqForm.register('nextWriteOffNumber', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextQuoteNumber">
                  {t('nextQuoteNumber')}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {settings?.quotePrefix || 'QTE'}-
                  </span>
                  <Input
                    id="nextQuoteNumber"
                    type="number"
                    min="1"
                    className="w-28"
                    {...seqForm.register('nextQuoteNumber', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!seqForm.formState.isDirty || updateSettings.isPending}
              size="sm"
            >
              {updateSettings.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t('saveSequence')}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* ============================================================ */}
      {/* Gap Detection */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>{t('gapDetection')}</CardTitle>
                <CardDescription>
                  {t('gapDetectionDesc')}
                </CardDescription>
              </div>
            </div>
            {totalGaps > 0 && (
              <Badge variant="destructive" className="shrink-0">
                {totalGaps} {t('gapsFound')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {gapsLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-4">
              {gaps?.map((gap) => (
                <div key={gap.type} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">
                        {gap.prefix}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {gap.type === 'taxable'
                          ? t('taxableType')
                          : gap.type === 'exempt'
                            ? t('exemptType')
                            : t('writeOffType')}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t('totalIssued', { count: gap.totalIssued })} &middot;{' '}
                      {t('highest', { number: gap.highestNumber })}
                    </span>
                  </div>

                  {gap.missingNumbers.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {t('missingNumbers', {
                          count: gap.missingNumbers.length,
                        })}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {gap.missingNumbers.map((n) => (
                          <span
                            key={n}
                            className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-xs text-destructive"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-green-600">
                      {t('noGaps')}
                    </p>
                  )}

                  {gap.cancelledNumbers.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('cancelledNumbers', {
                          count: gap.cancelledNumbers.length,
                        })}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {gap.cancelledNumbers.map((n) => (
                          <span
                            key={n}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground line-through"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResequence(true)}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('bulkResequence')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Recent Number Changes (Audit Trail) */}
      {/* ============================================================ */}
      {auditTrail && auditTrail.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('recentNumberChanges')}</CardTitle>
            <CardDescription>
              {t('recentNumberChangesDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditTrail.slice(0, 10).map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-muted-foreground line-through">
                        {change.oldNumber}
                      </span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <span className="font-mono font-medium">
                        {change.newNumber}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {change.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {change.user?.name || t('unknownUser')} &middot;{' '}
                      {formatDate(change.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Resequence Dialog */}
      <Dialog open={showResequence} onOpenChange={setShowResequence}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bulkResequence')}</DialogTitle>
            <DialogDescription>
              {t('bulkResequenceDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t('bulkResequenceWarning')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('invoiceType')}</Label>
              <Select
                value={resequenceType}
                onValueChange={(v) =>
                  setResequenceType(v as typeof resequenceType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxable">
                    {t('taxableType')} ({settings?.invoicePrefix})
                  </SelectItem>
                  <SelectItem value="exempt">
                    {t('exemptType')} ({settings?.exemptInvoicePrefix})
                  </SelectItem>
                  <SelectItem value="write_off">
                    {t('writeOffType')} ({settings?.writeOffPrefix || 'WO'})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResequence(false)}
            >
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button
              onClick={handleBulkResequence}
              disabled={bulkResequence.isPending}
            >
              {bulkResequence.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t('resequenceNow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
