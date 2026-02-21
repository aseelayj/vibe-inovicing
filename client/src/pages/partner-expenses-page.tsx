import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Pencil,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Sprout,
  CircleDollarSign,
  Receipt,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  usePartnerSummary,
  usePartnerCategories,
  usePartnerExpenses,
  useCreatePartnerExpense,
  useUpdatePartnerExpense,
  useDeletePartnerExpense,
  usePartnerPayments,
  useCreatePartnerPayment,
  useUpdatePartnerPayment,
  useDeletePartnerPayment,
  usePartnerEmployees,
  useCreatePartnerEmployee,
  useUpdatePartnerEmployee,
  useDeletePartnerEmployee,
  usePartnerSskEntries,
  useGeneratePartnerSsk,
  useUpdatePartnerSsk,
  useDeletePartnerSsk,
  useCreatePartnerCategory,
  useUpdatePartnerCategory,
  useDeletePartnerCategory,
  useSeedPartnerCategories,
} from '@/hooks/use-partner-expenses';
import type {
  PartnerExpenseCategory,
  PartnerExpense,
  PartnerPayment,
  PartnerEmployee,
  PartnerSskEntry,
  PartnerSskBreakdownItem,
} from '@vibe/shared';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function PartnerExpensesPage() {
  const { t } = useTranslation('partner-expenses');
  const [tab, setTab] = useState('summary');
  const [yearFilter, setYearFilter] = useState<number | undefined>(currentYear);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">{t('tabs.summary')}</TabsTrigger>
          <TabsTrigger value="expenses">{t('tabs.expenses')}</TabsTrigger>
          <TabsTrigger value="payments">{t('tabs.payments')}</TabsTrigger>
          <TabsTrigger value="ssk">{t('tabs.ssk')}</TabsTrigger>
          <TabsTrigger value="settings">{t('tabs.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummaryTab yearFilter={yearFilter} setYearFilter={setYearFilter} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab yearFilter={yearFilter} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab yearFilter={yearFilter} />
        </TabsContent>
        <TabsContent value="ssk">
          <SskTab yearFilter={yearFilter} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== Summary Tab =====================

function SummaryTab({
  yearFilter,
  setYearFilter,
}: {
  yearFilter: number | undefined;
  setYearFilter: (y: number | undefined) => void;
}) {
  const { t } = useTranslation('partner-expenses');
  const { data: summary, isLoading } = usePartnerSummary(
    yearFilter ? { year: yearFilter } : undefined,
  );

  if (isLoading) return <LoadingSpinner />;

  const s = summary ?? {
    totalExpenses: 0, totalSsk: 0, totalPayments: 0,
    balance: 0, expenseCount: 0, sskCount: 0, paymentCount: 0,
  };

  const balanceColor = s.balance > 0
    ? 'text-green-600' : s.balance < 0 ? 'text-red-600' : 'text-muted-foreground';
  const balanceLabel = s.balance > 0
    ? t('summary.partnerOwes')
    : s.balance < 0 ? t('summary.overpaid') : t('summary.settled');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label>{t('summary.yearFilter')}</Label>
        <Select
          value={yearFilter ? String(yearFilter) : 'all'}
          onValueChange={(v) => setYearFilter(v === 'all' ? undefined : Number(v))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('summary.allTime')}</SelectItem>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Receipt className="h-5 w-5 text-blue-600" />}
          label={t('summary.totalExpenses')}
          value={formatCurrency(s.totalExpenses, 'JOD')}
          sub={`${s.expenseCount} entries`}
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5 text-purple-600" />}
          label={t('summary.totalSsk')}
          value={formatCurrency(s.totalSsk, 'JOD')}
          sub={`${s.sskCount} months`}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5 text-green-600" />}
          label={t('summary.totalPayments')}
          value={formatCurrency(s.totalPayments, 'JOD')}
          sub={`${s.paymentCount} payments`}
        />
        <StatCard
          icon={<CircleDollarSign className={`h-5 w-5 ${balanceColor}`} />}
          label={t('summary.balance')}
          value={formatCurrency(Math.abs(s.balance), 'JOD')}
          sub={balanceLabel}
          valueClass={balanceColor}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold ${valueClass ?? ''}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================== Expenses Tab =====================

function ExpensesTab({ yearFilter }: { yearFilter?: number }) {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<PartnerExpense | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: categories } = usePartnerCategories();
  const { data: expenseData, isLoading } = usePartnerExpenses({
    year: yearFilter,
    pageSize: 200,
  });
  const createExpense = useCreatePartnerExpense();
  const updateExpense = useUpdatePartnerExpense();
  const deleteExpense = useDeletePartnerExpense();

  const expenses = (Array.isArray(expenseData) ? expenseData : (expenseData as any)?.data ?? []) as PartnerExpense[];
  const cats = (Array.isArray(categories) ? categories : []) as PartnerExpenseCategory[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('expenses.addExpense')}
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (expenses as PartnerExpense[]).length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('expenses.noExpenses')}
          description={t('expenses.noExpensesDesc')}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('expenses.date')}</TableHead>
                <TableHead>{t('expenses.category')}</TableHead>
                <TableHead>{t('expenses.description')}</TableHead>
                <TableHead className="text-end">{t('expenses.totalAmount')}</TableHead>
                <TableHead className="text-end">{t('expenses.splitPercent')}</TableHead>
                <TableHead className="text-end">{t('expenses.partnerShare')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expenses as PartnerExpense[]).map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>{formatDate(exp.date)}</TableCell>
                  <TableCell>
                    {exp.category?.nameEn || exp.category?.name || '-'}
                  </TableCell>
                  <TableCell>{exp.description}</TableCell>
                  <TableCell className="text-end">
                    {formatCurrency(exp.totalAmount, 'JOD')}
                  </TableCell>
                  <TableCell className="text-end">{exp.splitPercent}%</TableCell>
                  <TableCell className="text-end font-medium">
                    {formatCurrency(exp.partnerShare, 'JOD')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(exp)}>
                          <Pencil className="me-2 h-4 w-4" /> {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(exp.id)}
                        >
                          <Trash2 className="me-2 h-4 w-4" /> {tc('delete')}
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

      {/* Add/Edit Dialog */}
      <ExpenseDialog
        open={showAdd || !!editItem}
        onClose={() => { setShowAdd(false); setEditItem(null); }}
        categories={cats}
        expense={editItem}
        onSubmit={async (data) => {
          if (editItem) {
            await updateExpense.mutateAsync({ id: editItem.id, ...data });
          } else {
            await createExpense.mutateAsync(data);
          }
          setShowAdd(false);
          setEditItem(null);
        }}
        isPending={createExpense.isPending || updateExpense.isPending}
      />

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('expenses.delete')}</DialogTitle>
            <DialogDescription>{t('expenses.deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteId) await deleteExpense.mutateAsync(deleteId);
                setDeleteId(null);
              }}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseDialog({
  open,
  onClose,
  categories,
  expense,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  categories: PartnerExpenseCategory[];
  expense: PartnerExpense | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isPending: boolean;
}) {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [mode, setMode] = useState<'total' | 'direct'>('total');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [splitPercent, setSplitPercent] = useState('');
  const [partnerShare, setPartnerShare] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && expense) {
      setMode('total');
      setCategoryId(expense.categoryId);
      setDate(expense.date);
      setDescription(expense.description);
      setTotalAmount(String(expense.totalAmount));
      setSplitPercent(String(expense.splitPercent));
      setPartnerShare(String(expense.partnerShare));
      setNotes(expense.notes ?? '');
    }
  }, [open, expense?.id]);

  const handleCategoryChange = (catId: string) => {
    const id = catId === 'none' ? null : Number(catId);
    setCategoryId(id);
    if (id && mode === 'total') {
      const cat = categories.find((c) => c.id === id);
      if (cat) setSplitPercent(String(cat.defaultSplitPercent));
    }
  };

  const computedShare = mode === 'total'
    ? (parseFloat(totalAmount || '0') * parseFloat(splitPercent || '0') / 100)
      .toFixed(2)
    : partnerShare;

  const handleSubmit = () => {
    const share = mode === 'total'
      ? parseFloat(totalAmount || '0') * parseFloat(splitPercent || '0') / 100
      : parseFloat(partnerShare || '0');

    onSubmit({
      categoryId,
      date,
      description,
      totalAmount: mode === 'total'
        ? parseFloat(totalAmount || '0') : share,
      splitPercent: mode === 'total'
        ? parseFloat(splitPercent || '0') : 100,
      partnerShare: Math.round(share * 100) / 100,
      notes: notes || null,
    });
  };

  const reset = () => {
    setMode('total');
    setCategoryId(null);
    setDate('');
    setDescription('');
    setTotalAmount('');
    setSplitPercent('');
    setPartnerShare('');
    setNotes('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {expense ? t('expenses.editExpense') : t('expenses.addExpense')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === 'total' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('total')}
            >
              {t('expenses.calculateFromTotal')}
            </Button>
            <Button
              variant={mode === 'direct' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('direct')}
            >
              {t('expenses.enterDirectly')}
            </Button>
          </div>

          <div>
            <Label>{t('expenses.category')}</Label>
            <Select
              value={categoryId ? String(categoryId) : 'none'}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-</SelectItem>
                {categories.filter((c) => c.isActive).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nameEn || c.name} ({c.defaultSplitPercent}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t('expenses.date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <Label>{t('expenses.description')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {mode === 'total' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('expenses.totalAmount')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('expenses.splitPercent')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={splitPercent}
                    onChange={(e) => setSplitPercent(e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded bg-muted p-2 text-sm">
                {t('expenses.partnerShare')}:{' '}
                <strong>{formatCurrency(computedShare, 'JOD')}</strong>
              </div>
            </>
          ) : (
            <div>
              <Label>{t('expenses.partnerShare')}</Label>
              <Input
                type="number"
                step="0.01"
                value={partnerShare}
                onChange={(e) => setPartnerShare(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label>{t('expenses.notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>
            {tc('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !date || !description}>
            {isPending ? <LoadingSpinner /> : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Payments Tab =====================

function PaymentsTab({ yearFilter }: { yearFilter?: number }) {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<PartnerPayment | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: paymentData, isLoading } = usePartnerPayments({
    year: yearFilter,
    pageSize: 200,
  });
  const createPayment = useCreatePartnerPayment();
  const updatePayment = useUpdatePartnerPayment();
  const deletePayment = useDeletePartnerPayment();

  const payments = (Array.isArray(paymentData) ? paymentData : (paymentData as any)?.data ?? []) as PartnerPayment[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('payments.addPayment')}
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (payments as PartnerPayment[]).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t('payments.noPayments')}
          description={t('payments.noPaymentsDesc')}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payments.date')}</TableHead>
                <TableHead className="text-end">{t('payments.amount')}</TableHead>
                <TableHead>{t('payments.description')}</TableHead>
                <TableHead>{t('payments.method')}</TableHead>
                <TableHead>{t('payments.reference')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments as PartnerPayment[]).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell className="text-end font-medium">
                    {formatCurrency(p.amount, 'JOD')}
                  </TableCell>
                  <TableCell>{p.description || '-'}</TableCell>
                  <TableCell>
                    {p.paymentMethod
                      ? t(`payments.methods.${p.paymentMethod}`)
                      : '-'}
                  </TableCell>
                  <TableCell>{p.reference || '-'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(p)}>
                          <Pencil className="me-2 h-4 w-4" /> {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="me-2 h-4 w-4" /> {tc('delete')}
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

      {/* Add/Edit Dialog */}
      <PaymentDialog
        open={showAdd || !!editItem}
        onClose={() => { setShowAdd(false); setEditItem(null); }}
        payment={editItem}
        onSubmit={async (data) => {
          if (editItem) {
            await updatePayment.mutateAsync({ id: editItem.id, ...data });
          } else {
            await createPayment.mutateAsync(data);
          }
          setShowAdd(false);
          setEditItem(null);
        }}
        isPending={createPayment.isPending || updatePayment.isPending}
      />

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payments.delete')}</DialogTitle>
            <DialogDescription>{t('payments.deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteId) await deletePayment.mutateAsync(deleteId);
                setDeleteId(null);
              }}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentDialog({
  open,
  onClose,
  payment,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  payment: PartnerPayment | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isPending: boolean;
}) {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [date, setDate] = useState(payment?.date ?? '');
  const [amount, setAmount] = useState(payment ? String(payment.amount) : '');
  const [description, setDescription] = useState(payment?.description ?? '');
  const [method, setMethod] = useState(payment?.paymentMethod ?? '');
  const [reference, setReference] = useState(payment?.reference ?? '');
  const [notes, setNotes] = useState(payment?.notes ?? '');

  useEffect(() => {
    if (open && payment) {
      setDate(payment.date);
      setAmount(String(payment.amount));
      setDescription(payment.description ?? '');
      setMethod(payment.paymentMethod ?? '');
      setReference(payment.reference ?? '');
      setNotes(payment.notes ?? '');
    }
  }, [open, payment?.id]);

  const reset = () => {
    setDate(''); setAmount(''); setDescription('');
    setMethod(''); setReference(''); setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {payment ? t('payments.editPayment') : t('payments.addPayment')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('payments.date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>{t('payments.amount')}</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('payments.description')}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>{t('payments.method')}</Label>
            <Select value={method || 'none'} onValueChange={(v) => setMethod(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-</SelectItem>
                {(['cash', 'bank_transfer', 'check', 'other'] as const).map((m) => (
                  <SelectItem key={m} value={m}>{t(`payments.methods.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('payments.reference')}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <Label>{t('payments.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>
            {tc('cancel')}
          </Button>
          <Button
            onClick={() => onSubmit({
              date,
              amount: parseFloat(amount || '0'),
              description: description || null,
              paymentMethod: method || null,
              reference: reference || null,
              notes: notes || null,
            })}
            disabled={isPending || !date || !amount}
          >
            {isPending ? <LoadingSpinner /> : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== SSK Tab =====================

function SskTab({ yearFilter }: { yearFilter?: number }) {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [showGenerate, setShowGenerate] = useState(false);
  const [genYear, setGenYear] = useState(currentYear);
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: entries, isLoading } = usePartnerSskEntries(yearFilter);
  const generateSsk = useGeneratePartnerSsk();
  const updateSsk = useUpdatePartnerSsk();
  const deleteSsk = useDeletePartnerSsk();

  const sskEntries = (Array.isArray(entries) ? entries : []) as PartnerSskEntry[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowGenerate(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('ssk.generate')}
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : sskEntries.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t('ssk.noEntries')}
          description={t('ssk.noEntriesDesc')}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>{t('ssk.month')}/{t('ssk.year')}</TableHead>
                <TableHead>{t('ssk.employees')}</TableHead>
                <TableHead className="text-end">{t('ssk.totalAmount')}</TableHead>
                <TableHead>{t('ssk.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sskEntries.map((entry) => {
                const breakdown = (entry.breakdown ?? []) as PartnerSskBreakdownItem[];
                const isExpanded = expandedId === entry.id;
                return (
                  <Fragment key={entry.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {MONTHS[entry.month - 1]} {entry.year}
                      </TableCell>
                      <TableCell>{breakdown.length}</TableCell>
                      <TableCell className="text-end font-medium">
                        {formatCurrency(entry.totalAmount, 'JOD')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.isPaid ? 'default' : 'secondary'}
                          className="cursor-pointer"
                          onClick={() => updateSsk.mutate({
                            id: entry.id, isPaid: !entry.isPaid,
                          })}
                        >
                          {entry.isPaid ? t('ssk.paid') : t('ssk.unpaid')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(entry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${entry.id}-breakdown`}>
                        <TableCell colSpan={6} className="bg-muted/50 p-4">
                          <p className="mb-2 text-sm font-medium">
                            {t('ssk.breakdown')}
                          </p>
                          <div className="space-y-1">
                            {breakdown.map((b) => (
                              <div
                                key={b.employeeId}
                                className="flex justify-between text-sm"
                              >
                                <span>{b.name}</span>
                                <span>{formatCurrency(b.amount, 'JOD')}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('ssk.generate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('ssk.year')}</Label>
              <Select value={String(genYear)} onValueChange={(v) => setGenYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('ssk.month')}</Label>
              <Select value={String(genMonth)} onValueChange={(v) => setGenMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={async () => {
                await generateSsk.mutateAsync({ year: genYear, month: genMonth });
                setShowGenerate(false);
              }}
              disabled={generateSsk.isPending}
            >
              {generateSsk.isPending ? <LoadingSpinner /> : t('ssk.generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ssk.delete')}</DialogTitle>
            <DialogDescription>{t('ssk.deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteId) await deleteSsk.mutateAsync(deleteId);
                setDeleteId(null);
              }}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== Settings Tab =====================

function SettingsTab() {
  return (
    <div className="space-y-8">
      <CategoriesSettings />
      <EmployeesSettings />
    </div>
  );
}

function CategoriesSettings() {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<PartnerExpenseCategory | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: categories, isLoading } = usePartnerCategories();
  const createCategory = useCreatePartnerCategory();
  const updateCategory = useUpdatePartnerCategory();
  const deleteCategory = useDeletePartnerCategory();
  const seedCategories = useSeedPartnerCategories();

  const cats = (Array.isArray(categories) ? categories : []) as PartnerExpenseCategory[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.categories')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('settings.categoriesDesc')}
          </p>
        </div>
        <div className="flex gap-2">
          {cats.length === 0 && (
            <Button
              variant="outline"
              onClick={() => seedCategories.mutate()}
              disabled={seedCategories.isPending}
            >
              <Sprout className="me-2 h-4 w-4" />
              {t('settings.seedCategories')}
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="me-2 h-4 w-4" /> {t('settings.addCategory')}
          </Button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : cats.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('settings.noCategories')}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.nameAr')}</TableHead>
                <TableHead>{t('settings.nameEn')}</TableHead>
                <TableHead className="text-end">{t('settings.defaultSplit')}</TableHead>
                <TableHead>{t('settings.active')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cats.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>{cat.name}</TableCell>
                  <TableCell>{cat.nameEn || '-'}</TableCell>
                  <TableCell className="text-end">{cat.defaultSplitPercent}%</TableCell>
                  <TableCell>
                    <Switch
                      checked={cat.isActive}
                      onCheckedChange={(checked) =>
                        updateCategory.mutate({ id: cat.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(cat)}>
                          <Pencil className="me-2 h-4 w-4" /> {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(cat.id)}
                        >
                          <Trash2 className="me-2 h-4 w-4" /> {tc('delete')}
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

      <CategoryDialog
        open={showAdd || !!editItem}
        onClose={() => { setShowAdd(false); setEditItem(null); }}
        category={editItem}
        onSubmit={async (data) => {
          if (editItem) {
            await updateCategory.mutateAsync({ id: editItem.id, ...data });
          } else {
            await createCategory.mutateAsync(data);
          }
          setShowAdd(false);
          setEditItem(null);
        }}
        isPending={createCategory.isPending || updateCategory.isPending}
      />

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.deleteCategory')}</DialogTitle>
            <DialogDescription>{t('settings.deleteCategoryConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteId) await deleteCategory.mutateAsync(deleteId);
                setDeleteId(null);
              }}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryDialog({
  open,
  onClose,
  category,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  category: PartnerExpenseCategory | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isPending: boolean;
}) {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState(category?.name ?? '');
  const [nameEn, setNameEn] = useState(category?.nameEn ?? '');
  const [splitPercent, setSplitPercent] = useState(
    category ? String(category.defaultSplitPercent) : '50',
  );
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  useEffect(() => {
    if (open && category) {
      setName(category.name);
      setNameEn(category.nameEn ?? '');
      setSplitPercent(String(category.defaultSplitPercent));
      setIsActive(category.isActive);
    }
  }, [open, category?.id]);

  const reset = () => {
    setName(''); setNameEn(''); setSplitPercent('50'); setIsActive(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {category ? t('settings.editCategory') : t('settings.addCategory')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('settings.nameAr')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t('settings.nameEn')}</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div>
            <Label>{t('settings.defaultSplit')}</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={splitPercent}
              onChange={(e) => setSplitPercent(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>{t('settings.active')}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>
            {tc('cancel')}
          </Button>
          <Button
            onClick={() => onSubmit({
              name,
              nameEn: nameEn || null,
              defaultSplitPercent: parseFloat(splitPercent || '50'),
              isActive,
            })}
            disabled={isPending || !name}
          >
            {isPending ? <LoadingSpinner /> : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeesSettings() {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<PartnerEmployee | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: empData, isLoading } = usePartnerEmployees();
  const createEmp = useCreatePartnerEmployee();
  const updateEmp = useUpdatePartnerEmployee();
  const deleteEmp = useDeletePartnerEmployee();

  const emps = (Array.isArray(empData) ? empData : []) as PartnerEmployee[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('settings.employees')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('settings.employeesDesc')}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="me-2 h-4 w-4" /> {t('settings.addEmployee')}
        </Button>
      </div>

      {isLoading ? <LoadingSpinner /> : emps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('settings.noEmployees')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.employeeName')}</TableHead>
                <TableHead className="text-end">{t('settings.sskAmount')}</TableHead>
                <TableHead>{t('settings.startDate')}</TableHead>
                <TableHead>{t('settings.endDate')}</TableHead>
                <TableHead>{t('settings.active')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {emps.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell className="text-end">
                    {formatCurrency(emp.sskMonthlyAmount, 'JOD')}
                  </TableCell>
                  <TableCell>{formatDate(emp.startDate)}</TableCell>
                  <TableCell>{emp.endDate ? formatDate(emp.endDate) : '-'}</TableCell>
                  <TableCell>
                    <Switch
                      checked={emp.isActive}
                      onCheckedChange={(checked) =>
                        updateEmp.mutate({ id: emp.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(emp)}>
                          <Pencil className="me-2 h-4 w-4" /> {tc('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(emp.id)}
                        >
                          <Trash2 className="me-2 h-4 w-4" /> {tc('delete')}
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

      <EmployeeDialog
        open={showAdd || !!editItem}
        onClose={() => { setShowAdd(false); setEditItem(null); }}
        employee={editItem}
        onSubmit={async (data) => {
          if (editItem) {
            await updateEmp.mutateAsync({ id: editItem.id, ...data });
          } else {
            await createEmp.mutateAsync(data);
          }
          setShowAdd(false);
          setEditItem(null);
        }}
        isPending={createEmp.isPending || updateEmp.isPending}
      />

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.deleteEmployee')}</DialogTitle>
            <DialogDescription>{t('settings.deleteEmployeeConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteId) await deleteEmp.mutateAsync(deleteId);
                setDeleteId(null);
              }}
            >
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeDialog({
  open,
  onClose,
  employee,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  employee: PartnerEmployee | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isPending: boolean;
}) {
  const { t } = useTranslation('partner-expenses');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState(employee?.name ?? '');
  const [amount, setAmount] = useState(employee ? String(employee.sskMonthlyAmount) : '');
  const [startDate, setStartDate] = useState(employee?.startDate ?? '');
  const [endDate, setEndDate] = useState(employee?.endDate ?? '');
  const [isActive, setIsActive] = useState(employee?.isActive ?? true);
  const [notes, setNotes] = useState(employee?.notes ?? '');

  useEffect(() => {
    if (open && employee) {
      setName(employee.name);
      setAmount(String(employee.sskMonthlyAmount));
      setStartDate(employee.startDate);
      setEndDate(employee.endDate ?? '');
      setIsActive(employee.isActive);
      setNotes(employee.notes ?? '');
    }
  }, [open, employee?.id]);

  const reset = () => {
    setName(''); setAmount(''); setStartDate('');
    setEndDate(''); setIsActive(true); setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {employee ? t('settings.editEmployee') : t('settings.addEmployee')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('settings.employeeName')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t('settings.sskAmount')}</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('settings.startDate')}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>{t('settings.endDate')}</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>{t('settings.active')}</Label>
          </div>
          <div>
            <Label>{t('expenses.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>
            {tc('cancel')}
          </Button>
          <Button
            onClick={() => onSubmit({
              name,
              sskMonthlyAmount: parseFloat(amount || '0'),
              startDate,
              endDate: endDate || null,
              isActive,
              notes: notes || null,
            })}
            disabled={isPending || !name || !amount || !startDate}
          >
            {isPending ? <LoadingSpinner /> : tc('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
