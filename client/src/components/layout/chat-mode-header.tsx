import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModeToggle } from './mode-toggle';

interface ChatModeHeaderProps {
  onToggleSidebar?: () => void;
}

export function ChatModeHeader({ onToggleSidebar }: ChatModeHeaderProps) {
  const { t } = useTranslation('nav');

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between
        border-b bg-background/80 px-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg
            text-muted-foreground transition-colors hover:bg-muted
            hover:text-foreground lg:hidden"
          aria-label={t('toggleMenu')}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <ModeToggle />
    </header>
  );
}
