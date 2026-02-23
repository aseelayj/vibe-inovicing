import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Lock, AlertTriangle, Info, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useUpdateInvoiceNumber,
  useInvoiceEditStatus,
} from '@/hooks/use-invoices';
import type { Invoice } from '@vibe/shared';

interface InvoiceNumberEditorProps {
  invoice: Invoice;
}

export function InvoiceNumberEditor({ invoice }: InvoiceNumberEditorProps) {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');
  const { data: editStatus } = useInvoiceEditStatus(String(invoice.id));
  const updateNumber = useUpdateInvoiceNumber();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLockedDialog, setShowLockedDialog] = useState(false);
  const [newNumber, setNewNumber] = useState(invoice.invoiceNumber);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleEditClick = () => {
    if (!editStatus) return;

    if (editStatus.level === 'locked') {
      setShowLockedDialog(true);
      return;
    }

    setNewNumber(invoice.invoiceNumber);
    setReason('');
    setConfirmed(false);
    setShowEditDialog(true);
  };

  const handleSave = async () => {
    if (!newNumber.trim() || !reason.trim()) return;
    if (editStatus?.level === 'warning' && !confirmed) return;

    try {
      await updateNumber.mutateAsync({
        id: invoice.id,
        newNumber: newNumber.trim(),
        reason: reason.trim(),
      });
      setShowEditDialog(false);
    } catch {
      // Error handled by mutation
    }
  };

  const canSubmit =
    newNumber.trim() &&
    newNumber.trim() !== invoice.invoiceNumber &&
    reason.trim() &&
    (editStatus?.level !== 'warning' || confirmed);

  return (
    <>
      <div className="group inline-flex items-center gap-1.5">
        <h2 className="text-xl font-bold sm:text-2xl">
          {invoice.invoiceNumber}
        </h2>
        {editStatus?.level === 'locked' ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground opacity-60"
                onClick={handleEditClick}
              >
                <Lock className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{t('numberLocked')}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            onClick={handleEditClick}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Locked Explanation Dialog */}
      <Dialog open={showLockedDialog} onOpenChange={setShowLockedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              {t('numberLockedTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {editStatus?.message}
            </p>
            {invoice.jofotaraStatus === 'submitted' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {t('numberLockedSolution')}
                </p>
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                  {t('numberLockedSolutionDesc')}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockedDialog(false)}>
              {tc('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('editInvoiceNumber')}</DialogTitle>
            <DialogDescription>
              {t('editInvoiceNumberDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Warning banner for non-draft invoices */}
            {editStatus?.level === 'warning' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {t('numberEditWarningTitle')}
                    </p>
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                      {editStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Draft info */}
            {editStatus?.level === 'free' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    {t('numberEditDraftInfo')}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('currentNumber')}</Label>
              <Input value={invoice.invoiceNumber} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newNumber">{t('newNumber')}</Label>
              <Input
                id="newNumber"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder={t('newNumberPlaceholder')}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{t('changeReason')}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('changeReasonPlaceholder')}
                rows={2}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {t('changeReasonHint')}
              </p>
            </div>

            {/* Confirmation checkbox for non-draft invoices */}
            {editStatus?.level === 'warning' && (
              <label className="flex items-start gap-2 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">
                  {t('numberEditConfirm')}
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSubmit || updateNumber.isPending}
            >
              {updateNumber.isPending ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
