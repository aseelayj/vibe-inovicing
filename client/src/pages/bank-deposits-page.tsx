import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  PiggyBank,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  useBankDeposits,
  useCreateBankDeposit,
  useDeleteBankDeposit,
} from '@/hooks/use-bank-deposits';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { formatCurrency, formatDate } from '@/lib/format';
import { DEPOSIT_METHODS } from '@vibe/shared';

function DepositForm({
  bankAccounts,
  onSubmit,
  onCancel,
  isLoading,
}: {
  bankAccounts: { id: number; name: string; currency: string }[];
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('bank-deposits');
  const { t: tc } = useTranslation('common');
  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id?.toString() ?? '',
  );
  const [amount, setAmount] = useState('');
  const [depositDate, setDepositDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [depositMethod, setDepositMethod] = useState<string>('cash');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [memo, setMemo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      bankAccountId: Number(bankAccountId),
      amount: Number(amount),
      depositDate,
      depositMethod,
      reference: reference || null,
      description: description || null,
      memo: memo || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.bankAccount')} *
        </label>
        <select
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('form.selectAccount')}</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.amount')} *
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.depositDate')} *
        </label>
        <input
          type="date"
          value={depositDate}
          onChange={(e) => setDepositDate(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.depositMethod')} *
        </label>
        <select
          value={depositMethod}
          onChange={(e) => setDepositMethod(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {DEPOSIT_METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`methods.${m}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.reference')}
        </label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.description')}
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.memo')}
        </label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? tc('saving') : tc('save')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BankDepositsPage() {
  const { t } = useTranslation('bank-deposits');
  const { t: tc } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: depositsData, isLoading } = useBankDeposits();
  const { data: bankAccounts = [] } = useBankAccounts(true);
  const createDeposit = useCreateBankDeposit();
  const deleteDeposit = useDeleteBankDeposit();

  const deposits = (depositsData as any)?.data ?? depositsData ?? [];

  const handleCreate = (data: Record<string, unknown>) => {
    createDeposit.mutate(data, {
      onSuccess: () => setShowForm(false),
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteDeposit.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addDeposit')}
        </Button>
      </div>

      {deposits.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addDeposit')}
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.date')}</TableHead>
                <TableHead>{t('table.account')}</TableHead>
                <TableHead>{t('table.method')}</TableHead>
                <TableHead>{t('table.amount')}</TableHead>
                <TableHead>{t('table.reference')}</TableHead>
                <TableHead>{t('table.description')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.map((deposit: any) => (
                <TableRow key={deposit.id}>
                  <TableCell>{formatDate(deposit.depositDate)}</TableCell>
                  <TableCell>{deposit.bankAccount?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t(`methods.${deposit.depositMethod}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(
                      Number(deposit.amount),
                      deposit.bankAccount?.currency ?? 'USD',
                    )}
                  </TableCell>
                  <TableCell>{deposit.reference || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {deposit.description || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={deposit.status === 'completed' ? 'default' : 'secondary'}
                    >
                      {t(`status.${deposit.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(deposit.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tc('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Deposit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addDeposit')}</DialogTitle>
            <DialogDescription>{t('form.subtitle')}</DialogDescription>
          </DialogHeader>
          <DepositForm
            bankAccounts={bankAccounts as any[]}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createDeposit.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteConfirm.title')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteDeposit.isPending}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
