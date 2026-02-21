import { useState } from 'react';
import {
  Plus,
  Landmark,
  MoreHorizontal,
  Pencil,
  Trash2,
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
} from '@/hooks/use-bank-accounts';
import { formatCurrency } from '@/lib/format';
import { CURRENCIES } from '@vibe/shared';
import type { BankAccount, Currency } from '@vibe/shared';

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
  const [name, setName] = useState(account?.name ?? '');
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'USD');
  const [initialBalance, setInitialBalance] = useState(
    account?.initialBalance?.toString() ?? '0',
  );
  const [notes, setNotes] = useState(account?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      currency,
      initialBalance: parseFloat(initialBalance) || 0,
      notes: notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Account Name *
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Business Checking"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Bank Name</label>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g. Chase"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Account Number
          </label>
          <Input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="****1234"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Currency</label>
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
            Initial Balance
          </label>
          <Input
            type="number"
            step="0.01"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Notes</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading ? 'Saving...' : account ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

export function BankAccountsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data, isLoading } = useBankAccounts();
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const deleteAccount = useDeleteBankAccount();

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">Bank Accounts</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Manage your business bank accounts
          </p>
        </div>
        <Button size="sm" className="shrink-0 sm:size-default" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Account</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No bank accounts"
          description="Add your first bank account to start tracking finances."
          actionLabel="Add Account"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    {account.name}
                  </TableCell>
                  <TableCell>{account.bankName || '--'}</TableCell>
                  <TableCell>{account.currency}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(
                      parseFloat(String(account.currentBalance)),
                      account.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.isActive ? 'default' : 'secondary'}>
                      {account.isActive ? 'Active' : 'Inactive'}
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
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(account.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
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
            <DialogTitle>New Bank Account</DialogTitle>
            <DialogDescription>
              Add a new bank account to track.
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
            <DialogTitle>Edit Bank Account</DialogTitle>
            <DialogDescription>
              Update the bank account details.
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

      {/* Delete confirmation */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank Account</DialogTitle>
            <DialogDescription>
              Are you sure? This will also delete all transactions for this account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
