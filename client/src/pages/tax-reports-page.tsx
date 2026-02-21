import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams, useNavigate } from 'react-router';
import {
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Receipt,
  Calculator,
  BarChart3,
  Info,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Equal,
  Plus,
  FileText,
  ArrowLeftRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useSalesTaxReport,
  usePurchasesReport,
  useGstSummary,
  useIncomeTaxReport,
  useProfitLossReport,
  useExportReport,
  useTaxDeadlines,
} from '@/hooks/use-reports';
import { formatCurrency, formatDate } from '@/lib/format';
import { BIMONTHLY_PERIODS } from '@vibe/shared';
import { toast } from 'sonner';

// Simple prev/next period picker with clear labels
function PeriodPicker({
  year,
  period,
  onChange,
}: {
  year: number;
  period: number;
  onChange: (y: number, p: number) => void;
}) {
  const label = `${BIMONTHLY_PERIODS[period].label} ${year}`;

  const goPrev = () => {
    if (period === 0) onChange(year - 1, 5);
    else onChange(year, period - 1);
  };
  const goNext = () => {
    if (period === 5) onChange(year + 1, 0);
    else onChange(year, period + 1);
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-xs" onClick={goPrev} aria-label="Previous period">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[120px] text-center text-sm font-semibold">
        {label}
      </span>
      <Button variant="ghost" size="icon-xs" onClick={goNext} aria-label="Next period">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Collapsible details section
function Details({
  label,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-start text-sm font-medium hover:bg-accent/50"
      >
        <span>
          {label}
          {count != null && (
            <Badge variant="secondary" className="ms-2 text-xs">
              {count}
            </Badge>
          )}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

// Helper: small hint box
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// ---- Tab 1: Bimonthly Sales Tax (the main one) ----

function SalesTaxTab({ initialYear, initialPeriod }: {
  initialYear?: number;
  initialPeriod?: number;
}) {
  const { t } = useTranslation('tax-reports');
  const { t: tc } = useTranslation('common');
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [period, setPeriod] = useState(
    initialPeriod ?? Math.floor(now.getMonth() / 2),
  );

  const { data: sales, isLoading: salesLoading } = useSalesTaxReport({ year, period });
  const { data: purchases, isLoading: purchasesLoading } = usePurchasesReport({ year, period });
  const { data: gst, isLoading: gstLoading } = useGstSummary({ year, period });
  const exportReport = useExportReport();

  const isLoading = salesLoading || purchasesLoading || gstLoading;

  const handleExport = useCallback(async (type: string) => {
    try {
      await exportReport(type, { year, period });
      toast.success('Report downloaded');
    } catch {
      toast.error('Export failed');
    }
  }, [exportReport, year, period]);

  const handleChange = (y: number, p: number) => {
    setYear(y);
    setPeriod(p);
  };

  if (isLoading) return <LoadingSpinner />;

  const netTax = gst?.netTax ?? 0;
  const daysLeft = gst?.period?.deadline
    ? Math.ceil((new Date(gst.period.deadline).getTime() - now.getTime()) / 86400000)
    : null;
  const hasInvoices = sales && sales.invoices.length > 0;
  const hasExpenses = purchases && purchases.transactions.length > 0;

  return (
    <div className="space-y-5">
      {/* Period picker + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker year={year} period={period} onChange={handleChange} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('gst-summary')}
          >
            <Download className="h-3.5 w-3.5" />
            {t('summary')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('sales-tax')}
          >
            <Download className="h-3.5 w-3.5" />
            {t('fullReport')}
          </Button>
        </div>
      </div>

      {/* The big answer: what do I owe? */}
      <Card
        className={`border-2 py-6 ${
          netTax > 0
            ? 'border-red-200 bg-red-50/50'
            : netTax < 0
              ? 'border-green-200 bg-green-50/50'
              : 'border-muted'
        }`}
      >
        <CardContent className="px-6 pt-0 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {netTax > 0
              ? t('youOwe')
              : netTax < 0
                ? t('taxAuthorityOwes')
                : t('nothingToPay')}
          </p>
          <p
            className={`mt-2 text-4xl font-bold tracking-tight ${
              netTax > 0
                ? 'text-red-600'
                : netTax < 0
                  ? 'text-green-600'
                  : ''
            }`}
          >
            {formatCurrency(Math.abs(netTax), 'JOD')}
          </p>
          {daysLeft != null && daysLeft >= 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              <Calendar className="me-1 inline h-3.5 w-3.5" />
              {t('dueBy', { date: formatDate(gst!.period.deadline) })}
              {daysLeft <= 30 && (
                <Badge
                  variant="secondary"
                  className={`ms-2 ${
                    daysLeft <= 14
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {t('daysLeft', { count: daysLeft })}
                </Badge>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* How we got there - visual math */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('howCalculated')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Hint>
            {t('calculationHint')}
          </Hint>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Tax collected */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                {t('taxCollectedFromClients')}
              </div>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {formatCurrency(gst?.outputTax ?? 0, 'JOD')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('onTaxableSales', {
                  amount: formatCurrency(gst?.taxableSales ?? 0, 'JOD'),
                })}
              </p>
            </div>

            {/* Tax paid */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                {t('taxPaidOnPurchases')}
              </div>
              <p className="mt-2 text-2xl font-bold text-green-600">
                {formatCurrency(gst?.inputTax ?? 0, 'JOD')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('fromExpenses', {
                  amount: formatCurrency(gst?.totalPurchases ?? 0, 'JOD'),
                })}
              </p>
            </div>

            {/* Net */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Equal className="h-3.5 w-3.5" />
                {t('netAmount')}
              </div>
              <p
                className={`mt-2 text-2xl font-bold ${
                  netTax >= 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {formatCurrency(netTax, 'JOD')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {netTax > 0
                  ? t('youOweThisAmount')
                  : netTax < 0
                    ? t('creditToClaim')
                    : t('zeroBalance')}
              </p>
            </div>
          </div>

          {(gst?.exemptSales ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('exemptSalesNote', {
                amount: formatCurrency(gst!.exemptSales, 'JOD'),
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Collapsible invoice list - with links */}
      {hasInvoices ? (
        <Details label={t('yourInvoicesThisPeriod')} count={sales.invoices.length}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoice')}</TableHead>
                <TableHead>{t('client')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead className="text-end">{t('amount')}</TableHead>
                <TableHead className="text-end">{t('tax')}</TableHead>
                <TableHead>{t('type')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="inline-flex items-center gap-1 font-mono text-sm text-primary hover:underline"
                    >
                      {inv.invoiceNumber}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                  <TableCell>{inv.clientName ?? '--'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(inv.issueDate)}
                  </TableCell>
                  <TableCell className="text-end font-mono">
                    {formatCurrency(inv.subtotal, 'JOD')}
                  </TableCell>
                  <TableCell className="text-end font-mono">
                    {formatCurrency(inv.taxAmount, 'JOD')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        inv.isTaxable
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }
                    >
                      {inv.isTaxable ? tc('taxable') : tc('exempt')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Details>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">{t('noInvoicesThisPeriod')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('noInvoicesThisPeriodDesc', {
                  period: BIMONTHLY_PERIODS[period].label,
                  year,
                })}
              </p>
            </div>
            <Link to="/invoices/new">
              <Button variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5" />
                {t('createInvoice')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Collapsible purchases list - with links */}
      {hasExpenses ? (
        <Details label={t('yourExpensesThisPeriod')} count={purchases.transactions.length}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('what')}</TableHead>
                <TableHead>{t('supplier')}</TableHead>
                <TableHead>{t('category')}</TableHead>
                <TableHead className="text-end">{t('amount')}</TableHead>
                <TableHead className="text-end">{t('taxPaid')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(txn.date)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {txn.description}
                  </TableCell>
                  <TableCell>{txn.supplierName ?? '--'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[txn.category] || txn.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end font-mono">
                    {formatCurrency(txn.amount, 'JOD')}
                  </TableCell>
                  <TableCell className="text-end font-mono">
                    {txn.taxAmount
                      ? formatCurrency(txn.taxAmount, 'JOD')
                      : <span className="text-muted-foreground">--</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2">
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftRight className="h-3 w-3" />
              {t('viewAllTransactions')}
            </Link>
          </div>
        </Details>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <ArrowLeftRight className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">{t('noExpensesThisPeriod')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('noExpensesDesc')}
              </p>
            </div>
            <Link to="/transactions">
              <Button variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5" />
                {t('addExpense')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Tab 2: Annual Income Tax ----

function IncomeTaxTab({ initialYear }: { initialYear?: number }) {
  const { t } = useTranslation('tax-reports');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear ?? currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const { data, isLoading } = useIncomeTaxReport(year);
  const exportReport = useExportReport();

  const handleExport = useCallback(async () => {
    try {
      await exportReport('income-tax', { year });
      toast.success('Report downloaded');
    } catch {
      toast.error('Export failed');
    }
  }, [exportReport, year]);

  if (isLoading) return <LoadingSpinner />;
  if (!data) {
    return (
      <EmptyState
        icon={Calculator}
        title={t('noDataYet')}
        description={t('noDataYetIncomeTax')}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('year')}</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-semibold"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {t('exportExcel')}
        </Button>
      </div>

      {/* Big answer */}
      <Card className="border-2 border-muted py-6">
        <CardContent className="px-6 pt-0 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {t('estimatedIncomeTax', { year })}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-red-600">
            {formatCurrency(data.totalLiability, 'JOD')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <Calendar className="me-1 inline h-3.5 w-3.5" />
            {t('dueByDate', { year: year + 1 })}
          </p>
        </CardContent>
      </Card>

      <Hint>
        {t('incomeEstimateHint')}
      </Hint>

      {/* The simple story: earned -> spent -> profit -> exemptions -> tax */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('theBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Row label={t('moneyEarned')} value={data.totalRevenue} color="green" />
            <Row label={t('moneySpent')} value={-data.totalExpenses} color="red" sign="-" />
            <Divider />
            <Row label={t('yourProfit')} value={data.grossProfit} bold />
            <Row label={t('personalExemptionLabel')} value={-data.personalExemption} color="green" sign="-" />
            {data.familyExemption > 0 && (
              <Row label={t('familyExemptionLabel')} value={-data.familyExemption} color="green" sign="-" />
            )}
            {data.additionalExemptions > 0 && (
              <Row label={t('additionalExemptionsLabel')} value={-data.additionalExemptions} color="green" sign="-" />
            )}
            <Divider />
            <Row label={t('incomeThatGetsTaxed')} value={data.taxableIncome} bold />
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-3 w-3" />
              {t('viewInvoices')}
            </Link>
            <span className="text-xs text-muted-foreground">|</span>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftRight className="h-3 w-3" />
              {t('viewExpenses')}
            </Link>
            <span className="text-xs text-muted-foreground">|</span>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t('changeExemptions')}
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tax brackets - simplified */}
      {data.taxBrackets.length > 0 && (
        <Details label={t('howTaxCalculated')} count={data.taxBrackets.length}>
          <div className="p-4">
            <Hint>
              {t('progressiveBracketsHint')}
            </Hint>
            <div className="mt-3 space-y-2">
              {data.taxBrackets.map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{b.range}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('taxedAtRate', {
                        amount: formatCurrency(b.income, 'JOD'),
                        rate: b.rate,
                      })}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold">
                    {formatCurrency(b.tax, 'JOD')}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <p className="text-sm font-bold">{t('totalTax')}</p>
                <p className="font-mono text-sm font-bold text-red-600">
                  {formatCurrency(data.totalLiability, 'JOD')}
                </p>
              </div>
            </div>
          </div>
        </Details>
      )}

      {/* Expense categories */}
      {data.expensesByCategory.length > 0 && (
        <Details label={t('whereMoneyWent')} count={data.expensesByCategory.length}>
          <div className="p-4 space-y-2">
            {data.expensesByCategory.map((cat) => {
              const pct = data.totalExpenses > 0
                ? (cat.amount / data.totalExpenses * 100)
                : 0;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{CATEGORY_LABELS[cat.category] || cat.category}</span>
                      <span className="font-mono">{formatCurrency(cat.amount, 'JOD')}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-end text-xs text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Details>
      )}
    </div>
  );
}

// ---- Tab 3: Profit & Loss ----

function ProfitLossTab() {
  const { t } = useTranslation('tax-reports');
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [activePreset, setActivePreset] = useState(t('thisYear'));

  const DATE_PRESETS = [
    { label: t('thisYear'), getRange: () => {
      const y = new Date().getFullYear();
      return { start: `${y}-01-01`, end: new Date().toISOString().split('T')[0] };
    }},
    { label: t('lastYear'), getRange: () => {
      const y = new Date().getFullYear() - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }},
    { label: t('thisQuarter'), getRange: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return {
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      };
    }},
    { label: t('lastQuarter'), getRange: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3) - 1;
      const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const qIdx = q < 0 ? 3 : q;
      const start = new Date(year, qIdx * 3, 1);
      const end = new Date(year, qIdx * 3 + 3, 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    }},
  ];

  const { data, isLoading } = useProfitLossReport({ startDate, endDate });
  const exportReport = useExportReport();

  const handleExport = useCallback(async () => {
    try {
      await exportReport('profit-loss', { startDate, endDate });
      toast.success('Report downloaded');
    } catch {
      toast.error('Export failed');
    }
  }, [exportReport, startDate, endDate]);

  const applyPreset = (preset: typeof DATE_PRESETS[number]) => {
    const range = preset.getRange();
    setStartDate(range.start);
    setEndDate(range.end);
    setActivePreset(preset.label);
  };

  if (isLoading) return <LoadingSpinner />;
  if (!data) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('noDataYet')}
        description={t('noDataYetProfitLoss')}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Date range with presets */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant={activePreset === preset.label ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {t('export')}
        </Button>
      </div>

      {/* Custom date range (collapsed by default) */}
      <Details label={t('customDateRange')}>
        <div className="flex items-center gap-2 px-4 py-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setActivePreset(''); }}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setActivePreset(''); }}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
        </div>
      </Details>

      {/* Big 3 numbers */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-5">
          <CardContent className="px-4 pt-0 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-green-500" />
            <p className="mt-2 text-xs text-muted-foreground">{t('moneyIn')}</p>
            <p className="mt-1 text-xl font-bold text-green-600">
              {formatCurrency(data.revenue.total, 'JOD')}
            </p>
            <Link
              to="/invoices"
              className="mt-1 inline-block text-[10px] text-muted-foreground hover:text-foreground"
            >
              {t('viewInvoicesLink')} →
            </Link>
          </CardContent>
        </Card>
        <Card className="py-5">
          <CardContent className="px-4 pt-0 text-center">
            <TrendingDown className="mx-auto h-5 w-5 text-red-500" />
            <p className="mt-2 text-xs text-muted-foreground">{t('moneyOut')}</p>
            <p className="mt-1 text-xl font-bold text-red-600">
              {formatCurrency(data.expenses.total, 'JOD')}
            </p>
            <Link
              to="/transactions"
              className="mt-1 inline-block text-[10px] text-muted-foreground hover:text-foreground"
            >
              {t('viewTransactionsLink')} →
            </Link>
          </CardContent>
        </Card>
        <Card
          className={`py-5 ${
            data.netProfit >= 0
              ? 'border-green-200 bg-green-50/50'
              : 'border-red-200 bg-red-50/50'
          }`}
        >
          <CardContent className="px-4 pt-0 text-center">
            <Equal className="mx-auto h-5 w-5" />
            <p className="mt-2 text-xs text-muted-foreground">
              {data.netProfit >= 0 ? t('profit') : t('loss')}
            </p>
            <p
              className={`mt-1 text-xl font-bold ${
                data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(data.netProfit, 'JOD')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
      {(data.revenue.byMonth.length > 0
        || data.expenses.byMonth.length > 0) && (
        <Details label={t('monthByMonth')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('month')}</TableHead>
                <TableHead className="text-end">{t('in')}</TableHead>
                <TableHead className="text-end">{t('out')}</TableHead>
                <TableHead className="text-end">{t('net')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const months = new Set([
                  ...data.revenue.byMonth.map((m) => m.month),
                  ...data.expenses.byMonth.map((m) => m.month),
                ]);
                return [...months].sort().map((month) => {
                  const rev =
                    data.revenue.byMonth.find((m) => m.month === month)
                      ?.amount ?? 0;
                  const exp =
                    data.expenses.byMonth.find((m) => m.month === month)
                      ?.amount ?? 0;
                  const net = rev - exp;
                  return (
                    <TableRow key={month}>
                      <TableCell>{month}</TableCell>
                      <TableCell className="text-end font-mono text-green-600">
                        {formatCurrency(rev, 'JOD')}
                      </TableCell>
                      <TableCell className="text-end font-mono text-red-600">
                        {formatCurrency(exp, 'JOD')}
                      </TableCell>
                      <TableCell
                        className={`text-end font-mono font-semibold ${
                          net >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(net, 'JOD')}
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </Details>
      )}

      {/* Expense categories with bars */}
      {data.expenses.byCategory.length > 0 && (
        <Details label={t('whereMoneyWent')} count={data.expenses.byCategory.length}>
          <div className="p-4 space-y-2">
            {data.expenses.byCategory.map((cat) => {
              const pct = data.expenses.total > 0
                ? (cat.amount / data.expenses.total * 100)
                : 0;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{CATEGORY_LABELS[cat.category] || cat.category}</span>
                      <span className="font-mono">{formatCurrency(cat.amount, 'JOD')}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-red-400/60"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-end text-xs text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Details>
      )}
    </div>
  );
}

// ---- Shared row helpers ----

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

function Row({
  label,
  value,
  color,
  bold,
  sign,
}: {
  label: string;
  value: number;
  color?: 'green' | 'red';
  bold?: boolean;
  sign?: string;
}) {
  const colorClass = color === 'green'
    ? 'text-green-600'
    : color === 'red'
      ? 'text-red-600'
      : '';

  return (
    <div className={`flex items-center justify-between py-1.5 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-sm">{label}</span>
      <span className={`font-mono text-sm ${colorClass}`}>
        {sign && <span className="me-0.5">{sign}</span>}
        {formatCurrency(Math.abs(value), 'JOD')}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-dashed" />;
}

// ---- Main page ----

export function TaxReportsPage() {
  const { t } = useTranslation('tax-reports');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: deadlines } = useTaxDeadlines();
  const nextDeadline = deadlines?.[0];

  // Read initial state from URL params for deep-linking
  const urlTab = searchParams.get('tab') || 'sales-tax';
  const urlYear = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
  const urlPeriod = searchParams.get('period') ? Number(searchParams.get('period')) : undefined;

  const [activeTab, setActiveTab] = useState(urlTab);

  // Sync tab changes to URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        {nextDeadline && (
          <button
            type="button"
            onClick={() => {
              if (nextDeadline.type === 'gst') {
                handleTabChange('sales-tax');
              } else {
                handleTabChange('income-tax');
              }
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:opacity-80 ${
              nextDeadline.daysUntil <= 14
                ? 'bg-red-100 text-red-700'
                : nextDeadline.daysUntil <= 30
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>
              {t('nextDeadline', {
                date: formatDate(nextDeadline.deadline),
                days: nextDeadline.daysUntil,
                interpolation: { escapeValue: false },
              }).replace(
                /<strong>(.*?)<\/strong>/,
                (_, text) => text,
              )}
            </span>
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
        <TabsList>
          <TabsTrigger value="sales-tax">
            <Receipt className="me-1.5 h-3.5 w-3.5" />
            {t('salesTax')}
          </TabsTrigger>
          <TabsTrigger value="income-tax">
            <Calculator className="me-1.5 h-3.5 w-3.5" />
            {t('incomeTax')}
          </TabsTrigger>
          <TabsTrigger value="profit-loss">
            <BarChart3 className="me-1.5 h-3.5 w-3.5" />
            {t('profitLoss')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales-tax">
          <SalesTaxTab initialYear={urlYear} initialPeriod={urlPeriod} />
        </TabsContent>
        <TabsContent value="income-tax">
          <IncomeTaxTab initialYear={urlYear} />
        </TabsContent>
        <TabsContent value="profit-loss">
          <ProfitLossTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
