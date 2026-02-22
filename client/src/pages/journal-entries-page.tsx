import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  BookOpenCheck,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
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
  useJournalEntries,
  useCreateJournalEntry,
  useDeleteJournalEntry,
  usePostJournalEntry,
  useVoidJournalEntry,
} from '@/hooks/use-journal-entries';
import { useAccounts } from '@/hooks/use-accounts';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Account } from '@vibe/shared';

interface LineInput {
  accountId: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
}

const emptyLine = (): LineInput => ({
  accountId: '',
  description: '',
  debitAmount: '',
  creditAmount: '',
});

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
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<LineInput[]>([emptyLine(), emptyLine()]);

  const activeAccounts = accounts.filter((a) => a.isActive);

  const totalDebit = lines.reduce(
    (s, l) => s + (parseFloat(l.debitAmount) || 0),
    0,
  );
  const totalCredit = lines.reduce(
    (s, l) => s + (parseFloat(l.creditAmount) || 0),
    0,
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const difference = totalDebit - totalCredit;

  const updateLine = (idx: number, field: keyof LineInput, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    // Clear opposite side when entering a value
    if (field === 'debitAmount' && value) {
      updated[idx].creditAmount = '';
    } else if (field === 'creditAmount' && value) {
      updated[idx].debitAmount = '';
    }
    setLines(updated);
  };

  const addLine = () => setLines([...lines, emptyLine()]);

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return;

    onSubmit({
      entryDate,
      reference: reference || null,
      description,
      memo: memo || null,
      lines: lines
        .filter((l) => l.accountId && (l.debitAmount || l.creditAmount))
        .map((l) => ({
          accountId: Number(l.accountId),
          description: l.description || null,
          debitAmount: parseFloat(l.debitAmount) || 0,
          creditAmount: parseFloat(l.creditAmount) || 0,
        })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('form.date')} *
          </label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
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
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {t('form.description')} *
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
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

      {/* Line Items */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t('form.lineItems')} *
        </label>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">{t('form.account')}</TableHead>
                <TableHead>{t('form.lineDescription')}</TableHead>
                <TableHead className="w-[130px]">{t('form.debit')}</TableHead>
                <TableHead className="w-[130px]">{t('form.credit')}</TableHead>
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
                      required
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">{t('form.selectAccount')}</option>
                      {activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) =>
                        updateLine(idx, 'description', e.target.value)
                      }
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                      placeholder={t('form.optional')}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debitAmount}
                      onChange={(e) =>
                        updateLine(idx, 'debitAmount', e.target.value)
                      }
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-right"
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.creditAmount}
                      onChange={(e) =>
                        updateLine(idx, 'creditAmount', e.target.value)
                      }
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-right"
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    {lines.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={2} className="text-right">
                  {t('form.totals')}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalDebit, 'USD')}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalCredit, 'USD')}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-3 w-3" />
            {t('form.addLine')}
          </Button>
          {!isBalanced && totalDebit + totalCredit > 0 && (
            <p className="text-sm text-destructive">
              {t('form.outOfBalance', {
                amount: formatCurrency(Math.abs(difference), 'USD'),
              })}
            </p>
          )}
          {isBalanced && totalDebit > 0 && (
            <p className="text-sm text-green-600">{t('form.balanced')}</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || !isBalanced}>
          {isLoading ? tc('saving') : tc('save')}
        </Button>
      </DialogFooter>
    </form>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  posted: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
};

export function JournalEntriesPage() {
  const { t } = useTranslation('journal-entries');
  const { t: tc } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: entriesData, isLoading } = useJournalEntries(
    1,
    50,
    statusFilter,
  );
  const { data: accounts = [] } = useAccounts();
  const createEntry = useCreateJournalEntry();
  const deleteEntry = useDeleteJournalEntry();
  const postEntry = usePostJournalEntry();
  const voidEntry = useVoidJournalEntry();

  const entries = (entriesData as any)?.data ?? entriesData ?? [];

  const handleCreate = (data: Record<string, unknown>) => {
    createEntry.mutate(data, {
      onSuccess: () => setShowForm(false),
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteEntry.mutate(deleteId, {
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
          {t('addEntry')}
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'draft', 'posted', 'voided'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {t(`statusFilter.${s}`)}
          </Button>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addEntry')}
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('table.number')}</TableHead>
                <TableHead>{t('table.date')}</TableHead>
                <TableHead>{t('table.description')}</TableHead>
                <TableHead className="text-right">{t('table.debit')}</TableHead>
                <TableHead className="text-right">{t('table.credit')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: any) => (
                <>
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === entry.id ? null : entry.id)
                    }
                  >
                    <TableCell>
                      {expandedId === entry.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.entryNumber}
                    </TableCell>
                    <TableCell>{formatDate(entry.entryDate)}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(entry.totalDebit), 'USD')}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(entry.totalCredit), 'USD')}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[entry.status] || ''}>
                        {t(`status.${entry.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                postEntry.mutate(entry.id);
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {t('actions.post')}
                            </DropdownMenuItem>
                          )}
                          {entry.status === 'posted' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                voidEntry.mutate(entry.id);
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              {t('actions.void')}
                            </DropdownMenuItem>
                          )}
                          {entry.status === 'draft' && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(entry.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tc('delete')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {/* Expanded Lines */}
                  {expandedId === entry.id && entry.lines && (
                    <TableRow key={`${entry.id}-lines`}>
                      <TableCell colSpan={8} className="bg-muted/20 p-0">
                        <div className="px-8 py-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('lines.account')}</TableHead>
                                <TableHead>{t('lines.description')}</TableHead>
                                <TableHead className="text-right">
                                  {t('lines.debit')}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t('lines.credit')}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entry.lines.map((line: any) => (
                                <TableRow key={line.id}>
                                  <TableCell>
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {line.account?.code}
                                    </span>{' '}
                                    {line.account?.name}
                                  </TableCell>
                                  <TableCell>
                                    {line.description || '—'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {Number(line.debitAmount) > 0
                                      ? formatCurrency(
                                          Number(line.debitAmount),
                                          'USD',
                                        )
                                      : ''}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {Number(line.creditAmount) > 0
                                      ? formatCurrency(
                                          Number(line.creditAmount),
                                          'USD',
                                        )
                                      : ''}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Journal Entry Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('addEntry')}</DialogTitle>
            <DialogDescription>{t('form.subtitle')}</DialogDescription>
          </DialogHeader>
          <JournalEntryForm
            accounts={accounts as Account[]}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createEntry.isPending}
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
              disabled={deleteEntry.isPending}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
