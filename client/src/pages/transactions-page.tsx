import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Plus,
  Search,
  ArrowLeftRight,
  MoreHorizontal,
  Trash2,
  Upload,
  Loader2,
  Check,
  FileSpreadsheet,
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
  useTransactions,
  useCreateTransaction,
  useDeleteTransaction,
  useImportTransactions,
  useBatchCreateTransactions,
} from '@/hooks/use-transactions';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  TRANSACTION_TYPES,
  TRANSACTION_CATEGORIES,
} from '@vibe/shared';

const CATEGORY_LABELS: Record<string, string> = {
  office_supplies: 'Office Supplies',
  rent: 'Rent',
  utilities: 'Utilities',
  software: 'Software',
  travel: 'Travel',
  meals: 'Meals',
  salary: 'Salary',
  marketing: 'Marketing',
  insurance: 'Insurance',
  professional_services: 'Professional Services',
  equipment: 'Equipment',
  shipping: 'Shipping',
  taxes: 'Taxes',
  invoice_payment: 'Invoice Payment',
  other: 'Other',
};

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  selected: boolean;
}

function TransactionForm({
  bankAccounts,
  onSubmit,
  onCancel,
  isLoading,
}: {
  bankAccounts: { id: number; name: string }[];
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id?.toString() ?? '',
  );
  const [type, setType] = useState<string>('expense');
  const [category, setCategory] = useState<string>('other');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      bankAccountId: parseInt(bankAccountId, 10),
      type,
      category,
      amount: parseFloat(amount),
      date,
      description,
      notes: notes || null,
      taxAmount: taxAmount ? parseFloat(taxAmount) : null,
      supplierName: supplierName || null,
      invoiceReference: invoiceReference || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Bank Account *
        </label>
        <select
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          required
        >
          <option value="">Select account</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {TRANSACTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Amount *</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Date *</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Description *
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this transaction for?"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Notes</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>
      {/* Tax fields for expense transactions (GST input tax tracking) */}
      {type === 'expense' && (
        <div className="space-y-4 rounded-lg border border-dashed p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Tax Details (for GST input tax tracking)
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                GST Paid (ضريبة المدخلات)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Supplier Name
              </label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Vendor / supplier"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Invoice Ref #
              </label>
              <Input
                value={invoiceReference}
                onChange={(e) => setInvoiceReference(e.target.value)}
                placeholder="Supplier invoice #"
              />
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !bankAccountId || !amount || !description.trim()}
        >
          {isLoading ? 'Saving...' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  bankAccounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccounts: { id: number; name: string }[];
}) {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [parsed, setParsed] = useState<ParsedTransaction[]>([]);
  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id?.toString() ?? '',
  );
  const importMutation = useImportTransactions();
  const batchCreate = useBatchCreateTransactions();

  const handleFile = useCallback(async (file: File) => {
    try {
      const result = await importMutation.mutateAsync(file);
      const items = (result as ParsedTransaction[]).map((t) => ({
        ...t,
        selected: true,
      }));
      setParsed(items);
      setStep('review');
    } catch {
      // handled
    }
  }, [importMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = async () => {
    const selected = parsed.filter((t) => t.selected);
    if (selected.length === 0) return;

    try {
      await batchCreate.mutateAsync({
        bankAccountId: parseInt(bankAccountId, 10),
        transactions: selected.map(({ selected: _, ...t }) => t),
      });
      onOpenChange(false);
      setStep('upload');
      setParsed([]);
    } catch {
      // handled
    }
  };

  const toggleRow = (idx: number) => {
    setParsed((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, selected: !t.selected } : t)),
    );
  };

  const updateCategory = (idx: number, category: string) => {
    setParsed((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, category } : t)),
    );
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep('upload');
      setParsed([]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            {step === 'upload'
              ? 'Upload a CSV, Excel, or PDF bank statement for AI-powered parsing.'
              : 'Review the parsed transactions before importing.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  AI is parsing your statement...
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="mb-2 text-sm font-medium">
                  Drag & drop your file here
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  CSV, Excel (.xlsx), or PDF
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.csv,.xlsx,.xls,.pdf';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFile(file);
                    };
                    input.click();
                  }}
                >
                  Choose File
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Import into account
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((txn, idx) => (
                    <TableRow
                      key={idx}
                      className={txn.selected ? '' : 'opacity-40'}
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleRow(idx)}
                          className="flex h-5 w-5 items-center justify-center rounded border"
                        >
                          {txn.selected && (
                            <Check className="h-3 w-3" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {txn.date}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {txn.description}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={txn.type === 'income' ? 'default' : 'secondary'}
                          className={
                            txn.type === 'income'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }
                        >
                          {txn.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {txn.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <select
                          value={txn.category}
                          onChange={(e) => updateCategory(idx, e.target.value)}
                          className="h-7 rounded border bg-background px-1 text-xs"
                        >
                          {TRANSACTION_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABELS[c] || c}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={
                  batchCreate.isPending
                  || !bankAccountId
                  || parsed.filter((t) => t.selected).length === 0
                }
              >
                {batchCreate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${parsed.filter((t) => t.selected).length} Transactions`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useTransactions({
    search,
    type: typeFilter,
    bankAccountId: accountFilter ? parseInt(accountFilter, 10) : undefined,
  });
  const { data: bankAccountsData } = useBankAccounts(true);
  const createTransaction = useCreateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const txns = (Array.isArray(data) ? data : data?.data ?? []) as any[];
  const bankAccounts = (bankAccountsData ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const handleCreate = async (formData: Record<string, unknown>) => {
    try {
      await createTransaction.mutateAsync(formData);
      setShowCreate(false);
    } catch {
      // handled
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteTransaction.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled
    }
  };

  const typeTabs = [
    { key: 'all', label: 'All' },
    { key: 'income', label: 'Income' },
    { key: 'expense', label: 'Expenses' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">Transactions</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Track income and expenses
            {' · '}
            <Link
              to={`/tax-reports?tab=sales-tax&year=${new Date().getFullYear()}&period=${Math.floor(new Date().getMonth() / 2)}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <FileSpreadsheet className="inline h-3 w-3" />
              View tax report
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="sm:size-default" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" className="sm:size-default" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border p-0.5">
          {typeTabs.map((tab) => (
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

        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">All Accounts</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60 pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : txns.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions found"
          description={
            search || typeFilter !== 'all' || accountFilter
              ? 'Try adjusting your filters.'
              : 'Add your first transaction to get started.'
          }
          actionLabel={
            !search && typeFilter === 'all' && !accountFilter
              ? 'Add Transaction'
              : undefined
          }
          onAction={
            !search && typeFilter === 'all' && !accountFilter
              ? () => setShowCreate(true)
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(txn.date)}
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate">
                    {txn.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {txn.bankAccount?.name ?? '--'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[txn.category] || txn.category}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      txn.type === 'income'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {txn.type === 'income' ? '+' : '-'}
                    {formatCurrency(parseFloat(String(txn.amount)))}
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
                          variant="destructive"
                          onClick={() => setDeleteId(txn.id)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
            <DialogDescription>
              Record a new income or expense.
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            bankAccounts={bankAccounts}
            onSubmit={handleCreate}
            isLoading={createTransaction.isPending}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        bankAccounts={bankAccounts}
      />

      {/* Delete confirmation */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure? The bank account balance will be recalculated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTransaction.isPending}
            >
              {deleteTransaction.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
