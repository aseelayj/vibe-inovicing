import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  CreditCard,
  Users,
  FileCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useDailySummary, useAiDailySummary } from '@/hooks/use-daily-summary';
import { formatTimeAgo } from '@/lib/format';

export function TeamActivityPage() {
  const { t } = useTranslation('team-activity');
  const { t: tc } = useTranslation('common');
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [aiExpanded, setAiExpanded] = useState(false);

  const { data: summary, isLoading } = useDailySummary(date);
  const {
    data: aiSummary,
    isLoading: aiLoading,
    refetch: fetchAi,
  } = useAiDailySummary(date, aiExpanded);

  const handleToggleAi = () => {
    const next = !aiExpanded;
    setAiExpanded(next);
    if (next) fetchAi();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setAiExpanded(false);
          }}
          className="w-44"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* AI Summary Card */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={handleToggleAi}
            >
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  {t('aiSummary')}
                </span>
                {aiExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>
            {aiExpanded && (
              <CardContent>
                {aiLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-muted-foreground">
                      {t('generatingSummary')}
                    </span>
                  </div>
                ) : aiSummary ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed">
                      {aiSummary.summary}
                    </p>
                    {aiSummary.userSummaries?.length > 0 && (
                      <div className="space-y-2 border-t pt-3">
                        {aiSummary.userSummaries.map((us, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium">
                              {us.userName}:
                            </span>{' '}
                            <span className="text-muted-foreground">
                              {us.summary}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('noActivityForDate')}
                  </p>
                )}
              </CardContent>
            )}
          </Card>

          {/* Stats overview */}
          {summary && summary.totalActivities > 0 && (
            <div className="text-sm text-muted-foreground">
              {t('totalActivities', {
                count: summary.totalActivities,
              })}
            </div>
          )}

          {/* Per-user activity sections */}
          {!summary?.users?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {t('noActivityForDate')}
                </p>
              </CardContent>
            </Card>
          ) : (
            summary.users.map((userGroup) => (
              <Card key={userGroup.userId}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      {userGroup.userName}
                      <Badge
                        variant={
                          userGroup.userRole === 'owner'
                            ? 'default'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {userGroup.userRole}
                      </Badge>
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {t('actions', {
                        count: userGroup.activityCount,
                      })}
                    </span>
                  </CardTitle>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {userGroup.stats.invoicesCreated > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        {userGroup.stats.invoicesCreated}{' '}
                        {tc('invoices').toLowerCase()}
                      </div>
                    )}
                    {userGroup.stats.paymentsRecorded > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CreditCard className="h-3.5 w-3.5" />
                        {userGroup.stats.paymentsRecorded}{' '}
                        {tc('payment').toLowerCase()}s
                      </div>
                    )}
                    {userGroup.stats.clientsAdded > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {userGroup.stats.clientsAdded}{' '}
                        {tc('clients').toLowerCase()}
                      </div>
                    )}
                    {userGroup.stats.quotesCreated > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileCheck className="h-3.5 w-3.5" />
                        {userGroup.stats.quotesCreated}{' '}
                        {tc('quote').toLowerCase()}s
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-1">
                    {userGroup.activities.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
                      >
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
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
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}
