import { useLocation } from 'react-router';
import { Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS } from '@/lib/constants';

export function TopBar() {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const currentItem = NAV_ITEMS.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path),
  );
  const pageTitle = currentItem?.label || 'Page';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-8 backdrop-blur-sm">
      <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          aria-label="AI Assistant"
        >
          <Sparkles className="h-4 w-4 text-primary-500" />
          AI
        </button>
      </div>
    </header>
  );
}
