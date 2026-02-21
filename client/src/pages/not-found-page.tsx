import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

export function NotFoundPage() {
  const { t } = useTranslation('common');

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center py-10">
          <div className="mb-4 rounded-full bg-muted p-4">
            <FileQuestion className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="mb-2 text-3xl font-bold">{t('notFoundTitle')}</h1>
          <p className="mb-6 text-muted-foreground">
            {t('notFoundMessage')}
          </p>
          <Link to="/">
            <Button>{t('backToDashboard')}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
