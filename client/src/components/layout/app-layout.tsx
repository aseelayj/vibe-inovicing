import { useCallback, useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChatProvider, useChat } from '@/contexts/chat-context';
import { ChatPanel } from '@/components/chat/chat-panel';
import { cn } from '@/lib/utils';

function AppLayoutInner() {
  const { isOpen } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar mobileOpen={sidebarOpen} onClose={closeSidebar} />
        <div
          className={cn(
            'flex flex-1 flex-col transition-[margin-right] duration-300',
            'lg:pl-64',
            isOpen ? 'lg:mr-[420px]' : 'mr-0',
          )}
        >
          <TopBar onToggleSidebar={toggleSidebar} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
        <ChatPanel />
      </div>
    </TooltipProvider>
  );
}

export function AppLayout() {
  return (
    <ChatProvider>
      <AppLayoutInner />
    </ChatProvider>
  );
}
