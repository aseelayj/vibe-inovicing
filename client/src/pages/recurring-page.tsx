import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Power,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { CURRENCIES, RECURRING_FREQUENCIES } from '@vibe/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientPicker } from '@/components/clients/client-picker';
import {
  useRecurring,
  useCreateRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
  useToggleRecurring,
} from '@/hooks/use-recurring';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface RecurringFormData {
  clientId: number | null;
  frequency: string;
  startDate: string;
  endDate: string;
  currency: string;
  taxRate: number;
  isTaxable: boolean;
  autoSend: boolean;
  notes: string;
  terms: string;
  lineItems: LineItem[];
}

const emptyForm: RecurringFormData = {
  clientId: null,
  frequency: 'monthly',
  startDate: '',
  endDate: '',
  currency: 'USD',
  taxRate: 0,
  isTaxable: false,
  autoSend: false,
  notes: '',
  terms: '',
  lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
};

export function RecurringPage() {
  const { t } = useTranslation('recurring');
  const { t: tc } = useTranslation('common');
  const { data, isLoading } = useRecurring();
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const deleteRecurring = useDeleteRecurring();
  const toggleRecurring = useToggleRecurring();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [form, setForm] = useState<RecurringFormData>({ ...emptyForm });

  const items = Array.isArray(data) ? data : (data as any)?.data ?? [];

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setForm({
      clientId: item.clientId ?? null,
      frequency: item.frequency || 'monthly',
      startDate: item.startDate?.split('T')[0] || '',
      endDate: item.endDate?.split('T')[0] || '',
      currency: item.currency || 'USD',
      taxRate: item.taxRate ?? 0,
      isTaxable: item.isTaxable ?? false,
      autoSend: item.autoSend ?? false,
      notes: item.notes || '',
      terms: item.terms || '',
      lineItems: item.lineItems?.length
        ? item.lineItems.map((li: any) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          }))
        : [{ description: '', quantity: 1, unitPrice: 0 }],
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleSubmitForm = async () => {
    const payload: Record<string, unknown> = {
      clientId: form.clientId,
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || null,
      currency: form.currency,
      taxRate: form.isTaxable ? 16 : 0,
      isTaxable: form.isTaxable,
      autoSend: form.autoSend,
      notes: form.notes,
      terms: form.terms,
      lineItems: form.lineItems.filter((li) => li.description.trim()),
    };

    try {
      if (editId) {
        await updateRecurring.mutateAsync({ id: editId, data: payload });
      } else {
        await createRecurring.mutateAsync(payload);
      }
      setShowForm(false);
      setEditId(null);
    } catch {
      // handled by mutation
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteRecurring.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by mutation
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleRecurring.mutateAsync(id);
    } catch {
      // handled by mutation
    }
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItem,
    value: string | number,
  ) => {
    const updated = [...form.lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, lineItems: updated });
  };

  const addLineItem = () => {
    setForm({
      ...form,
      lineItems: [...form.lineItems, { description: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const removeLineItem = (index: number) => {
    const updated = form.lineItems.filter((_, i) => i !== index);
    setForm({
      ...form,
      lineItems: updated.length ? updated : [{ description: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const subtotal = form.lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const taxAmount = subtotal * ((form.isTaxable ? 16 : 0) / 100);
  const total = subtotal + taxAmount;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {t('title')}
          </h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <Button size="sm" className="shrink-0 sm:size-default" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('newRecurring')}</span>
          <span className="sm:hidden">{tc('new')}</span>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          actionLabel={t('createRecurring')}
          onAction={openCreate}
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc('client')}</TableHead>
                <TableHead>{t('frequency')}</TableHead>
                <TableHead>{t('nextRun')}</TableHead>
                <TableHead>{t('lastRun')}</TableHead>
                <TableHead>{tc('status')}</TableHead>
                <TableHead className="text-end">{tc('amount')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.client?.name || t('noClient')}
                  </TableCell>
                  <TableCell className="capitalize">
                    {t(item.frequency)}
                  </TableCell>
                  <TableCell>
                    {item.nextRunDate ? formatDate(item.nextRunDate) : '--'}
                  </TableCell>
                  <TableCell>
                    {item.lastRunDate ? formatDate(item.lastRunDate) : '--'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.isActive ? 'default' : 'secondary'}
                    >
                      {item.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    {formatCurrency(item.total ?? 0, item.currency)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailItem(item)}>
                          <Eye className="h-4 w-4" />
                          {t('viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(item.id)}>
                          <Power className="h-4 w-4" />
                          {item.isActive ? t('deactivate') : t('activate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                          {tc('edit')}
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

      {/* Detail Dialog */}
      <Dialog
        open={detailItem !== null}
        onOpenChange={(open) => !open && setDetailItem(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('detailsTitle')}</DialogTitle>
            <DialogDescription>
              {detailItem?.client?.name || t('noClient')} -{' '}
              {t(detailItem?.frequency)}
            </DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">{t('frequency')}</p>
                  <p className="font-medium capitalize">
                    {t(detailItem.frequency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{tc('status')}</p>
                  <Badge
                    variant={detailItem.isActive ? 'default' : 'secondary'}
                  >
                    {detailItem.isActive ? t('active') : t('inactive')}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('startDate')}</p>
                  <p className="font-medium">
                    {detailItem.startDate
                      ? formatDate(detailItem.startDate)
                      : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('endDate')}</p>
                  <p className="font-medium">
                    {detailItem.endDate
                      ? formatDate(detailItem.endDate)
                      : t('noEndDate')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('nextRun')}</p>
                  <p className="font-medium">
                    {detailItem.nextRunDate
                      ? formatDate(detailItem.nextRunDate)
                      : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('autoSend')}</p>
                  <p className="font-medium">
                    {detailItem.autoSend ? tc('yes') : tc('no')}
                  </p>
                </div>
              </div>
              {detailItem.lineItems?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-medium">{tc('lineItems')}</p>
                    <div className="space-y-1 text-sm">
                      {detailItem.lineItems.map((li: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {li.description} x{li.quantity}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(
                              li.quantity * li.unitPrice,
                              detailItem.currency,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>{tc('total')}</span>
                <span>
                  {formatCurrency(
                    detailItem.total ?? 0,
                    detailItem.currency,
                  )}
                </span>
              </div>
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? t('editTitle') : t('newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editId
                ? t('editDescription')
                : t('newDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <ClientPicker
              value={form.clientId}
              onChange={(clientId) => setForm({ ...form, clientId })}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('frequency')}</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(val) => setForm({ ...form, frequency: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectFrequency')} />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tc('currency')}</Label>
                <Select
                  value={form.currency}
                  onValueChange={(val) => setForm({ ...form, currency: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tc('selectCurrency')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rec-startDate">{t('startDate')}</Label>
                <Input
                  id="rec-startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-endDate">{t('endDateOptional')}</Label>
                <Input
                  id="rec-endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="rec-isTaxable" className="text-sm font-medium">
                  {t('subjectToTax')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {form.isTaxable
                    ? t('taxableLabel')
                    : t('exemptLabel')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                id="rec-isTaxable"
                aria-checked={form.isTaxable}
                onClick={() => {
                  const next = !form.isTaxable;
                  setForm({
                    ...form,
                    isTaxable: next,
                    taxRate: next ? 16 : 0,
                  });
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  form.isTaxable ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                    form.isTaxable ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rec-taxRate">{tc('taxRate')}</Label>
                <Input
                  id="rec-taxRate"
                  type="number"
                  value={form.isTaxable ? 16 : 0}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <input
                  id="rec-autoSend"
                  type="checkbox"
                  checked={form.autoSend}
                  onChange={(e) =>
                    setForm({ ...form, autoSend: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="rec-autoSend">{t('autoSendInvoices')}</Label>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>{tc('lineItems')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addLineItem}
                >
                  <Plus className="h-4 w-4" />
                  {tc('addItem')}
                </Button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-5">{tc('description')}</div>
                  <div className="col-span-2">{tc('qty')}</div>
                  <div className="col-span-2">{tc('price')}</div>
                  <div className="col-span-2 text-end">{tc('amount')}</div>
                  <div className="col-span-1" />
                </div>
                {form.lineItems.map((item, index) => {
                  const amount =
                    (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                  return (
                    <div
                      key={index}
                      className="grid grid-cols-12 items-start gap-2"
                    >
                      <div className="col-span-5">
                        <Input
                          placeholder={tc('description')}
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(index, 'description', e.target.value)
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(
                              index,
                              'quantity',
                              Number(e.target.value) || 0,
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateLineItem(
                              index,
                              'unitPrice',
                              Number(e.target.value) || 0,
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 flex h-9 items-center justify-end text-sm font-medium">
                        {formatCurrency(amount, form.currency)}
                      </div>
                      <div className="col-span-1 flex h-9 items-center justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex justify-end">
                <div className="w-56 space-y-2 pt-2">
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tc('subtotal')}</span>
                    <span>{formatCurrency(subtotal, form.currency)}</span>
                  </div>
                  {form.isTaxable && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tc('tax')} ({form.isTaxable ? 16 : 0}%)
                      </span>
                      <span>{formatCurrency(taxAmount, form.currency)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>{tc('total')}</span>
                    <span>{formatCurrency(total, form.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rec-notes">{tc('notes')}</Label>
                <Textarea
                  id="rec-notes"
                  rows={2}
                  placeholder={t('notesPlaceholder')}
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-terms">{tc('termsAndConditions')}</Label>
                <Textarea
                  id="rec-terms"
                  rows={2}
                  placeholder={t('termsPlaceholder')}
                  value={form.terms}
                  onChange={(e) =>
                    setForm({ ...form, terms: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleSubmitForm}
              disabled={createRecurring.isPending || updateRecurring.isPending}
            >
              {(createRecurring.isPending || updateRecurring.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editId ? tc('update') : tc('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        confirmText={tc('delete')}
        variant="danger"
        loading={deleteRecurring.isPending}
      />
    </div>
  );
}
