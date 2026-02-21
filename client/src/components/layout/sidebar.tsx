import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  FileText,
  FileCheck,
  FileSpreadsheet,
  Users,
  UsersRound,
  Activity,
  CreditCard,
  RefreshCw,
  Landmark,
  ArrowLeftRight,
  Settings,
  LogOut,
  Zap,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  FileCheck,
  FileSpreadsheet,
  Users,
  UsersRound,
  Activity,
  CreditCard,
  RefreshCw,
  Landmark,
  ArrowLeftRight,
  Wallet,
  Settings,
};

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { logout } = useAuth();
  const { t } = useTranslation('nav');

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose?.();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 z-50 flex w-64 flex-col',
          'ltr:left-0 rtl:right-0',
          'ltr:border-r rtl:border-l',
          'bg-background transition-transform duration-300 ease-in-out',
          // Mobile: slide in/out
          mobileOpen
            ? 'translate-x-0'
            : 'ltr:-translate-x-full rtl:translate-x-full',
          // Desktop: always visible
          'lg:z-30 lg:ltr:translate-x-0 lg:rtl:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 px-6 lg:h-16">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              'bg-primary',
            )}
          >
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            {t('appName')}
          </span>
        </div>

        <Separator />

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
              const label = t(item.labelKey);

              return (
                <li key={item.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
                          'transition-colors duration-150',
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {Icon && (
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              isActive
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                            )}
                          />
                        )}
                        {label}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {label}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        <Separator />

        <div className="px-3 py-4">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start gap-3 text-muted-foreground',
              'hover:text-foreground',
            )}
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </Button>
        </div>
      </aside>
    </>
  );
}
