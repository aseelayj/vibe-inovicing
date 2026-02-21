import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModeToggle } from './mode-toggle';

export function ChatModeHeader() {
  const { t } = useTranslation('nav');

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between
        border-b bg-background/80 px-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">{t('appName')}</span>
      </div>

      <ModeToggle />
    </header>
  );
}
