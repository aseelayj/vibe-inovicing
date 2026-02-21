import { useLocation } from 'react-router';
import { Menu, MessageSquare, PanelRightClose } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants';
import { useChat } from '@/contexts/chat-context';
import { Button } from '@/components/ui/button';

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const location = useLocation();
  const { isOpen, toggleChat } = useChat();

  const currentItem = NAV_ITEMS.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path),
  );
  const pageTitle = currentItem?.label || 'Page';

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
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight lg:text-xl">
          {pageTitle}
        </h1>
      </div>

      <Button
        variant={isOpen ? 'secondary' : 'outline'}
        size="sm"
        onClick={toggleChat}
        className="gap-2"
      >
        {isOpen ? (
          <PanelRightClose className="h-4 w-4" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {isOpen ? 'Close Chat' : 'AI Chat'}
        </span>
        <kbd
          className="pointer-events-none ml-1 hidden h-5 select-none items-center
            gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px]
            font-medium text-muted-foreground sm:inline-flex"
        >
          <span className="text-xs">Cmd</span>.
        </kbd>
      </Button>
    </header>
  );
}
