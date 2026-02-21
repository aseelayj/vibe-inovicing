import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Landmark,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Link2,
  Unlink,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  useDisconnectProvider,
  useSyncBankAccount,
} from '@/hooks/use-bank-accounts';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { CURRENCIES, BANK_ACCOUNT_PROVIDERS } from '@vibe/shared';
import type { BankAccount, BankAccountProvider, Currency } from '@vibe/shared';
import { toast } from 'sonner';

const PROVIDER_LABELS: Record<BankAccountProvider, string> = {
  manual: 'Manual',
  paypal: 'PayPal',
  bank_al_etihad: 'Bank Al Etihad',
};

function BankAccountForm({
  account,
  onSubmit,
  onCancel,
  isLoading,
}: {
  account?: BankAccount;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('bank-accounts');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState(account?.name ?? '');
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'USD');
  const [initialBalance, setInitialBalance] = useState(
    account?.initialBalance?.toString() ?? '0',
  );
  const [notes, setNotes] = useState(account?.notes ?? '');
  const [provider, setProvider] = useState<BankAccountProvider>(
    account?.provider ?? 'manual',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      currency,
      initialBalance: parseFloat(initialBalance) || 0,
      notes: notes || null,
      provider,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('accountNameRequired')}
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('accountNamePlaceholder')}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t('bankName')}</label>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder={t('bankNamePlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('accountNumber')}
          </label>
          <Input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder={t('accountNumberPlaceholder')}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{tc('currency')}</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('initialBalance')}
          </label>
          <Input
            type="number"
            step="0.01"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
        </div>
      </div>
      {!account && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t('provider')}</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as BankAccountProvider)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {BANK_ACCOUNT_PROVIDERS.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium">{tc('notes')}</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading ? t('saving') : account ? tc('update') : tc('create')}
        </Button>
      </div>
    </form>
  );
}

function SyncDialog({
  account,
  onClose,
}: {
  account: BankAccount;
  onClose: () => void;
}) {
  const { t } = useTranslation('bank-accounts');
  const { t: tc } = useTranslation('common');
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [result, setResult] = useState<{
    imported: number; skipped: number; errors: string[];
  } | null>(null);
  const syncAccount = useSyncBankAccount();

  const handleSync = async () => {
    try {
      const data = await syncAccount.mutateAsync({
        id: account.id,
        data: { fromDate, toDate },
      });
      setResult(data as any);
      if ((data as any).imported > 0) {
        toast.success(`Imported ${(data as any).imported} transactions`);
      }
    } catch {
      // handled by hook
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t('fromDate')}</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t('toDate')}</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {result && (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm">
          <p>{t('imported')}: <strong>{result.imported}</strong></p>
          <p>{t('skippedDuplicates')}: <strong>{result.skipped}</strong></p>
          {result.errors.length > 0 && (
            <div className="mt-2 text-destructive">
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {result ? tc('close') : tc('cancel')}
        </Button>
        <Button
          onClick={handleSync}
          disabled={syncAccount.isPending || !fromDate || !toDate}
        >
          {syncAccount.isPending ? t('syncing') : t('syncTransactions')}
        </Button>
      </div>
    </div>
  );
}

export function BankAccountsPage() {
  const { t } = useTranslation('bank-accounts');
  const { t: tc } = useTranslation('common');
  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [syncAccount, setSyncAccount] = useState<BankAccount | null>(null);
  const [connecting, setConnecting] = useState<number | null>(null);
  const { data, isLoading, refetch } = useBankAccounts();
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const deleteAccount = useDeleteBankAccount();
  const disconnectProvider = useDisconnectProvider();

  const accounts = data ?? [];

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      await createAccount.mutateAsync(formData);
      setShowCreate(false);
    } catch {
      // handled
    }
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editAccount) return;
    try {
      await updateAccount.mutateAsync({ id: editAccount.id, data: formData });
      setEditAccount(null);
    } catch {
      // handled
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteAccount.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled
    }
  };

  const handleConnectPayPal = async (account: BankAccount) => {
    setConnecting(account.id);
    try {
      await api.post(`/bank-accounts/${account.id}/connect-paypal`, {});
      toast.success('PayPal connected successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect PayPal');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (account: BankAccount) => {
    try {
      await disconnectProvider.mutateAsync(account.id);
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <Button size="sm" className="shrink-0 sm:size-default" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('addAccount')}</span>
          <span className="sm:hidden">{tc('add')}</span>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          actionLabel={t('addAccount')}
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accountName')}</TableHead>
                <TableHead>{t('bank')}</TableHead>
                <TableHead>{tc('currency')}</TableHead>
                <TableHead className="text-end">{t('balance')}</TableHead>
                <TableHead>{tc('status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.name}</span>
                      {account.provider !== 'manual' && (
                        <Badge variant="outline" className="text-xs">
                          {PROVIDER_LABELS[account.provider as BankAccountProvider] ?? account.provider}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{account.bankName || '--'}</TableCell>
                  <TableCell>{account.currency}</TableCell>
                  <TableCell className="text-end font-mono">
                    {formatCurrency(
                      parseFloat(String(account.currentBalance)),
                      account.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.isActive ? 'default' : 'secondary'}>
                      {account.isActive ? tc('active') : tc('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditAccount(account)}
                        >
                          <Pencil className="h-4 w-4" />
                          {tc('edit')}
                        </DropdownMenuItem>
                        {account.provider !== 'manual' && (
                          <DropdownMenuItem
                            onClick={() => setSyncAccount(account)}
                          >
                            <RefreshCw className="h-4 w-4" />
                            {t('syncTransactions')}
                          </DropdownMenuItem>
                        )}
                        {account.provider === 'manual' && (
                          <DropdownMenuItem
                            disabled={connecting === account.id}
                            onClick={() => handleConnectPayPal(account)}
                          >
                            <Link2 className="h-4 w-4" />
                            {connecting === account.id ? t('connecting') : t('connectPayPal')}
                          </DropdownMenuItem>
                        )}
                        {account.provider !== 'manual' && (
                          <DropdownMenuItem
                            onClick={() => handleDisconnect(account)}
                          >
                            <Unlink className="h-4 w-4" />
                            {t('disconnect')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(account.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => !open && setShowCreate(false)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newTitle')}</DialogTitle>
            <DialogDescription>
              {t('newDescription')}
            </DialogDescription>
          </DialogHeader>
          <BankAccountForm
            onSubmit={handleCreate}
            isLoading={createAccount.isPending}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editAccount !== null}
        onOpenChange={(open) => !open && setEditAccount(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
            <DialogDescription>
              {t('editDescription')}
            </DialogDescription>
          </DialogHeader>
          {editAccount && (
            <BankAccountForm
              account={editAccount}
              onSubmit={handleUpdate}
              isLoading={updateAccount.isPending}
              onCancel={() => setEditAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sync dialog */}
      <Dialog
        open={syncAccount !== null}
        onOpenChange={(open) => !open && setSyncAccount(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('syncTitle', { name: syncAccount?.name })}
            </DialogTitle>
            <DialogDescription>
              {t('syncDescription', {
                provider: PROVIDER_LABELS[syncAccount?.provider as BankAccountProvider] ?? syncAccount?.provider,
              })}
            </DialogDescription>
          </DialogHeader>
          {syncAccount && (
            <SyncDialog
              account={syncAccount}
              onClose={() => setSyncAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? t('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
