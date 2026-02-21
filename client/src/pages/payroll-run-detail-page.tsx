import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Lock, Unlock, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  usePayrollRun,
  useUpdatePayrollEntry,
  useFinalizePayrollRun,
  useReopenPayrollRun,
  useUpdatePayrollPayment,
  useMarkAllPaid,
} from '@/hooks/use-payroll';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { formatCurrency } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import type { PayrollEntry } from '@vibe/shared';
import { cn } from '@/lib/utils';

function EditableCell({
  value,
  onChange,
  disabled,
  type = 'number',
  step = '0.01',
  min = '0',
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  type?: string;
  step?: string;
  min?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));

  if (disabled || !editing) {
    return (
      <span
        className={cn(
          'cursor-default tabular-nums',
          !disabled && 'cursor-pointer hover:bg-muted rounded px-1 -mx-1',
          className,
        )}
        onClick={() => {
          if (!disabled) {
            setLocal(String(value));
            setEditing(true);
          }
        }}
      >
        {type === 'number' ? Number(value).toFixed(2) : value}
      </span>
    );
  }

  return (
    <Input
      type={type}
      step={step}
      min={min}
      className="h-7 w-20 text-xs tabular-nums"
      value={local}
      autoFocus
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const num = parseFloat(local);
        if (!isNaN(num) && num !== value) {
          onChange(num);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
    />
  );
}

export function PayrollRunDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('payroll');
  const { t: tc } = useTranslation('common');

  const runId = id ? parseInt(id, 10) : undefined;
  const { data: run, isLoading } = usePayrollRun(runId);
  const { data: bankAccounts } = useBankAccounts(true);
  const updateEntry = useUpdatePayrollEntry();
  const finalize = useFinalizePayrollRun();
  const reopen = useReopenPayrollRun();
  const updatePayment = useUpdatePayrollPayment();
  const markAllPaid = useMarkAllPaid();

  const [paymentEntry, setPaymentEntry] = useState<PayrollEntry | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: 'paid' as string,
    paymentDate: new Date().toISOString().split('T')[0],
    bankTrxReference: '',
    bankAccountId: null as number | null,
  });
  const [markAllOpen, setMarkAllOpen] = useState(false);
  const [markAllBankId, setMarkAllBankId] = useState<number | null>(null);

  if (isLoading) return <LoadingSpinner />;
  if (!run) return <div>Payroll run not found</div>;

  const entries = (run.entries ?? []) as PayrollEntry[];
  const isDraft = run.status === 'draft';
  const monthNames = t('monthNames', { returnObjects: true }) as string[];

  const handleCellUpdate = (
    entryId: number,
    field: string,
    value: number,
  ) => {
    if (!runId) return;
    updateEntry.mutate({
      runId,
      entryId,
      data: { [field]: value },
    });
  };

  const handlePaymentSubmit = async () => {
    if (!paymentEntry || !runId) return;
    try {
      await updatePayment.mutateAsync({
        runId,
        entryId: paymentEntry.id,
        data: {
          paymentStatus: paymentForm.paymentStatus,
          paymentDate: paymentForm.paymentDate || null,
          bankTrxReference: paymentForm.bankTrxReference || null,
          bankAccountId: paymentForm.bankAccountId,
        },
      });
      setPaymentEntry(null);
    } catch { /* handled */ }
  };

  const banks = (
    Array.isArray(bankAccounts) ? bankAccounts : []
  ) as { id: number; name: string }[];

  const n = (v: unknown) => Number(v) || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/payroll')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">
            {t('runDetail', {
              month: monthNames[run.month - 1],
              year: run.year,
            })}
          </h2>
        </div>
        <Badge
          className={STATUS_COLORS[run.status] || ''}
          variant="secondary"
        >
          {t(run.status as 'draft' | 'finalized' | 'paid')}
        </Badge>
        <div className="flex gap-2">
          {isDraft && (
            <Button
              size="sm"
              onClick={() => runId && finalize.mutate(runId)}
              disabled={finalize.isPending}
            >
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">{t('finalize')}</span>
            </Button>
          )}
          {run.status === 'finalized' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runId && reopen.mutate(runId)}
                disabled={reopen.isPending}
              >
                <Unlock className="h-4 w-4" />
                <span className="hidden sm:inline">{t('reopen')}</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setMarkAllOpen(true)}
                disabled={markAllPaid.isPending}
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t('markAllPaid')}
                </span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: t('summaryGross'),
            value: run.totalGross,
            color: 'text-foreground',
          },
          {
            label: t('summaryDeductions'),
            value: run.totalDeductions,
            color: 'text-red-600',
          },
          {
            label: t('summaryNet'),
            value: run.totalNet,
            color: 'text-green-600',
          },
          {
            label: t('summarySskEmployer'),
            value: run.totalSskEmployer,
            color: 'text-orange-600',
          },
          {
            label: t('summaryCompanyCost'),
            value: run.totalCompanyCost,
            color: 'text-primary',
          },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className={cn('text-lg font-bold tabular-nums', card.color)}>
                {formatCurrency(card.value, 'JOD')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Spreadsheet table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky start-0 z-10 bg-muted/50 px-3 py-2 text-start font-medium">
                {t('employee')}
              </th>
              <th className="px-2 py-2 text-start font-medium">{t('role')}</th>
              <th className="px-2 py-2 text-end font-medium">{t('days')}</th>
              <th className="px-2 py-2 text-end font-medium">{t('basic')}</th>
              <th className="px-2 py-2 text-end font-medium">
                {t('weekdayOT')}
              </th>
              <th className="px-2 py-2 text-end font-medium">
                {t('weekendOT')}
              </th>
              <th className="px-2 py-2 text-end font-medium">
                {t('transport')}
              </th>
              <th className="px-2 py-2 text-end font-medium">
                {t('bonus')}
              </th>
              <th className="px-2 py-2 text-end font-medium">
                {t('salDiff')}
              </th>
              <th className="px-2 py-2 text-end font-medium bg-green-50 dark:bg-green-950/30">
                {t('gross')}
              </th>
              <th className="px-2 py-2 text-end font-medium">
                {t('advance')}
              </th>
              <th className="px-2 py-2 text-end font-medium">
                {t('otherDed')}
              </th>
              <th className="px-2 py-2 text-end font-medium">{t('ssk')}</th>
              <th className="px-2 py-2 text-end font-medium bg-red-50 dark:bg-red-950/30">
                {t('totalDed')}
              </th>
              <th className="px-2 py-2 text-end font-medium bg-blue-50 dark:bg-blue-950/30">
                {t('net')}
              </th>
              <th className="px-2 py-2 text-center font-medium">
                {t('payment')}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b hover:bg-muted/30">
                <td className="sticky start-0 z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap">
                  {entry.employeeName}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                  {entry.employeeRole}
                </td>
                <td className="px-2 py-1.5 text-end">
                  <EditableCell
                    value={entry.workingDays}
                    onChange={(v) =>
                      handleCellUpdate(entry.id, 'workingDays', v)
                    }
                    disabled={!isDraft}
                    step="1"
                  />
                </td>
                <td className="px-2 py-1.5 text-end tabular-nums">
                  {n(entry.basicSalary).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-end">
                  <EditableCell
                    value={n(entry.weekdayOvertimeHours)}
                    onChange={(v) =>
                      handleCellUpdate(
                        entry.id,
                        'weekdayOvertimeHours',
                        v,
                      )
                    }
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-2 py-1.5 text-end">
                  <EditableCell
                    value={n(entry.weekendOvertimeHours)}
                    onChange={(v) =>
                      handleCellUpdate(
                        entry.id,
                        'weekendOvertimeHours',
                        v,
                      )
                    }
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-2 py-1.5 text-end tabular-nums">
                  {n(entry.transportAllowance).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-end">
                  <EditableCell
                    value={n(entry.bonus)}
                    onChange={(v) =>
                      handleCellUpdate(entry.id, 'bonus', v)
                    }
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-2 py-1.5 text-end">
                  <EditableCell
                    value={n(entry.salaryDifference)}
                    onChange={(v) =>
                      handleCellUpdate(entry.id, 'salaryDifference', v)
                    }
                    disabled={!isDraft}
                    min="-99999"
                  />
                </td>
                <td className="px-2 py-1.5 text-end font-medium tabular-nums bg-green-50 dark:bg-green-950/30">
                  {n(entry.grossSalary).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-end">
                  <EditableCell
                    value={n(entry.salaryAdvance)}
                    onChange={(v) =>
                      handleCellUpdate(entry.id, 'salaryAdvance', v)
                    }
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-2 py-1.5 text-end">
                  <EditableCell
                    value={n(entry.otherDeductions)}
                    onChange={(v) =>
                      handleCellUpdate(entry.id, 'otherDeductions', v)
                    }
                    disabled={!isDraft}
                  />
                </td>
                <td className="px-2 py-1.5 text-end tabular-nums">
                  {n(entry.sskEmployee).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-end font-medium tabular-nums text-red-600 bg-red-50 dark:bg-red-950/30">
                  {n(entry.totalDeductions).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-end font-bold tabular-nums text-green-700 dark:text-green-400 bg-blue-50 dark:bg-blue-950/30">
                  {n(entry.netSalary).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => {
                      setPaymentEntry(entry);
                      setPaymentForm({
                        paymentStatus: entry.paymentStatus || 'paid',
                        paymentDate:
                          entry.paymentDate ||
                          new Date().toISOString().split('T')[0],
                        bankTrxReference: entry.bankTrxReference || '',
                        bankAccountId: entry.bankAccountId || null,
                      });
                    }}
                  >
                    <Badge
                      className={cn(
                        STATUS_COLORS[entry.paymentStatus] || '',
                        'cursor-pointer hover:opacity-80',
                      )}
                      variant="secondary"
                    >
                      {t(
                        entry.paymentStatus as
                          | 'pending'
                          | 'paid'
                          | 'on_hold',
                      )}
                    </Badge>
                  </button>
                </td>
              </tr>
            ))}
            {/* Totals row */}
            {entries.length > 0 && (
              <tr className="border-t-2 font-bold bg-muted/40">
                <td className="sticky start-0 z-10 bg-muted/40 px-3 py-2">
                  {t('totals')}
                </td>
                <td />
                <td />
                <td className="px-2 py-2 text-end tabular-nums">
                  {entries
                    .reduce((s, e) => s + n(e.basicSalary), 0)
                    .toFixed(2)}
                </td>
                <td />
                <td />
                <td className="px-2 py-2 text-end tabular-nums">
                  {entries
                    .reduce((s, e) => s + n(e.transportAllowance), 0)
                    .toFixed(2)}
                </td>
                <td className="px-2 py-2 text-end tabular-nums">
                  {entries
                    .reduce((s, e) => s + n(e.bonus), 0)
                    .toFixed(2)}
                </td>
                <td />
                <td className="px-2 py-2 text-end tabular-nums bg-green-50 dark:bg-green-950/30">
                  {n(run.totalGross).toFixed(2)}
                </td>
                <td className="px-2 py-2 text-end tabular-nums">
                  {entries
                    .reduce((s, e) => s + n(e.salaryAdvance), 0)
                    .toFixed(2)}
                </td>
                <td className="px-2 py-2 text-end tabular-nums">
                  {entries
                    .reduce((s, e) => s + n(e.otherDeductions), 0)
                    .toFixed(2)}
                </td>
                <td className="px-2 py-2 text-end tabular-nums">
                  {n(run.totalSskEmployee).toFixed(2)}
                </td>
                <td className="px-2 py-2 text-end tabular-nums text-red-600 bg-red-50 dark:bg-red-950/30">
                  {n(run.totalDeductions).toFixed(2)}
                </td>
                <td className="px-2 py-2 text-end tabular-nums text-green-700 dark:text-green-400 bg-blue-50 dark:bg-blue-950/30">
                  {n(run.totalNet).toFixed(2)}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SSK Employer summary */}
      {n(run.totalSskEmployer) > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-muted-foreground">
              {t('sskEmployer')}
            </span>
            <span className="text-lg font-bold text-orange-600 tabular-nums">
              {formatCurrency(run.totalSskEmployer, 'JOD')}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Payment dialog */}
      <Dialog
        open={!!paymentEntry}
        onOpenChange={(open) => !open && setPaymentEntry(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t('paymentDialog')}: {paymentEntry?.employeeName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('paymentStatus')}</Label>
              <Select
                value={paymentForm.paymentStatus}
                onValueChange={(v) =>
                  setPaymentForm({ ...paymentForm, paymentStatus: v })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="paid">{t('paid')}</SelectItem>
                  <SelectItem value="on_hold">{t('on_hold')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('paymentDate')}</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    paymentDate: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bankRef')}</Label>
              <Input
                value={paymentForm.bankTrxReference}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    bankTrxReference: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('bankAccount')}</Label>
              <Select
                value={
                  paymentForm.bankAccountId
                    ? String(paymentForm.bankAccountId)
                    : 'none'
                }
                onValueChange={(v) =>
                  setPaymentForm({
                    ...paymentForm,
                    bankAccountId: v === 'none' ? null : parseInt(v, 10),
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noBankAccount')}</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentEntry(null)}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handlePaymentSubmit}
              disabled={updatePayment.isPending}
            >
              {updatePayment.isPending ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark All Paid dialog */}
      <Dialog open={markAllOpen} onOpenChange={setMarkAllOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('markAllPaid')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('markAllPaidConfirm')}
            </p>
            <div className="space-y-2">
              <Label>{t('bankAccount')}</Label>
              <Select
                value={markAllBankId ? String(markAllBankId) : 'none'}
                onValueChange={(v) =>
                  setMarkAllBankId(v === 'none' ? null : parseInt(v, 10))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noBankAccount')}</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkAllOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!runId) return;
                markAllPaid.mutate(
                  { id: runId, bankAccountId: markAllBankId },
                  { onSuccess: () => setMarkAllOpen(false) },
                );
              }}
              disabled={markAllPaid.isPending}
            >
              {markAllPaid.isPending ? tc('saving') : t('markAllPaid')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
