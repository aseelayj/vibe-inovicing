import { Maximize2, PanelRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChat, type DashboardMode } from '@/contexts/chat-context';
import { cn } from '@/lib/utils';

const modes: { value: DashboardMode; labelKey: string; icon: typeof PanelRight }[] = [
  { value: 'default', labelKey: 'defaultMode', icon: PanelRight },
  { value: 'chat', labelKey: 'chatMode', icon: Maximize2 },
];

export function ModeToggle() {
  const { t } = useTranslation('nav');
  const { dashboardMode, setDashboardMode } = useChat();

  return (
    <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
      {modes.map(({ value, labelKey, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setDashboardMode(value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
            'transition-all',
            dashboardMode === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
