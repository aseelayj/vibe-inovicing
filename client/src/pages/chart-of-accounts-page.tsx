import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  BookOpen,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Pencil,
  Loader2,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useSeedAccounts,
} from '@/hooks/use-accounts';
import { ACCOUNT_TYPES } from '@vibe/shared';
import type { Account } from '@vibe/shared';
import { formatCurrency } from '@/lib/format';

const TYPE_COLORS: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-green-100 text-green-700',
  expense: 'bg-orange-100 text-orange-700',
};

function AccountForm({
  accounts,
  editAccount,
  onSubmit,
  onCancel,
  isLoading,
}: {
  accounts: Account[];
  editAccount?: Account | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('chart-of-accounts');
  const { t: tc } = useTranslation('common');
  const [code, setCode] = useState(editAccount?.code ?? '');
  const [name, setName] = useState(editAccount?.name ?? '');
  const [nameAr, setNameAr] = useState(editAccount?.nameAr ?? '');
  const [type, setType] = useState<string>(editAccount?.type ?? 'expense');
  const [parentId, setParentId] = useState(
    editAccount?.parentId?.toString() ?? '',
  );
  const [description, setDescription] = useState(editAccount?.description ?? '');
  const [isActive, setIsActive] = useState(editAccount?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      code,
      name,
      nameAr: nameAr || null,
      type,
      parentId: parentId ? parseInt(parentId, 10) : null,
      description: description || null,
      isActive,
    });
  };

  // Filter out the account being edited and its descendants for parent dropdown
  const availableParents = accounts.filter((a) => {
    if (!editAccount) return true;
    return a.id !== editAccount.id;
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('codeRequired')}
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('codePlaceholder')}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('typeRequired')}
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {ACCOUNT_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`types.${tp}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('nameRequired')}
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('nameAr')}
          </label>
          <Input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={t('nameArPlaceholder')}
            dir="rtl"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('parentAccount')}
        </label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">{t('noParent')}</option>
          {availableParents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} - {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('description')}
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor="isActive" className="text-sm font-medium">
          {t('active')}
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !code.trim() || !name.trim()}
        >
          {isLoading ? t('saving') : editAccount ? tc('save') : tc('create')}
        </Button>
      </div>
    </form>
  );
}

function AccountRow({
  account,
  allAccounts,
  expandedIds,
  toggleExpand,
  depth,
  onEdit,
  onDelete,
}: {
  account: Account;
  allAccounts: Account[];
  expandedIds: Set<number>;
  toggleExpand: (id: number) => void;
  depth: number;
  onEdit: (account: Account) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('chart-of-accounts');
  const { t: tc } = useTranslation('common');

  const children = allAccounts.filter((a) => a.parentId === account.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(account.id);

  return (
    <>
      <TableRow className={!account.isActive ? 'opacity-50' : ''}>
        <TableCell>
          <div
            className="flex items-center gap-1"
            style={{ paddingInlineStart: `${depth * 1.5}rem` }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(account.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="inline-block w-5" />
            )}
            <span className="font-mono text-sm font-medium">
              {account.code}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <span className={hasChildren ? 'font-semibold' : ''}>
              {account.name}
            </span>
            {account.nameAr && (
              <span className="ms-2 text-xs text-muted-foreground" dir="rtl">
                {account.nameAr}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={`text-xs ${TYPE_COLORS[account.type] || ''}`}
          >
            {t(`types.${account.type}`)}
          </Badge>
        </TableCell>
        <TableCell className="text-end font-mono text-sm">
          {formatCurrency(parseFloat(String(account.balance)))}
        </TableCell>
        <TableCell>
          {!account.isActive && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t('inactive')}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={tc('actions')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Pencil className="h-4 w-4" />
                {tc('edit')}
              </DropdownMenuItem>
              {!account.isSystem && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(account.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  {tc('delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {hasChildren &&
        isExpanded &&
        children.map((child) => (
          <AccountRow
            key={child.id}
            account={child}
            allAccounts={allAccounts}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            depth={depth + 1}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

export function ChartOfAccountsPage() {
  const { t } = useTranslation('chart-of-accounts');
  const { t: tc } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const seedAccounts = useSeedAccounts();

  const allAccounts = (Array.isArray(data) ? data : data ?? []) as Account[];

  // Filter by search and type
  const filteredAccounts = allAccounts.filter((acct) => {
    const matchesSearch =
      !search ||
      acct.code.toLowerCase().includes(search.toLowerCase()) ||
      acct.name.toLowerCase().includes(search.toLowerCase()) ||
      (acct.nameAr && acct.nameAr.includes(search));

    const matchesType = typeFilter === 'all' || acct.type === typeFilter;

    return matchesSearch && matchesType;
  });

  // Get root accounts (no parent, or parent not in filtered list)
  const rootAccounts = filteredAccounts.filter((acct) => {
    if (!acct.parentId) return true;
    // If filtering, show all matching accounts as roots
    if (search || typeFilter !== 'all') return true;
    return false;
  });

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(allAccounts.map((a) => a.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

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

  const handleSeed = async () => {
    try {
      await seedAccounts.mutateAsync();
      expandAll();
    } catch {
      // handled
    }
  };

  const isFiltering = search || typeFilter !== 'all';
  const displayAccounts = isFiltering ? filteredAccounts : rootAccounts;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            className="sm:size-default"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('addAccount')}</span>
            <span className="sm:hidden">{t('add')}</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border p-0.5">
          {[
            { key: 'all', label: t('allTypes') },
            ...ACCOUNT_TYPES.map((tp) => ({
              key: tp,
              label: t(`types.${tp}`),
            })),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60 ps-9"
          />
        </div>

        {!isFiltering && allAccounts.length > 0 && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              {t('expandAll')}
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              {t('collapseAll')}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : allAccounts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('noAccounts')}
          description={t('noAccountsDesc')}
        >
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('addAccount')}
            </Button>
            <Button onClick={handleSeed} disabled={seedAccounts.isPending}>
              {seedAccounts.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {t('seedDefaults')}
            </Button>
          </div>
        </EmptyState>
      ) : displayAccounts.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('noResults')}
          description={t('noResultsDesc')}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">{t('code')}</TableHead>
                <TableHead>{t('accountName')}</TableHead>
                <TableHead className="w-32">{t('type')}</TableHead>
                <TableHead className="w-36 text-end">{t('balance')}</TableHead>
                <TableHead className="w-24">{t('status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFiltering
                ? displayAccounts.map((acct) => (
                    <AccountRow
                      key={acct.id}
                      account={acct}
                      allAccounts={allAccounts}
                      expandedIds={expandedIds}
                      toggleExpand={toggleExpand}
                      depth={0}
                      onEdit={setEditAccount}
                      onDelete={setDeleteId}
                    />
                  ))
                : displayAccounts.map((acct) => (
                    <AccountRow
                      key={acct.id}
                      account={acct}
                      allAccounts={allAccounts}
                      expandedIds={expandedIds}
                      toggleExpand={toggleExpand}
                      depth={0}
                      onEdit={setEditAccount}
                      onDelete={setDeleteId}
                    />
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary cards */}
      {allAccounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ACCOUNT_TYPES.map((tp) => {
            const count = allAccounts.filter((a) => a.type === tp).length;
            return (
              <div
                key={tp}
                className="rounded-lg border bg-card p-3 text-center shadow-sm"
              >
                <p className="text-xs text-muted-foreground">
                  {t(`types.${tp}`)}
                </p>
                <p className="text-lg font-bold">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => !open && setShowCreate(false)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newAccountDialog')}</DialogTitle>
            <DialogDescription>{t('newAccountDesc')}</DialogDescription>
          </DialogHeader>
          <AccountForm
            accounts={allAccounts}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editAccountDialog')}</DialogTitle>
            <DialogDescription>{t('editAccountDesc')}</DialogDescription>
          </DialogHeader>
          {editAccount && (
            <AccountForm
              accounts={allAccounts}
              editAccount={editAccount}
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
            <DialogTitle>{t('deleteAccount')}</DialogTitle>
            <DialogDescription>{t('deleteAccountConfirm')}</DialogDescription>
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
              {deleteAccount.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
