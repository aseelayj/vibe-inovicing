import { memo } from 'react';
import { useNavigate } from 'react-router';
import { ExternalLink, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';

interface AiEntityCardProps {
  data: unknown;
  toolName: string;
  onAction?: (text: string) => void;
}

function formatCurrency(amount: number | string, currency = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
}

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

export const AiEntityCard = memo(function AiEntityCard({ data, toolName, onAction }: AiEntityCardProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  if (!data) return null;

  // Revenue chart
  if (Array.isArray(data) && toolName.includes('revenue_chart')) {
    return (
      <div className="rounded-xl border bg-background p-3.5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {t('revenue12Months')}
        </p>
        <div className="h-36 w-full min-w-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} />
              <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                        <p className="text-[10px] text-muted-foreground">{d.month}</p>
                        <p className="text-xs font-semibold">{formatCurrency(d.revenue)}</p>
                        <p className="text-[10px] text-muted-foreground">{t('invoiceCount', { count: d.invoiceCount })}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Tax deadlines
  if (Array.isArray(data) && toolName.includes('tax_deadlines')) {
    return (
      <div className="space-y-1">
        {data.map((d: any, i: number) => (
          <div key={i} className="rounded-lg border bg-background p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Clock className={cn('h-3 w-3 shrink-0',
                    d.daysUntil <= 14 ? 'text-red-500' : d.daysUntil <= 30 ? 'text-amber-500' : 'text-muted-foreground/50',
                  )} />
                  <span className="text-xs font-medium">{d.label}</span>
                </div>
                <p className="mt-0.5 ms-[18px] text-[10px] text-muted-foreground/60">
                  {d.period} &middot; Due: {d.deadline}
                </p>
              </div>
              <span className={cn(
                'text-[11px] font-semibold shrink-0',
                d.daysUntil <= 14 ? 'text-red-500' : d.daysUntil <= 30 ? 'text-amber-500' : 'text-muted-foreground/50',
              )}>
                {d.daysUntil <= 0 ? t('overdue') : t('daysLeft', { count: d.daysUntil })}
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
      return <EmptyCard text={t('noJofotaraSubmissions')} />;
    }
    return (
      <div className="space-y-1">
        {data.map((s: any, i: number) => <JofotaraSubmissionCard key={s.id ?? i} item={s} />)}
      </div>
    );
  }

  // GST Summary
  if (!Array.isArray(data) && toolName.includes('gst_summary')) {
    const d = data as any;
    return (
      <div className="rounded-xl border bg-background p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t('gstSummary')}</p>
          <span className="text-[10px] text-muted-foreground/60">{d.period?.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('taxableSales')} value={formatCurrency(d.taxableSales, 'JOD')} />
          <Stat label={t('exemptSales')} value={formatCurrency(d.exemptSales, 'JOD')} />
          <Stat label={t('outputTax16')} value={formatCurrency(d.outputTax, 'JOD')} />
          <Stat label={t('inputTax')} value={formatCurrency(d.inputTax, 'JOD')} />
        </div>
        <div className="border-t pt-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium">{t('netTaxPayable')}</span>
            <span className={cn('font-semibold', d.netTax > 0 ? 'text-red-500' : 'text-green-600')}>
              {formatCurrency(d.netTax, 'JOD')}
            </span>
          </div>
        </div>
        {d.period?.deadline && (
          <p className="text-[10px] text-muted-foreground/50">{t('filingDeadline', { date: d.period.deadline })}</p>
        )}
      </div>
    );
  }

  // Sales Tax Report
  if (!Array.isArray(data) && toolName.includes('sales_tax_report')) {
    const d = data as any;
    return (
      <div className="rounded-xl border bg-background p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t('salesTaxReport')}</p>
          <span className="text-[10px] text-muted-foreground/60">{d.period?.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('taxableSales')} value={formatCurrency(d.taxableSales, 'JOD')} />
          <Stat label={t('exemptSales')} value={formatCurrency(d.exemptSales, 'JOD')} />
          <Stat label={t('totalSales')} value={formatCurrency(d.totalSales, 'JOD')} />
          <Stat label={t('outputTax')} value={formatCurrency(d.outputTax, 'JOD')} />
        </div>
        <p className="text-[10px] text-muted-foreground/50">{t('invoiceCount', { count: d.invoiceCount })}</p>
      </div>
    );
  }

  // Purchases Report
  if (!Array.isArray(data) && toolName.includes('purchases_report')) {
    const d = data as any;
    return (
      <div className="rounded-xl border bg-background p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t('purchasesReport')}</p>
          <span className="text-[10px] text-muted-foreground/60">{d.period?.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('totalPurchases')} value={formatCurrency(d.totalPurchases, 'JOD')} />
          <Stat label={t('inputTax')} value={formatCurrency(d.inputTax, 'JOD')} />
        </div>
        <p className="text-[10px] text-muted-foreground/50">{t('expenseCount', { count: d.transactionCount })}</p>
      </div>
    );
  }

  // Income Tax Report
  if (!Array.isArray(data) && toolName.includes('income_tax_report')) {
    const d = data as any;
    return (
      <div className="rounded-xl border bg-background p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t('incomeTaxReport')}</p>
          <span className="text-[10px] text-muted-foreground/60">{d.year}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('revenue')} value={formatCurrency(d.totalRevenue, 'JOD')} />
          <Stat label={t('expenses')} value={formatCurrency(d.totalExpenses, 'JOD')} />
          <Stat label={t('grossProfit')} value={formatCurrency(d.grossProfit, 'JOD')} />
          <Stat label={t('exemptions')} value={formatCurrency(d.totalExemptions, 'JOD')} />
          <Stat label={t('taxableIncome')} value={formatCurrency(d.taxableIncome, 'JOD')} />
          <Stat label={t('incomeTax')} value={formatCurrency(d.totalTax, 'JOD')} className="text-red-500" />
        </div>
        {d.nationalContribution > 0 && (
          <Stat label={t('nationalContribution')} value={formatCurrency(d.nationalContribution, 'JOD')} />
        )}
        <div className="border-t pt-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium">{t('totalLiability')}</span>
            <span className="font-semibold text-red-500">{formatCurrency(d.totalLiability, 'JOD')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Profit & Loss
  if (!Array.isArray(data) && toolName.includes('profit_loss')) {
    const d = data as any;
    return (
      <div className="rounded-xl border bg-background p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t('profitAndLoss')}</p>
          <span className="text-[10px] text-muted-foreground/60">
            {d.period?.startDate} &ndash; {d.period?.endDate}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('revenue')} value={formatCurrency(d.revenue?.total ?? 0, 'JOD')} />
          <Stat label={t('expenses')} value={formatCurrency(d.expenses?.total ?? 0, 'JOD')} />
          <Stat
            label={t('netProfit')}
            value={formatCurrency(d.netProfit ?? 0, 'JOD')}
            className={d.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}
          />
        </div>
        {d.expenses?.byCategory?.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground/60">{t('topExpenses')}</p>
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

  // JoFotara validation
  if (!Array.isArray(data) && toolName.includes('validate_for_jofotara')) {
    const d = data as any;
    return (
      <div className={cn(
        'rounded-xl border p-3.5 space-y-1.5',
        d.valid ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50',
      )}>
        <div className="flex items-center gap-1.5">
          {d.valid
            ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            : <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
          <span className="text-xs font-medium">
            {d.valid ? t('readyForJofotara') : t('validationFailed')}
          </span>
        </div>
        {d.errors?.length > 0 && (
          <ul className="ms-5 space-y-0.5">
            {d.errors.map((err: string, i: number) => (
              <li key={i} className="text-[10px] text-red-600">&bull; {err}</li>
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
    if (data.length === 0) return <EmptyCard text={t('noResultsFound')} />;
    return (
      <div className="space-y-1">
        {data.slice(0, 10).map((item: any, i) => (
          <SingleEntityCard
            key={item.id ?? i}
            item={item}
            toolName={toolName}
            navigate={navigate}
            onAction={onAction}
            compact
          />
        ))}
        {data.length > 10 && (
          <p className="py-1 text-center text-[10px] text-muted-foreground/50">
            {t('moreResults', { count: data.length - 10 })}
          </p>
        )}
      </div>
    );
  }

  // Simple message result
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return (
      <div className="rounded-xl border bg-background px-3.5 py-2.5 text-xs text-foreground">
        {(data as any).message}
      </div>
    );
  }

  return (
    <SingleEntityCard
      item={data as any}
      toolName={toolName}
      navigate={navigate}
      onAction={onAction}
    />
  );
});

// --- Quick Actions ---

function getQuickActions(
  type: string,
  item: any,
  t: (key: string) => string,
): { label: string; prompt: string }[] {
  const actions: { label: string; prompt: string }[] = [];
  const id = item.id;
  if (!id) return actions;

  if (type === 'invoice') {
    const num = item.invoiceNumber || `#${id}`;
    if (item.status === 'draft') {
      actions.push({ label: t('send'), prompt: `Send invoice ${num}` });
    }
    if (item.status === 'sent' || item.status === 'overdue' || item.status === 'viewed') {
      actions.push({ label: t('markPaid'), prompt: `Mark invoice ${num} as paid` });
      actions.push({ label: t('remind'), prompt: `Send reminder for invoice ${num}` });
    }
    if (item.isTaxable && item.currency === 'JOD'
      && (!item.jofotaraStatus || item.jofotaraStatus === 'not_submitted')) {
      actions.push({ label: t('jofotara'), prompt: `Submit invoice ${num} to JoFotara` });
    }
  }

  if (type === 'quote') {
    const num = item.quoteNumber || `#${id}`;
    if (item.status === 'draft') {
      actions.push({ label: t('send'), prompt: `Send quote ${num}` });
    }
    if (item.status === 'sent' || item.status === 'accepted') {
      actions.push({ label: t('convert'), prompt: `Convert quote ${num} to invoice` });
    }
  }

  if (type === 'client') {
    actions.push({ label: t('newInvoice'), prompt: `Create invoice for ${item.name}` });
  }

  return actions;
}

// --- Single Entity Card ---

function SingleEntityCard({
  item,
  toolName,
  navigate,
  onAction,
  compact,
}: {
  item: any;
  toolName: string;
  navigate: (path: string) => void;
  onAction?: (text: string) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation('common');
  const type = detectEntityType(toolName, item);

  const getLink = (): string | null => {
    switch (type) {
      case 'invoice': return item.id ? `/invoices/${item.id}` : null;
      case 'quote': return item.id ? `/quotes/${item.id}` : null;
      case 'client': return item.id ? `/clients/${item.id}` : null;
      case 'bank_account': return `/bank-accounts`;
      case 'recurring': return '/recurring';
      case 'payment': return '/payments';
      case 'transaction': return '/transactions';
      default: return null;
    }
  };

  const link = getLink();
  const quickActions = onAction ? getQuickActions(type, item, t) : [];

  // Stats
  if (type === 'stats') {
    return (
      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-background p-3.5">
        {item.totalRevenue !== undefined && <Stat label={t('revenue')} value={formatCurrency(item.totalRevenue)} />}
        {item.outstandingAmount !== undefined && <Stat label={t('outstanding')} value={formatCurrency(item.outstandingAmount)} />}
        {item.overdueAmount !== undefined && <Stat label={t('overdue')} value={formatCurrency(item.overdueAmount)} className="text-red-500" />}
        {item.totalBankBalance !== undefined && <Stat label={t('bankBalance')} value={formatCurrency(item.totalBankBalance)} />}
        {item.totalInvoices !== undefined && <Stat label={t('invoices')} value={String(item.totalInvoices)} />}
        {item.totalClients !== undefined && <Stat label={t('clients')} value={String(item.totalClients)} />}
        {item.paidThisMonth !== undefined && <Stat label={t('paidThisMonth')} value={formatCurrency(item.paidThisMonth)} />}
        {item.monthlyExpenses !== undefined && <Stat label={t('monthlyExpenses')} value={formatCurrency(item.monthlyExpenses)} />}
      </div>
    );
  }

  // Settings
  if (type === 'settings') {
    return (
      <div className="rounded-xl border bg-background p-3.5 space-y-1.5">
        {item.businessName && <SettingRow label={t('business')} value={item.businessName} />}
        {item.businessEmail && <SettingRow label={t('email')} value={item.businessEmail} />}
        {item.defaultCurrency && <SettingRow label={t('currency')} value={item.defaultCurrency} />}
        {item.defaultTaxRate != null && <SettingRow label={t('taxRate')} value={`${item.defaultTaxRate}%`} />}
        {item.defaultPaymentTerms != null && <SettingRow label={t('paymentTerms')} value={t('daysCount', { count: item.defaultPaymentTerms })} />}
        {item.jofotaraEnabled != null && <SettingRow label={t('jofotara')} value={item.jofotaraEnabled ? t('enabled') : t('disabled')} />}
        {item.jofotaraCompanyTin && <SettingRow label={t('companyTin')} value={item.jofotaraCompanyTin} />}
        {item.filingStatus && <SettingRow label={t('filingStatus')} value={item.filingStatus} />}
      </div>
    );
  }

  // Activity log
  if (type === 'activity_log') {
    return (
      <div className="rounded-lg border bg-background p-2.5">
        <p className="text-xs">{item.description}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">
          {item.entityType} &middot; {item.action}
          {item.createdAt && ` &middot; ${new Date(item.createdAt).toLocaleString()}`}
        </p>
      </div>
    );
  }

  // Email log
  if (type === 'email_log') {
    return (
      <div className="rounded-lg border bg-background p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{item.subject}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              {t('to')}: {item.recipientEmail}
              {item.sentAt && ` &middot; ${new Date(item.sentAt).toLocaleString()}`}
            </p>
          </div>
          {item.status && (
            <StatusBadge status={item.status} />
          )}
        </div>
      </div>
    );
  }

  // Generic entity
  const amount = item.total ?? item.amount ?? item.currentBalance;
  const hasAmount = amount != null && amount !== '' && !isNaN(parseFloat(String(amount)));

  const titleMap: Record<string, string> = {
    invoice: item.invoiceNumber || t('entityWithId', { entity: t('invoice'), id: item.id }),
    quote: item.quoteNumber || t('entityWithId', { entity: t('quote'), id: item.id }),
    client: item.name || t('entityWithId', { entity: t('client'), id: item.id }),
    payment: t('entityWithId', { entity: t('payment'), id: item.id }),
    bank_account: item.name || t('entityWithId', { entity: t('account'), id: item.id }),
    transaction: item.description || t('entityWithId', { entity: t('transaction'), id: item.id }),
    recurring: `${t('recurring')} ${item.frequency || ''} #${item.id}`,
    unknown: `#${item.id}`,
  };

  const subtitleMap: Record<string, string | null> = {
    invoice: item.client?.name || null,
    quote: item.client?.name || null,
    client: [item.email, item.company ? `(${item.company})` : null].filter(Boolean).join(' ') || null,
    payment: item.invoice?.invoiceNumber ? `${t('invoice')} ${item.invoice.invoiceNumber}` : t('entityWithId', { entity: t('invoice'), id: item.invoiceId }),
    bank_account: item.bankName || null,
    transaction: item.bankAccount?.name || item.category || null,
    recurring: [item.frequency, item.client?.name || t('entityWithId', { entity: t('client'), id: item.clientId })].filter(Boolean).join(' - '),
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
        'rounded-lg border bg-background p-2.5',
        link && 'cursor-pointer transition-colors hover:bg-muted/50',
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
            <span className="text-xs font-medium truncate">{titleMap[type]}</span>
            {item.status && <StatusBadge status={item.status} />}
          </div>
          {!compact && subtitleMap[type] && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/60">{subtitleMap[type]}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasAmount && (
            <span className="text-xs font-semibold">{formatCurrency(amount, item.currency)}</span>
          )}
          {link && <ExternalLink className="h-3 w-3 text-muted-foreground/40" />}
        </div>
      </div>

      {quickActions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={(e) => { e.stopPropagation(); onAction?.(action.prompt); }}
              className="rounded-md border border-border/50 bg-background px-2 py-0.5
                text-[10px] font-medium text-muted-foreground transition-colors
                hover:border-primary/30 hover:text-foreground"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Helper Components ---

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-background px-3.5 py-4 text-center text-xs text-muted-foreground/60">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
      STATUS_COLORS[status] || 'bg-muted text-muted-foreground',
    )}>
      {status}
    </span>
  );
}

const JOFOTARA_STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  validation_error: 'bg-red-100 text-red-700',
  not_submitted: 'bg-muted text-muted-foreground',
};

function JofotaraSubmissionCard({ item }: { item: any }) {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.status === 'submitted'
              ? <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
              : item.status === 'failed' || item.status === 'validation_error'
                ? <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                : <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
            <span className="text-xs font-medium">
              {item.isCreditInvoice ? t('creditNote') : t('jofotara')}
            </span>
            <span className={cn(
              'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              JOFOTARA_STATUS_COLORS[item.status] || 'bg-muted text-muted-foreground',
            )}>
              {item.status}
            </span>
          </div>
          {item.uuid && (
            <p className="mt-0.5 ms-[18px] text-[10px] text-muted-foreground/60 truncate">
              UUID: {item.uuid}
            </p>
          )}
          {item.invoiceNumber && (
            <p className="ms-[18px] text-[10px] text-muted-foreground/60">
              JoFotara #: {item.invoiceNumber}
            </p>
          )}
          {item.errorMessage && (
            <p className="ms-[18px] text-[10px] text-red-500 mt-0.5">{item.errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground/60">{label}</p>
      <p className={cn('text-xs font-semibold', className)}>{value}</p>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
