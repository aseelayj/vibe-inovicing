import { useTranslation } from 'react-i18next';
import {
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { JOFOTARA_STATUS_COLORS } from '@/lib/constants';
import type { Invoice, JofotaraSubmission } from '@vibe/shared';

// ---------- JoFotara Info Card ----------

interface JofotaraCardProps {
  invoice: Invoice;
  submissions: JofotaraSubmission[] | undefined;
  showHistory: boolean;
  onToggleHistory: () => void;
}

export function JofotaraCard({
  invoice,
  submissions,
  showHistory,
  onToggleHistory,
}: JofotaraCardProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {t('jofotaraEInvoice')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {tc('status')}
          </span>
          <Badge
            variant="outline"
            className={cn(
              JOFOTARA_STATUS_COLORS[invoice.jofotaraStatus],
              'border-transparent',
            )}
          >
            {invoice.jofotaraStatus.replace(/_/g, ' ')}
          </Badge>
        </div>
        {invoice.jofotaraUuid && (
          <div>
            <p className="text-xs text-muted-foreground">
              {t('jofotaraUuid')}
            </p>
            <p className="break-all text-xs font-mono">
              {invoice.jofotaraUuid}
            </p>
          </div>
        )}
        {invoice.jofotaraInvoiceNumber && (
          <div>
            <p className="text-xs text-muted-foreground">
              {t('jofotaraInvoiceNumber')}
            </p>
            <p className="text-sm font-medium">
              {invoice.jofotaraInvoiceNumber}
            </p>
          </div>
        )}
        {invoice.jofotaraSubmittedAt && (
          <div>
            <p className="text-xs text-muted-foreground">
              {t('jofotaraSubmitted')}
            </p>
            <p className="text-sm">
              {formatDate(invoice.jofotaraSubmittedAt)}
            </p>
          </div>
        )}
        {invoice.jofotaraQrCode && (
          <div className="pt-2">
            <p className="mb-2 text-xs text-muted-foreground">
              {t('jofotaraQrCode')}
            </p>
            <div className="flex justify-center rounded-lg bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoice.jofotaraQrCode)}`}
                alt="JoFotara QR Code"
                className="h-[150px] w-[150px]"
              />
            </div>
          </div>
        )}

        {submissions && submissions.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium"
              onClick={onToggleHistory}
            >
              {t('submissionHistory', {
                count: submissions.length,
              })}
              {showHistory ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-2">
                {submissions.map((sub) => (
                  <li
                    key={sub.id}
                    className="rounded-lg bg-muted/50 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={cn(
                          JOFOTARA_STATUS_COLORS[sub.status],
                          'border-transparent text-xs',
                        )}
                      >
                        {sub.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(sub.createdAt)}
                      </span>
                    </div>
                    {sub.errorMessage && (
                      <p className="mt-1 text-xs text-destructive">
                        {sub.errorMessage}
                      </p>
                    )}
                    {sub.isCreditInvoice && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('creditNote')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- JoFotara Submit Dialog ----------

interface JofotaraSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: 'validating' | 'errors' | 'confirm';
  errors: string[];
  paymentMethod: 'cash' | 'receivable';
  onPaymentMethodChange: (method: 'cash' | 'receivable') => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function JofotaraSubmitDialog({
  open,
  onOpenChange,
  step,
  errors,
  paymentMethod,
  onPaymentMethodChange,
  onSubmit,
  isPending,
}: JofotaraSubmitDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('exportToJofotara')}
          </DialogTitle>
          <DialogDescription>
            {t('jofotaraSubmitDesc')}
          </DialogDescription>
        </DialogHeader>

        {step === 'validating' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ms-2 text-sm text-muted-foreground">
              {t('validatingInvoice')}
            </span>
          </div>
        )}

        {step === 'errors' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">
                {t('invoiceCannotBeSubmitted')}
              </p>
            </div>
            <ul className="space-y-1">
              {errors.map((err, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-0.5 text-destructive">-</span>
                  {err}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tc('close')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">
                {t('invoiceValidForSubmission')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{tc('paymentMethod')}</Label>
              <Select
                value={paymentMethod}
                onValueChange={(val) =>
                  onPaymentMethodChange(val as 'cash' | 'receivable')
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    {t('jofotaraCash')}
                  </SelectItem>
                  <SelectItem value="receivable">
                    {t('jofotaraReceivable')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tc('cancel')}
              </Button>
              <Button onClick={onSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tc('submitting')}
                  </>
                ) : (
                  t('jofotaraSubmit')
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Credit Note Dialog ----------

interface CreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}

export function CreditNoteDialog({
  open,
  onOpenChange,
  invoiceNumber,
  reason,
  onReasonChange,
  onSubmit,
}: CreditNoteDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('issueCreditNote')}</DialogTitle>
          <DialogDescription>
            {t('issueCreditNoteDesc', { invoice: invoiceNumber })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credit-reason">{t('reasonForReturn')}</Label>
            <Textarea
              id="credit-reason"
              rows={3}
              placeholder={t('reasonPlaceholder')}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tc('cancel')}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!reason.trim()}
          >
            {t('submitCreditNote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
