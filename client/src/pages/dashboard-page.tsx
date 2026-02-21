import { useState } from 'react';
import {
  DollarSign,
  Clock,
  AlertTriangle,
  Users,
  Sparkles,
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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  useDashboardStats,
  useRevenueChart,
  useRecentActivity,
} from '@/hooks/use-dashboard';
import { useSummarizeDashboard } from '@/hooks/use-ai';
import { formatCurrency, formatTimeAgo } from '@/lib/format';

const statCards = [
  {
    key: 'totalRevenue' as const,
    label: 'Total Revenue',
    icon: DollarSign,
    color: 'text-green-600 bg-green-100',
  },
  {
    key: 'outstandingAmount' as const,
    label: 'Outstanding',
    icon: Clock,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    key: 'overdueAmount' as const,
    label: 'Overdue',
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100',
  },
  {
    key: 'totalClients' as const,
    label: 'Total Clients',
    icon: Users,
    color: 'text-purple-600 bg-purple-100',
    isCurrency: false,
  },
];

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: chartData, isLoading: chartLoading } = useRevenueChart();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const summarize = useSummarizeDashboard();
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const handleSummarize = async () => {
    try {
      const result = await summarize.mutateAsync();
      setAiSummary(result.summary);
    } catch {
      // handled by mutation
    }
  };

  if (statsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = stats?.[card.key] ?? 0;
          const isCurrency = card.isCurrency !== false;

          return (
            <div
              key={card.key}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {isCurrency ? formatCurrency(value) : value}
                  </p>
                </div>
                <div className={`rounded-lg p-3 ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Revenue Overview" className="xl:col-span-2">
          {chartLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData || []}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      formatCurrency(value),
                      'Revenue',
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Recent Activity">
          {activityLoading ? (
            <LoadingSpinner size="sm" />
          ) : !activity?.length ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No recent activity
            </p>
          ) : (
            <ul className="space-y-4">
              {activity.slice(0, 8).map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-700">
                      {entry.description || `${entry.action} on ${entry.entityType}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatTimeAgo(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="AI Summary">
        {aiSummary ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {aiSummary}
            </p>
            <Button variant="ghost" size="sm" onClick={handleSummarize}>
              Regenerate
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8">
            <Sparkles className="mb-3 h-8 w-8 text-primary-400" />
            <p className="mb-4 text-sm text-gray-500">
              Get an AI-powered summary of your business performance
            </p>
            <Button
              onClick={handleSummarize}
              loading={summarize.isPending}
            >
              <Sparkles className="h-4 w-4" />
              Generate Summary
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
