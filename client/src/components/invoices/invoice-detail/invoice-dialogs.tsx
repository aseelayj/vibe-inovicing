import { useTranslation } from 'react-i18next';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice } from '@vibe/shared';

// ---------- Delete Invoice Dialog ----------

interface DeleteInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteInvoiceDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteInvoiceDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteInvoice')}</DialogTitle>
          <DialogDescription>
            {t('deleteInvoiceConfirm')}
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

// ---------- Send Invoice Dialog ----------

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  clientEmail: string | undefined;
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  clientEmail,
}: SendInvoiceDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sendInvoice')}</DialogTitle>
          <DialogDescription>
            {clientEmail
              ? t('sendInvoiceConfirm', { email: clientEmail })
              : t('sendInvoiceConfirmGeneric')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? tc('sending') : t('sendInvoice')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Send Reminder Dialog ----------

interface SendReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  invoice: Invoice;
  remaining: number;
}

export function SendReminderDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  invoice,
  remaining,
}: SendReminderDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            {t('sendPaymentReminder')}
          </DialogTitle>
          <DialogDescription>
            {t('sendReminderConfirm', {
              email: invoice.client?.email || 'the client',
              invoice: invoice.invoiceNumber,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-700">{t('amountDue')}</span>
            <span className="font-semibold text-amber-800">
              {formatCurrency(remaining, invoice.currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-amber-700">{t('dueDate')}</span>
            <span className="font-medium text-amber-800">
              {formatDate(invoice.dueDate)}
            </span>
          </div>
          {(() => {
            const now = new Date();
            const dueDate = new Date(invoice.dueDate);
            const daysOverdue = Math.floor(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (daysOverdue > 0) {
              return (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-red-600">{t('overdueLabel')}</span>
                  <span className="font-semibold text-red-700">
                    {t('overdueDays', { count: daysOverdue })}
                  </span>
                </div>
              );
            }
            return null;
          })()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            className="bg-amber-600 text-white hover:bg-amber-700"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tc('sending')}
              </>
            ) : (
              <>
                <Bell className="h-4 w-4" />
                {t('sendReminder')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Create Credit Note Dialog ----------

interface CreateCreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function CreateCreditNoteDialog({
  open,
  onOpenChange,
  invoiceNumber,
  reason,
  onReasonChange,
  onSubmit,
  isPending,
}: CreateCreditNoteDialogProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createCreditNote')}</DialogTitle>
          <DialogDescription>
            {t('createCreditNoteDesc', { invoice: invoiceNumber })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cn-reason">{t('creditNoteReasonLabel')}</Label>
            <Textarea
              id="cn-reason"
              rows={3}
              placeholder={t('creditNoteReasonPlaceholder')}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? tc('creating') : t('createCreditNote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
