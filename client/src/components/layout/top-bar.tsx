import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Menu, MessageSquare, PanelRightClose } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants';
import { useChat } from '@/contexts/chat-context';
import { useProactiveAlerts } from '@/hooks/use-proactive-alerts';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/layout/language-toggle';
import { ModeToggle } from './mode-toggle';

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const location = useLocation();
  const { t } = useTranslation('nav');
  const { isOpen, toggleChat } = useChat();
  const { data: alerts } = useProactiveAlerts();

  const currentItem = NAV_ITEMS.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path),
  );
  const pageTitle = currentItem?.labelKey
    ? t(currentItem.labelKey)
    : t('page');

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between
        border-b bg-background/80 px-4 backdrop-blur-sm lg:h-16 lg:px-8"
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:hidden"
          onClick={onToggleSidebar}
          aria-label={t('toggleMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight lg:text-xl">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <ModeToggle />
        <LanguageToggle />
        <Button
          variant={isOpen ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleChat}
          className="gap-2 relative"
        >
          {alerts?.hasAlerts && !isOpen && (
            <span className="absolute -top-1 -end-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive border-2 border-background"></span>
            </span>
          )}
          {isOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {isOpen ? t('closeChat') : t('aiChat')}
          </span>
          <kbd
            className="pointer-events-none ms-1 hidden h-5 select-none items-center
              gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px]
              font-medium text-muted-foreground sm:inline-flex"
          >
            <span className="text-xs">Cmd</span>.
          </kbd>
        </Button>
      </div>
    </header>
  );
}
