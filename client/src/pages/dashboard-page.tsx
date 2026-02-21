import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  Landmark,
  TrendingDown,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  useDashboardStats,
  useRevenueChart,
  useRecentActivity,
} from '@/hooks/use-dashboard';
import { useTaxDeadlines, useGstSummary } from '@/hooks/use-reports';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, formatDate, formatTimeAgo } from '@/lib/format';

const statCards = [
  {
    key: 'totalRevenue' as const,
    label: 'totalRevenue',
    icon: DollarSign,
    color: 'text-green-600 bg-green-100',
  },
  {
    key: 'outstandingAmount' as const,
    label: 'outstanding',
    icon: Clock,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    key: 'overdueAmount' as const,
    label: 'overdue',
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100',
  },
  {
    key: 'totalBankBalance' as const,
    label: 'bankBalance',
    icon: Landmark,
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    key: 'monthlyExpenses' as const,
    label: 'expensesMonth',
    icon: TrendingDown,
    color: 'text-orange-600 bg-orange-100',
  },
];

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: chartData, isLoading: chartLoading } = useRevenueChart();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: deadlines } = useTaxDeadlines();
  const { data: gstSummary } = useGstSummary();
  const { data: settings } = useSettings();
  const currency = settings?.defaultCurrency || 'JOD';

  if (statsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Stat Cards — 2-col on mobile, scales up */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5 xl:gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = stats?.[card.key] ?? 0;

          return (
            <Card key={card.key} className="py-4 sm:py-6">
              <CardContent className="px-3 pt-0 sm:px-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
                      {t(card.label)}
                    </p>
                    <p className="mt-1 text-lg font-bold tracking-tight sm:text-2xl">
                      {formatCurrency(value, currency)}
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-lg p-2 sm:p-3 ${card.color}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue Chart + Recent Activity */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t('revenueOverview')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="h-48 sm:h-64 lg:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData || []}
                    margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1000
                          ? `${formatCurrency(v / 1000, currency).replace(/\.00$/, '')}k`
                          : formatCurrency(v, currency)
                      }
                      width={45}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatCurrency(value),
                        t('revenue', { ns: 'common' }),
                      ]}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        backgroundColor: 'hsl(var(--background))',
                        fontSize: '13px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <LoadingSpinner size="sm" />
            ) : !activity?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('noRecentActivity')}
              </p>
            ) : (
              <ul className="space-y-1">
                {activity.slice(0, 8).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex gap-3 rounded-md px-2 py-2.5 transition-colors
                      hover:bg-accent/50"
                  >
                    <div
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        {entry.description
                          || `${entry.action} on ${entry.entityType}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatTimeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tax Compliance Widgets */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        {/* Upcoming Tax Deadlines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t('taxDeadlines')}</CardTitle>
            <Link
              to="/tax-reports?tab=sales-tax"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t('viewReports')}
            </Link>
          </CardHeader>
          <CardContent>
            {!deadlines?.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('noUpcomingDeadlines')}
              </p>
            ) : (
              <ul className="space-y-2">
                {deadlines.slice(0, 4).map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
                  >
                    <div
                      className={`shrink-0 rounded-lg p-1.5 ${
                        d.daysUntil <= 14
                          ? 'bg-red-100 text-red-600'
                          : d.daysUntil <= 30
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <Link
                      to={`/tax-reports?tab=${d.type === 'gst' ? 'sales-tax' : 'income-tax'}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="text-sm font-medium leading-snug">
                        {d.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.period} — {formatDate(d.deadline)}
                      </p>
                    </Link>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        d.daysUntil <= 14
                          ? 'text-red-600'
                          : d.daysUntil <= 30
                            ? 'text-yellow-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {t('daysShort', { days: d.daysUntil })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Current Period GST */}
        {gstSummary && (
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">
                {t('gstSummaryPeriod', { period: gstSummary.period.label })}
              </CardTitle>
              <Link
                to={`/tax-reports?tab=sales-tax`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <FileSpreadsheet className="me-1 inline h-3 w-3" />
                {t('fullReport')}
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t('taxableSales')}</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {formatCurrency(gstSummary.taxableSales, 'JOD')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('outputTax')}</p>
                  <p className="mt-0.5 text-sm font-semibold text-red-600">
                    {formatCurrency(gstSummary.outputTax, 'JOD')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('inputTax')}</p>
                  <p className="mt-0.5 text-sm font-semibold text-green-600">
                    {formatCurrency(gstSummary.inputTax, 'JOD')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('netDue')}</p>
                  <p
                    className={`mt-0.5 text-sm font-bold ${
                      gstSummary.netTax >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {formatCurrency(gstSummary.netTax, 'JOD')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
