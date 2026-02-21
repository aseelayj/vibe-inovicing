import { Link, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Building2, Mail, Plug, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/settings', labelKey: 'general', icon: Building2, exact: true },
  { path: '/settings/email', labelKey: 'emailSettings', icon: Mail },
  { path: '/settings/integrations', labelKey: 'integrations', icon: Plug },
  { path: '/settings/tax', labelKey: 'taxSettings', icon: Receipt },
] as const;

export function SettingsLayout() {
  const { t } = useTranslation('settings');
  const location = useLocation();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          {t('title')}
        </h2>
        <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sub-navigation */}
        <nav className="shrink-0 lg:w-48">
          {/* Horizontal scrollable on mobile */}
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium',
                      'transition-colors duration-150',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Page content */}
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
