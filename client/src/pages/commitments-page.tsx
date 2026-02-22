import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
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
  useCommitments,
  useCommitmentSummary,
  useCreateCommitment,
  useUpdateCommitment,
  useDeleteCommitment,
} from '@/hooks/use-commitments';
import { formatCurrency } from '@/lib/format';
import {
  COMMITMENT_CATEGORIES,
  COMMITMENT_FREQUENCIES,
  CURRENCIES,
} from '@vibe/shared';
import type {
  Commitment,
  CommitmentCategory,
  CommitmentFrequency,
  Currency,
} from '@vibe/shared';

function CommitmentForm({
  commitment,
  onSubmit,
  onCancel,
  isLoading,
}: {
  commitment?: Commitment;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('commitments');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState(commitment?.name ?? '');
  const [category, setCategory] = useState<CommitmentCategory>(
    commitment?.category ?? 'rent',
  );
  const [amount, setAmount] = useState(
    commitment?.amount?.toString() ?? '',
  );
  const [currency, setCurrency] = useState<Currency>(
    commitment?.currency ?? 'JOD',
  );
  const [frequency, setFrequency] = useState<CommitmentFrequency>(
    commitment?.frequency ?? 'monthly',
  );
  const [dueDay, setDueDay] = useState(
    commitment?.dueDay?.toString() ?? '',
  );
  const [notes, setNotes] = useState(commitment?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      category,
      amount: parseFloat(amount) || 0,
      currency,
      frequency,
      dueDay: dueDay ? parseInt(dueDay, 10) : null,
      isActive: commitment?.isActive ?? true,
      notes: notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t('commitmentName')} *
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('category')} *
          </label>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as CommitmentCategory)
            }
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {COMMITMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('frequency')} *
          </label>
          <select
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as CommitmentFrequency)
            }
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {COMMITMENT_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {t(`frequencies.${f}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {tc('amount')} *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {tc('currency')}
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('dueDay')}
          </label>
          <Input
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            placeholder={t('dueDayPlaceholder')}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {tc('notes')}
        </label>
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
        <Button
          type="submit"
          disabled={isLoading || !name.trim() || !amount}
        >
          {isLoading
            ? tc('saving')
            : commitment
              ? tc('update')
              : tc('create')}
        </Button>
      </div>
    </form>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  rent: 'bg-blue-100 text-blue-700',
  electricity: 'bg-yellow-100 text-yellow-700',
  water: 'bg-cyan-100 text-cyan-700',
  internet: 'bg-purple-100 text-purple-700',
  phone: 'bg-indigo-100 text-indigo-700',
  ssk: 'bg-green-100 text-green-700',
  wages: 'bg-orange-100 text-orange-700',
  insurance: 'bg-red-100 text-red-700',
  subscriptions: 'bg-pink-100 text-pink-700',
  loans: 'bg-rose-100 text-rose-700',
  maintenance: 'bg-amber-100 text-amber-700',
  cleaning: 'bg-teal-100 text-teal-700',
  government_fees: 'bg-slate-100 text-slate-700',
  other: 'bg-gray-100 text-gray-700',
};

export function CommitmentsPage() {
  const { t } = useTranslation('commitments');
  const { t: tc } = useTranslation('common');
  const [showCreate, setShowCreate] = useState(false);
  const [editCommitment, setEditCommitment] = useState<Commitment | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: commitmentsData, isLoading } = useCommitments();
  const { data: summary } = useCommitmentSummary();
  const createCommitment = useCreateCommitment();
  const updateCommitment = useUpdateCommitment();
  const deleteCommitment = useDeleteCommitment();

  const items = commitmentsData ?? [];

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      await createCommitment.mutateAsync(formData);
      setShowCreate(false);
    } catch {
      // handled by hook
    }
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editCommitment) return;
    try {
      await updateCommitment.mutateAsync({
        id: editCommitment.id,
        data: formData,
      });
      setEditCommitment(null);
    } catch {
      // handled
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteCommitment.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled
    }
  };

  const handleToggleActive = async (commitment: Commitment) => {
    try {
      await updateCommitment.mutateAsync({
        id: commitment.id,
        data: { isActive: !commitment.isActive },
      });
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 sm:size-default"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('addCommitment')}</span>
          <span className="sm:hidden">{tc('add')}</span>
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label={t('monthlyTotal')}
            value={formatCurrency(summary.totalMonthly, 'JOD')}
            sublabel={t('activeCommitments', {
              count: summary.activeCount,
            })}
          />
          <SummaryCard
            label={t('yearlyTotal')}
            value={formatCurrency(summary.totalYearly, 'JOD')}
          />
          <SummaryCard
            label={t('topCategory')}
            value={
              summary.byCategory.length > 0
                ? t(`categories.${summary.byCategory[0].category}`)
                : '--'
            }
            sublabel={
              summary.byCategory.length > 0
                ? formatCurrency(summary.byCategory[0].total, 'JOD') +
                  ' / ' +
                  t('month')
                : undefined
            }
          />
        </div>
      )}

      {/* Category breakdown */}
      {summary && summary.byCategory.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            {t('monthlyCategoryBreakdown')}
          </h3>
          <div className="space-y-2">
            {summary.byCategory.map((cat) => {
              const pct =
                summary.totalMonthly > 0
                  ? (cat.total / summary.totalMonthly) * 100
                  : 0;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm">
                    {t(`categories.${cat.category}`)}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 start-0 rounded-full bg-primary/70 transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-end text-sm font-medium">
                    {formatCurrency(cat.total, 'JOD')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commitments table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          actionLabel={t('addCommitment')}
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc('name')}</TableHead>
                <TableHead>{t('category')}</TableHead>
                <TableHead className="text-end">{tc('amount')}</TableHead>
                <TableHead>{t('frequency')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t('dueDay')}
                </TableHead>
                <TableHead>{tc('status')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className={!item.isActive ? 'opacity-50' : undefined}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium">{item.name}</span>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other
                      }
                    >
                      {t(`categories.${item.category}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end font-mono">
                    {formatCurrency(
                      parseFloat(String(item.amount)),
                      item.currency,
                    )}
                  </TableCell>
                  <TableCell>{t(`frequencies.${item.frequency}`)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {item.dueDay ? item.dueDay : '--'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.isActive ? 'default' : 'secondary'}
                    >
                      {item.isActive ? tc('active') : tc('inactive')}
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
                          onClick={() => setEditCommitment(item)}
                        >
                          <Pencil className="h-4 w-4" />
                          {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(item)}
                        >
                          {item.isActive ? (
                            <>
                              <PowerOff className="h-4 w-4" />
                              {t('deactivate')}
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4" />
                              {t('activate')}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(item.id)}
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
            <DialogDescription>{t('newDescription')}</DialogDescription>
          </DialogHeader>
          <CommitmentForm
            onSubmit={handleCreate}
            isLoading={createCommitment.isPending}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editCommitment !== null}
        onOpenChange={(open) => !open && setEditCommitment(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
          </DialogHeader>
          {editCommitment && (
            <CommitmentForm
              commitment={editCommitment}
              onSubmit={handleUpdate}
              isLoading={updateCommitment.isPending}
              onCancel={() => setEditCommitment(null)}
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
            <DialogDescription>{t('deleteMessage')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCommitment.isPending}
            >
              {deleteCommitment.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
