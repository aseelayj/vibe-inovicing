import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Loader2, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export function LoginPage() {
  const { t } = useTranslation('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(t('emailAndPasswordRequired'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      toast.success(t('welcomeBack'));
      navigate('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('invalidCredentials'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center
              rounded-2xl bg-primary"
          >
            <Zap className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('appName')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('signInToContinue')}
          </p>
        </div>

        <Card>
          <CardHeader className="sr-only">
            <CardTitle>{t('signIn')}</CardTitle>
            <CardDescription>
              {t('authenticateToAccess')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('enterYourEmail')}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('enterYourPassword')}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    autoComplete="current-password"
                    aria-invalid={!!error}
                  />
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t('signIn')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
