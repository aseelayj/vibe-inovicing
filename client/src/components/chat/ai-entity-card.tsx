import { memo } from 'react';
import { useNavigate } from 'react-router';
import { ExternalLink, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';

interface AiEntityCardProps {
  data: unknown;
  toolName: string;
}

function formatCurrency(amount: number | string, currency = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
}

// Detect entity type primarily from toolName
function detectEntityType(toolName: string, item: any): string {
  if (toolName.includes('activity_log')) return 'activity_log';
  if (toolName.includes('email_log')) return 'email_log';
  if (toolName.includes('dashboard') || toolName.includes('stats')) return 'stats';
  if (toolName.includes('revenue_chart')) return 'chart';
  if (toolName.includes('tax_deadlines')) return 'tax_deadlines';
  if (toolName.includes('sales_tax_report')) return 'sales_tax_report';
  if (toolName.includes('purchases_report')) return 'purchases_report';
  if (toolName.includes('gst_summary')) return 'gst_summary';
  if (toolName.includes('income_tax_report')) return 'income_tax_report';
  if (toolName.includes('profit_loss')) return 'profit_loss_report';
  if (toolName.includes('jofotara_submissions')) return 'jofotara_submission';
  if (toolName.includes('validate_for_jofotara')) return 'jofotara_validation';
  if (toolName.includes('submit_to_jofotara') || toolName.includes('submit_credit_note')) return 'jofotara_submission';
  if (toolName.includes('invoice') && !toolName.includes('recurring')) return 'invoice';
  if (toolName.includes('quote')) return 'quote';
  if (toolName.includes('client')) return 'client';
  if (toolName.includes('payment')) return 'payment';
  if (toolName.includes('bank_account')) return 'bank_account';
  if (toolName.includes('transaction')) return 'transaction';
  if (toolName.includes('recurring')) return 'recurring';
  if (toolName.includes('settings')) return 'settings';
  // Fallback: shape-based detection
  if (item.invoiceNumber) return 'invoice';
  if (item.quoteNumber) return 'quote';
  if (item.totalRevenue !== undefined) return 'stats';
  if (item.frequency) return 'recurring';
  if (item.bankName !== undefined || item.currentBalance !== undefined) return 'bank_account';
  if (item.paymentDate && item.invoiceId) return 'payment';
  if (item.bankAccountId && item.category) return 'transaction';
  if (item.name && !item.invoiceNumber) return 'client';
  return 'unknown';
}

export const AiEntityCard = memo(function AiEntityCard({ data, toolName }: AiEntityCardProps) {
  const navigate = useNavigate();

  if (!data) return null;

  // Special case: revenue chart data (array of {month, revenue, invoiceCount})
  if (Array.isArray(data) && toolName.includes('revenue_chart')) {
    const maxRevenue = Math.max(...data.map((d: any) => d.revenue || 0), 1);
    return (
      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Revenue (Last 12 Months)</p>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {data.map((d: any, i: number) => {
            const height = Math.max(2, (d.revenue / maxRevenue) * 100);
            return (
              <div key={i} className="group relative flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                  style={{ height: `${height}%` }}
                />
                <div className="absolute -top-6 hidden group-hover:block rounded bg-foreground
                  px-1.5 py-0.5 text-[9px] text-background whitespace-nowrap z-10">
                  {formatCurrency(d.revenue)} ({d.invoiceCount} inv)
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-[9px] text-muted-foreground">{data[0]?.month}</span>
          <span className="text-[9px] text-muted-foreground">{data[data.length - 1]?.month}</span>
        </div>
      </div>
    );
  }

  // Tax deadlines (array of deadline objects)
  if (Array.isArray(data) && toolName.includes('tax_deadlines')) {
    return (
      <div className="space-y-1.5">
        {data.map((d: any, i: number) => (
          <div key={i} className="rounded-lg border bg-muted/50 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Clock className={cn('h-3.5 w-3.5 shrink-0',
                    d.daysUntil <= 14 ? 'text-red-500' : d.daysUntil <= 30 ? 'text-amber-500' : 'text-muted-foreground',
                  )} />
                  <span className="text-xs font-medium">{d.label}</span>
                </div>
                <p className="mt-0.5 ml-5 text-[10px] text-muted-foreground">
                  {d.period} &middot; Due: {d.deadline}
                </p>
              </div>
              <span className={cn(
                'text-xs font-semibold shrink-0',
                d.daysUntil <= 14 ? 'text-red-600' : d.daysUntil <= 30 ? 'text-amber-600' : 'text-muted-foreground',
              )}>
                {d.daysUntil <= 0 ? 'Overdue!' : `${d.daysUntil}d`}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // JoFotara submissions list
  if (Array.isArray(data) && toolName.includes('jofotara')) {
    if (data.length === 0) {
      return (
        <div className="rounded-lg border bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
          No JoFotara submissions found
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        {data.map((s: any, i: number) => (
          <JofotaraSubmissionCard key={s.id ?? i} item={s} />
        ))}
      </div>
    );
  }

  // GST Summary report
  if (!Array.isArray(data) && toolName.includes('gst_summary')) {
    const d = data as any;
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">GST Summary</p>
          <span className="text-[10px] text-muted-foreground">{d.period?.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Taxable Sales" value={formatCurrency(d.taxableSales, 'JOD')} />
          <Stat label="Exempt Sales" value={formatCurrency(d.exemptSales, 'JOD')} />
          <Stat label="Output Tax (16%)" value={formatCurrency(d.outputTax, 'JOD')} />
          <Stat label="Input Tax" value={formatCurrency(d.inputTax, 'JOD')} />
        </div>
        <div className="border-t pt-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium">Net Tax Payable</span>
            <span className={cn('font-semibold', d.netTax > 0 ? 'text-red-600' : 'text-green-600')}>
              {formatCurrency(d.netTax, 'JOD')}
            </span>
          </div>
        </div>
        {d.period?.deadline && (
          <p className="text-[10px] text-muted-foreground">Filing deadline: {d.period.deadline}</p>
        )}
      </div>
    );
  }

  // Sales Tax Report
  if (!Array.isArray(data) && toolName.includes('sales_tax_report')) {
    const d = data as any;
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Sales Tax Report</p>
          <span className="text-[10px] text-muted-foreground">{d.period?.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Taxable Sales" value={formatCurrency(d.taxableSales, 'JOD')} />
          <Stat label="Exempt Sales" value={formatCurrency(d.exemptSales, 'JOD')} />
          <Stat label="Total Sales" value={formatCurrency(d.totalSales, 'JOD')} />
          <Stat label="Output Tax" value={formatCurrency(d.outputTax, 'JOD')} />
        </div>
        <p className="text-[10px] text-muted-foreground">{d.invoiceCount} invoice(s) in period</p>
      </div>
    );
  }

  // Purchases Report
  if (!Array.isArray(data) && toolName.includes('purchases_report')) {
    const d = data as any;
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Purchases Report</p>
          <span className="text-[10px] text-muted-foreground">{d.period?.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total Purchases" value={formatCurrency(d.totalPurchases, 'JOD')} />
          <Stat label="Input Tax" value={formatCurrency(d.inputTax, 'JOD')} />
        </div>
        <p className="text-[10px] text-muted-foreground">{d.transactionCount} expense(s) in period</p>
      </div>
    );
  }

  // Income Tax Report
  if (!Array.isArray(data) && toolName.includes('income_tax_report')) {
    const d = data as any;
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Income Tax Report</p>
          <span className="text-[10px] text-muted-foreground">{d.year}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Revenue" value={formatCurrency(d.totalRevenue, 'JOD')} />
          <Stat label="Expenses" value={formatCurrency(d.totalExpenses, 'JOD')} />
          <Stat label="Gross Profit" value={formatCurrency(d.grossProfit, 'JOD')} />
          <Stat label="Exemptions" value={formatCurrency(d.totalExemptions, 'JOD')} />
          <Stat label="Taxable Income" value={formatCurrency(d.taxableIncome, 'JOD')} />
          <Stat label="Income Tax" value={formatCurrency(d.totalTax, 'JOD')} className="text-red-600" />
        </div>
        {d.nationalContribution > 0 && (
          <Stat label="National Contribution" value={formatCurrency(d.nationalContribution, 'JOD')} />
        )}
        <div className="border-t pt-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium">Total Tax Liability</span>
            <span className="font-semibold text-red-600">{formatCurrency(d.totalLiability, 'JOD')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Profit & Loss Report
  if (!Array.isArray(data) && toolName.includes('profit_loss')) {
    const d = data as any;
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Profit & Loss</p>
          <span className="text-[10px] text-muted-foreground">
            {d.period?.startDate} to {d.period?.endDate}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Revenue" value={formatCurrency(d.revenue?.total ?? 0, 'JOD')} />
          <Stat label="Expenses" value={formatCurrency(d.expenses?.total ?? 0, 'JOD')} />
          <Stat
            label="Net Profit"
            value={formatCurrency(d.netProfit ?? 0, 'JOD')}
            className={d.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}
          />
        </div>
        {d.expenses?.byCategory?.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Top expenses:</p>
            {d.expenses.byCategory.slice(0, 4).map((c: any, i: number) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{c.category}</span>
                <span>{formatCurrency(c.amount, 'JOD')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // JoFotara validation result (single object)
  if (!Array.isArray(data) && toolName.includes('validate_for_jofotara')) {
    const d = data as any;
    return (
      <div className={cn(
        'rounded-lg border p-3 space-y-1',
        d.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
      )}>
        <div className="flex items-center gap-1.5">
          {d.valid
            ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            : <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
          <span className="text-xs font-medium">
            {d.valid ? 'Ready for JoFotara' : 'Validation Failed'}
          </span>
        </div>
        {d.errors?.length > 0 && (
          <ul className="ml-5 space-y-0.5">
            {d.errors.map((err: string, i: number) => (
              <li key={i} className="text-[10px] text-red-700">&bull; {err}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Single JoFotara submission result
  if (!Array.isArray(data) && (toolName.includes('submit_to_jofotara') || toolName.includes('submit_credit_note'))) {
    return <JofotaraSubmissionCard item={data as any} />;
  }

  // List of entities
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div className="rounded-lg border bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
          No results found
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {data.slice(0, 10).map((item: any, i) => (
          <SingleEntityCard
            key={item.id ?? i}
            item={item}
            toolName={toolName}
            navigate={navigate}
            compact
          />
        ))}
        {data.length > 10 && (
          <p className="text-xs text-muted-foreground">
            ...and {data.length - 10} more
          </p>
        )}
      </div>
    );
  }

  // Simple message result (e.g., from delete)
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return (
      <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-foreground">
        {(data as any).message}
      </div>
    );
  }

  return (
    <SingleEntityCard
      item={data as any}
      toolName={toolName}
      navigate={navigate}
    />
  );
});

function SingleEntityCard({
  item,
  toolName,
  navigate,
  compact,
}: {
  item: any;
  toolName: string;
  navigate: (path: string) => void;
  compact?: boolean;
}) {
  const type = detectEntityType(toolName, item);

  const getLink = (): string | null => {
    switch (type) {
      case 'invoice': return item.id ? `/invoices/${item.id}` : null;
      case 'quote': return item.id ? `/quotes/${item.id}` : null;
      case 'client': return item.id ? `/clients/${item.id}` : null;
      case 'bank_account': return item.id ? `/bank-accounts` : null;
      case 'recurring': return '/recurring';
      case 'payment': return '/payments';
      case 'transaction': return '/transactions';
      default: return null;
    }
  };

  const link = getLink();

  if (type === 'stats') {
    return (
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-3">
        {item.totalRevenue !== undefined && (
          <Stat label="Revenue" value={formatCurrency(item.totalRevenue)} />
        )}
        {item.outstandingAmount !== undefined && (
          <Stat label="Outstanding" value={formatCurrency(item.outstandingAmount)} />
        )}
        {item.overdueAmount !== undefined && (
          <Stat label="Overdue" value={formatCurrency(item.overdueAmount)} className="text-red-600" />
        )}
        {item.totalBankBalance !== undefined && (
          <Stat label="Bank Balance" value={formatCurrency(item.totalBankBalance)} />
        )}
        {item.totalInvoices !== undefined && (
          <Stat label="Invoices" value={String(item.totalInvoices)} />
        )}
        {item.totalClients !== undefined && (
          <Stat label="Clients" value={String(item.totalClients)} />
        )}
        {item.paidThisMonth !== undefined && (
          <Stat label="Paid This Month" value={formatCurrency(item.paidThisMonth)} />
        )}
        {item.monthlyExpenses !== undefined && (
          <Stat label="Expenses (Month)" value={formatCurrency(item.monthlyExpenses)} />
        )}
      </div>
    );
  }

  if (type === 'settings') {
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
        {item.businessName && <SettingRow label="Business" value={item.businessName} />}
        {item.businessEmail && <SettingRow label="Email" value={item.businessEmail} />}
        {item.defaultCurrency && <SettingRow label="Currency" value={item.defaultCurrency} />}
        {item.defaultTaxRate != null && <SettingRow label="Tax Rate" value={`${item.defaultTaxRate}%`} />}
        {item.defaultPaymentTerms != null && <SettingRow label="Payment Terms" value={`${item.defaultPaymentTerms} days`} />}
        {item.jofotaraEnabled != null && (
          <SettingRow label="JoFotara" value={item.jofotaraEnabled ? 'Enabled' : 'Disabled'} />
        )}
        {item.jofotaraCompanyTin && <SettingRow label="Company TIN" value={item.jofotaraCompanyTin} />}
        {item.filingStatus && <SettingRow label="Filing Status" value={item.filingStatus} />}
      </div>
    );
  }

  // Activity log entry
  if (type === 'activity_log') {
    return (
      <div className="rounded-lg border bg-muted/50 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs">{item.description}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {item.entityType} &middot; {item.action}
              {item.createdAt && ` &middot; ${new Date(item.createdAt).toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Email log entry
  if (type === 'email_log') {
    return (
      <div className="rounded-lg border bg-muted/50 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{item.subject}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              To: {item.recipientEmail}
              {item.sentAt && ` &middot; ${new Date(item.sentAt).toLocaleString()}`}
            </p>
          </div>
          {item.status && (
            <span className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              item.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700',
            )}>
              {item.status}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Get display amount — use explicit null check for zero values
  const amount = item.total ?? item.amount ?? item.currentBalance;
  const hasAmount = amount != null && amount !== '' && !isNaN(parseFloat(String(amount)));

  const titleMap: Record<string, string> = {
    invoice: item.invoiceNumber || `Invoice #${item.id}`,
    quote: item.quoteNumber || `Quote #${item.id}`,
    client: item.name || `Client #${item.id}`,
    payment: `Payment #${item.id}`,
    bank_account: item.name || `Account #${item.id}`,
    transaction: item.description || `Transaction #${item.id}`,
    recurring: `Recurring ${item.frequency || ''} #${item.id}`,
    unknown: `#${item.id}`,
  };

  const subtitleMap: Record<string, string | null> = {
    invoice: item.client?.name || null,
    quote: item.client?.name || null,
    client: [item.email, item.company ? `(${item.company})` : null].filter(Boolean).join(' ') || null,
    payment: item.invoice?.invoiceNumber
      ? `Invoice ${item.invoice.invoiceNumber}`
      : `Invoice #${item.invoiceId}`,
    bank_account: item.bankName || null,
    transaction: item.bankAccount?.name || item.category || null,
    recurring: [item.frequency, item.client?.name || `Client #${item.clientId}`]
      .filter(Boolean).join(' - '),
    unknown: null,
  };

  const handleClick = () => link && navigate(link);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (link && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      navigate(link);
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/50 p-2.5',
        link && 'cursor-pointer hover:bg-muted transition-colors',
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={link ? 'button' : undefined}
      tabIndex={link ? 0 : undefined}
      aria-label={link ? `View ${titleMap[type]}` : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">
              {titleMap[type]}
            </span>
            {item.status && (
              <span className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700',
              )}>
                {item.status}
              </span>
            )}
          </div>

          {!compact && subtitleMap[type] && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {subtitleMap[type]}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasAmount && (
            <span className="text-xs font-semibold">
              {formatCurrency(amount, item.currency)}
            </span>
          )}
          {link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}

const JOFOTARA_STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  validation_error: 'bg-red-100 text-red-700',
  not_submitted: 'bg-gray-100 text-gray-700',
};

function JofotaraSubmissionCard({ item }: { item: any }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.status === 'submitted'
              ? <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
              : item.status === 'failed' || item.status === 'validation_error'
                ? <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                : <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
            <span className="text-xs font-medium">
              {item.isCreditInvoice ? 'Credit Note' : 'JoFotara Submission'}
            </span>
            <span className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              JOFOTARA_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700',
            )}>
              {item.status}
            </span>
          </div>
          {item.uuid && (
            <p className="mt-0.5 ml-5 text-[10px] text-muted-foreground truncate">
              UUID: {item.uuid}
            </p>
          )}
          {item.invoiceNumber && (
            <p className="ml-5 text-[10px] text-muted-foreground">
              JoFotara #: {item.invoiceNumber}
            </p>
          )}
          {item.errorMessage && (
            <p className="ml-5 text-[10px] text-red-600 mt-0.5">{item.errorMessage}</p>
          )}
          {item.createdAt && (
            <p className="ml-5 text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('text-xs font-semibold', className)}>{value}</p>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
