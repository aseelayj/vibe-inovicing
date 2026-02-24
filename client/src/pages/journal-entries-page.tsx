import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  BookText,
  MoreHorizontal,
  Trash2,
  CheckCircle,
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
  useJournalEntries,
  useCreateJournalEntry,
  useDeleteJournalEntry,
  usePostJournalEntry,
} from '@/hooks/use-journal-entries';
import { useAccounts } from '@/hooks/use-accounts';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Account } from '@vibe/shared';

interface LineInput {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

function JournalEntryForm({
  accounts,
  onSubmit,
  onCancel,
  isLoading,
}: {
  accounts: Account[];
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('journal-entries');
  const { t: tc } = useTranslation('common');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineInput[]>([
    { accountId: '', description: '', debit: '', credit: '' },
    { accountId: '', description: '', debit: '', credit: '' },
  ]);

  const activeAccounts = accounts.filter((a) => a.isActive);

  const addLine = () => {
    setLines([...lines, { accountId: '', description: '', debit: '', credit: '' }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof LineInput, value: string) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      date,
      description,
      reference: reference || null,
      notes: notes || null,
      lines: lines
        .filter((l) => l.accountId)
        .map((l) => ({
          accountId: parseInt(l.accountId, 10),
          description: l.description || null,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
    });
  };

  const validLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) || parseFloat(l.credit)));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('dateRequired')}
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('reference')}
          </label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('referencePlaceholder')}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('descriptionRequired')}
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('notesLabel')}
        </label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
        />
      </div>

      {/* Lines */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t('lines')}</label>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3 w-3" />
            {t('addLine')}
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">{t('account')}</TableHead>
                <TableHead>{t('lineDescription')}</TableHead>
                <TableHead className="w-28 text-end">{t('debit')}</TableHead>
                <TableHead className="w-28 text-end">{t('credit')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(idx, 'accountId', e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      required
                    >
                      <option value="">{t('selectAccount')}</option>
                      {activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm"
                      value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      placeholder={t('lineMemo')}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-end text-sm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      onChange={(e) => {
                        updateLine(idx, 'debit', e.target.value);
                        if (e.target.value) updateLine(idx, 'credit', '');
                      }}
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-end text-sm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(e) => {
                        updateLine(idx, 'credit', e.target.value);
                        if (e.target.value) updateLine(idx, 'debit', '');
                      }}
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    {lines.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={2} className="text-end text-sm">
                  {t('totals')}
                </TableCell>
                <TableCell className="text-end font-mono text-sm">
                  {totalDebit.toFixed(2)}
                </TableCell>
                <TableCell className="text-end font-mono text-sm">
                  {totalCredit.toFixed(2)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {!isBalanced && totalDebit + totalCredit > 0 && (
          <p className="text-sm text-destructive">
            {t('unbalancedWarning', {
              diff: Math.abs(totalDebit - totalCredit).toFixed(2),
            })}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={
            isLoading ||
            !description.trim() ||
            !isBalanced ||
            validLines.length < 2 ||
            totalDebit === 0
          }
        >
          {isLoading ? t('saving') : tc('create')}
        </Button>
      </div>
    </form>
  );
}

export function JournalEntriesPage() {
  const { t } = useTranslation('journal-entries');
  const { t: tc } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useJournalEntries({
    search,
    status: statusFilter,
  });
  const { data: accountsData } = useAccounts();
  const createEntry = useCreateJournalEntry();
  const deleteEntry = useDeleteJournalEntry();
  const postEntry = usePostJournalEntry();

  const entries = (Array.isArray(data) ? data : data?.data ?? []) as any[];
  const allAccounts = (Array.isArray(accountsData) ? accountsData : accountsData ?? []) as Account[];

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      await createEntry.mutateAsync(formData);
      setShowCreate(false);
    } catch {
      // handled
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteEntry.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled
    }
  };

  const handlePost = async (id: number) => {
    try {
      await postEntry.mutateAsync(id);
    } catch {
      // handled
    }
  };

  const statusTabs = [
    { key: 'all', label: t('allFilter') },
    { key: 'draft', label: t('draft') },
    { key: 'posted', label: t('posted') },
  ];

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
          <Button size="sm" className="sm:size-default" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('addEntry')}</span>
            <span className="sm:hidden">{t('add')}</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border p-0.5">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
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
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookText}
          title={t('noEntries')}
          description={
            search || statusFilter !== 'all'
              ? t('noEntriesFilterDesc')
              : t('noEntriesDesc')
          }
          actionLabel={
            !search && statusFilter === 'all' ? t('addEntry') : undefined
          }
          onAction={
            !search && statusFilter === 'all'
              ? () => setShowCreate(true)
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">{t('entryNumber')}</TableHead>
                <TableHead className="w-28">{t('date')}</TableHead>
                <TableHead>{t('description')}</TableHead>
                <TableHead className="w-28">{t('reference')}</TableHead>
                <TableHead className="w-28 text-end">{t('totalAmount')}</TableHead>
                <TableHead className="w-24">{t('status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: any) => {
                const totalDebit = (entry.lines ?? []).reduce(
                  (sum: number, l: any) => sum + (parseFloat(l.debit) || 0),
                  0,
                );
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">
                      {entry.entryNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.reference ?? '--'}
                    </TableCell>
                    <TableCell className="text-end font-mono text-sm">
                      {formatCurrency(totalDebit)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.status === 'posted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }
                      >
                        {t(entry.status)}
                      </Badge>
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
                          {entry.status === 'draft' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handlePost(entry.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                                {t('post')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteId(entry.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                {tc('delete')}
                              </DropdownMenuItem>
                            </>
                          )}
                          {entry.status === 'posted' && (
                            <DropdownMenuItem disabled>
                              <CheckCircle className="h-4 w-4" />
                              {t('alreadyPosted')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => !open && setShowCreate(false)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('newEntryDialog')}</DialogTitle>
            <DialogDescription>{t('newEntryDesc')}</DialogDescription>
          </DialogHeader>
          <JournalEntryForm
            accounts={allAccounts}
            onSubmit={handleCreate}
            isLoading={createEntry.isPending}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteEntry')}</DialogTitle>
            <DialogDescription>{t('deleteEntryConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteEntry.isPending}
            >
              {deleteEntry.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
