import { useTranslation } from 'react-i18next';
import { Mail, Eye, MousePointerClick } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEmailLog } from '@/hooks/use-email-log';

interface EmailTrackingCardProps {
  invoiceId?: number;
  quoteId?: number;
}

export function EmailTrackingCard({ invoiceId, quoteId }: EmailTrackingCardProps) {
  const { t } = useTranslation('common');
  const { data: emails, isLoading } = useEmailLog({ invoiceId, quoteId });

  if (isLoading || !emails || emails.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          {t('emailHistory', 'Email History')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {emails.map((email) => (
          <div
            key={email.id}
            className="rounded-lg border p-3 text-sm space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{email.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {email.recipientEmail}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(email.sentAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {email.openCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                >
                  <Eye className="mr-1 h-3 w-3" />
                  {t('opened', 'Opened')} ({email.openCount})
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-muted-foreground">
                  <Eye className="mr-1 h-3 w-3" />
                  {t('noOpens', 'No opens recorded')}
                </Badge>
              )}
              {email.clickCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  <MousePointerClick className="mr-1 h-3 w-3" />
                  {t('clicked', 'Clicked')} ({email.clickCount})
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
