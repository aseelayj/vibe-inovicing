import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  FileText,
  FileCheck,
  Users,
  CreditCard,
  RefreshCw,
  Settings,
  LogOut,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  FileCheck,
  Users,
  CreditCard,
  RefreshCw,
  Settings,
};

export function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
          <Zap className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">
          Vibe Invoicing
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    'transition-colors duration-150',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {Icon && (
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        isActive ? 'text-primary-500' : 'text-gray-400',
                      )}
                    />
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-200 px-3 py-4">
        <button
          type="button"
          onClick={logout}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5',
            'text-sm font-medium text-gray-600',
            'transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          <LogOut className="h-5 w-5 text-gray-400" />
          Logout
        </button>
      </div>
    </aside>
  );
}
