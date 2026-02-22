import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  ArrowRightLeft,
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
  useBankTransfers,
  useCreateBankTransfer,
  useDeleteBankTransfer,
} from '@/hooks/use-bank-transfers';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { formatCurrency, formatDate } from '@/lib/format';

function TransferForm({
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
  const { t } = useTranslation('bank-transfers');
  const { t: tc } = useTranslation('common');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      fromAccountId: Number(fromAccountId),
      toAccountId: Number(toAccountId),
      amount: Number(amount),
      date,
      reference: reference || null,
      description: description || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.fromAccount')} *
        </label>
        <select
          value={fromAccountId}
          onChange={(e) => setFromAccountId(e.target.value)}
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
          {t('form.toAccount')} *
        </label>
        <select
          value={toAccountId}
          onChange={(e) => setToAccountId(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('form.selectAccount')}</option>
          {bankAccounts
            .filter((a) => a.id !== Number(fromAccountId))
            .map((a) => (
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
          {t('form.date')} *
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
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
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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

export function BankTransfersPage() {
  const { t } = useTranslation('bank-transfers');
  const { t: tc } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: transfersData, isLoading } = useBankTransfers();
  const { data: bankAccounts = [] } = useBankAccounts(true);
  const createTransfer = useCreateBankTransfer();
  const deleteTransfer = useDeleteBankTransfer();

  const transfers = (transfersData as any)?.data ?? transfersData ?? [];

  const handleCreate = (data: Record<string, unknown>) => {
    createTransfer.mutate(data, {
      onSuccess: () => setShowForm(false),
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTransfer.mutate(deleteId, {
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
          {t('addTransfer')}
        </Button>
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addTransfer')}
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.date')}</TableHead>
                <TableHead>{t('table.from')}</TableHead>
                <TableHead>{t('table.to')}</TableHead>
                <TableHead>{t('table.amount')}</TableHead>
                <TableHead>{t('table.reference')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer: any) => (
                <TableRow key={transfer.id}>
                  <TableCell>{formatDate(transfer.date)}</TableCell>
                  <TableCell>{transfer.fromAccount?.name ?? '—'}</TableCell>
                  <TableCell>{transfer.toAccount?.name ?? '—'}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(
                      Number(transfer.amount),
                      transfer.fromAccount?.currency ?? 'USD',
                    )}
                  </TableCell>
                  <TableCell>{transfer.reference || '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={transfer.status === 'completed' ? 'default' : 'secondary'}
                    >
                      {t(`status.${transfer.status}`)}
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
                          onClick={() => setDeleteId(transfer.id)}
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

      {/* Create Transfer Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addTransfer')}</DialogTitle>
            <DialogDescription>{t('form.subtitle')}</DialogDescription>
          </DialogHeader>
          <TransferForm
            bankAccounts={bankAccounts as any[]}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createTransfer.isPending}
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
              disabled={deleteTransfer.isPending}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
