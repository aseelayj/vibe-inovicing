import { useTranslation } from 'react-i18next';
import { Download, Trash2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice, Payment, BankAccount } from '@vibe/shared';
import { PAYMENT_METHODS } from '@vibe/shared';
import { toast } from 'sonner';

// ---------- Payment History Card ----------

interface PaymentHistoryCardProps {
  invoice: Invoice;
  payments: Payment[] | undefined;
  onDeletePayment: (id: number) => void;
}

export function PaymentHistoryCard({
  invoice,
  payments,
  onDeletePayment,
}: PaymentHistoryCardProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('paymentHistory')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!payments?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('noPaymentsRecorded')}
          </p>
        ) : (
          <ul className="space-y-3">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {formatCurrency(payment.amount, invoice.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(payment.paymentDate)}
                    {payment.paymentMethod &&
                      ` ${t('via', { method: payment.paymentMethod.replace(/_/g, ' ') })}`}
                  </p>
                  {payment.reference && (
                    <p className="text-xs text-muted-foreground">
                      {t('ref', { reference: payment.reference })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-primary"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch(
                          `/api/payments/${payment.id}/receipt`,
                          {
                            headers: token
                              ? { Authorization: `Bearer ${token}` }
                              : {},
                          },
                        );
                        if (!res.ok) throw new Error('Failed');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `receipt-${payment.id}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        toast.error('Failed to download receipt');
                      }
                    }}
                    aria-label={tc('receipt')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDeletePayment(payment.id)}
                    aria-label={t('deletePayment')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Record Payment Dialog ----------

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  paymentForm: UseFormReturn<{
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference: string;
    bankAccountId: number | null;
    notes: string;
  }>;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  bankAccounts: BankAccount[] | undefined;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  paymentForm,
  onSubmit,
  isPending,
  bankAccounts,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('recordPayment')}</DialogTitle>
          <DialogDescription>
            {t('recordPaymentDesc', {
              invoice: invoice.invoiceNumber,
            })}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={paymentForm.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="payment-amount">{t('paymentAmount')}</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              {...paymentForm.register('amount', {
                valueAsNumber: true,
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-date">{t('paymentDate')}</Label>
            <Input
              id="payment-date"
              type="date"
              {...paymentForm.register('paymentDate')}
            />
          </div>
          <div className="space-y-2">
            <Label>{tc('paymentMethod')}</Label>
            <Select
              value={paymentForm.watch('paymentMethod')}
              onValueChange={(val) =>
                paymentForm.setValue('paymentMethod', val)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tc('selectMethod')} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {bankAccounts && bankAccounts.length > 0 && (
            <div className="space-y-2">
              <Label>{t('depositTo')}</Label>
              <Select
                value={
                  paymentForm.watch('bankAccountId')
                    ? String(paymentForm.watch('bankAccountId'))
                    : 'none'
                }
                onValueChange={(val) =>
                  paymentForm.setValue(
                    'bankAccountId',
                    val === 'none' ? null : Number(val),
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectBankAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('noAccountDontTrack')}
                  </SelectItem>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.name}
                      {acc.bankName ? ` -- ${acc.bankName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('depositAutoCreate')}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="payment-reference">{tc('reference')}</Label>
            <Input
              id="payment-reference"
              placeholder={t('referencePlaceholder')}
              {...paymentForm.register('reference')}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? tc('recording') : t('recordPayment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Delete Payment Dialog ----------

interface DeletePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeletePaymentDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeletePaymentDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deletePayment')}</DialogTitle>
          <DialogDescription>
            {t('deletePaymentConfirm')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? tc('deleting') : tc('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
