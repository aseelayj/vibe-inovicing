import { useCallback, useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChatProvider, useChat } from '@/contexts/chat-context';
import { ChatPanel } from '@/components/chat/chat-panel';
import { ChatModeHeader } from '@/components/layout/chat-mode-header';
import { cn } from '@/lib/utils';

function AppLayoutInner() {
  const { isOpen, dashboardMode } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (dashboardMode === 'chat') {
    return (
      <TooltipProvider>
        <div className="flex h-screen bg-background">
          <Sidebar mobileOpen={sidebarOpen} onClose={closeSidebar} />
          <div className="flex flex-1 flex-col ltr:lg:pl-64 rtl:lg:pr-64">
            <ChatModeHeader onToggleSidebar={toggleSidebar} />
            <ChatPanel variant="fullscreen" />
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar mobileOpen={sidebarOpen} onClose={closeSidebar} />
        <div
          className={cn(
            'flex flex-1 flex-col transition-[margin] duration-300',
            'ltr:lg:pl-64 rtl:lg:pr-64',
            isOpen
              ? 'ltr:lg:mr-[420px] rtl:lg:ml-[420px]'
              : 'ltr:mr-0 rtl:ml-0',
          )}
        >
          <TopBar onToggleSidebar={toggleSidebar} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
        <ChatPanel variant="sidebar" />
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
