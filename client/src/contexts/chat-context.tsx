import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type DashboardMode = 'default' | 'chat';

interface ChatContextValue {
  isOpen: boolean;
  activeConversationId: number | null;
  pendingMessage: string | null;
  dashboardMode: DashboardMode;
  toggleChat: () => void;
  openChat: (conversationId?: number) => void;
  openChatWithMessage: (message: string) => void;
  closeChat: () => void;
  setActiveConversation: (id: number | null) => void;
  startNewChat: () => void;
  clearPendingMessage: () => void;
  setDashboardMode: (mode: DashboardMode) => void;
  toggleDashboardMode: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem('chat-open') === 'true';
  });
  const [activeConversationId, setActiveConversationId] = useState<number | null>(() => {
    const stored = localStorage.getItem('chat-conversation-id');
    if (!stored) return null;
    const id = parseInt(stored, 10);
    return isNaN(id) ? null : id;
  });
  const [dashboardMode, setDashboardModeState] = useState<DashboardMode>(() => {
    const stored = localStorage.getItem('dashboard-mode');
    return stored === 'chat' ? 'chat' : 'default';
  });

  useEffect(() => {
    localStorage.setItem('chat-open', String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem('chat-conversation-id', String(activeConversationId));
    } else {
      localStorage.removeItem('chat-conversation-id');
    }
  }, [activeConversationId]);

  useEffect(() => {
    localStorage.setItem('dashboard-mode', dashboardMode);
  }, [dashboardMode]);

  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);
  const openChat = useCallback((conversationId?: number) => {
    setIsOpen(true);
    if (conversationId) setActiveConversationId(conversationId);
  }, []);
  const openChatWithMessage = useCallback((message: string) => {
    setActiveConversationId(null);
    setPendingMessage(message);
    setIsOpen(true);
  }, []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const setActiveConversation = useCallback((id: number | null) => {
    setActiveConversationId(id);
  }, []);
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setIsOpen(true);
  }, []);
  const clearPendingMessage = useCallback(() => setPendingMessage(null), []);

  const setDashboardMode = useCallback((mode: DashboardMode) => {
    setDashboardModeState(mode);
    if (mode === 'chat') {
      setIsOpen(true);
    }
  }, []);

  const toggleDashboardMode = useCallback(() => {
    setDashboardModeState((prev) => {
      const next = prev === 'default' ? 'chat' : 'default';
      if (next === 'chat') setIsOpen(true);
      return next;
    });
  }, []);

  // Cmd+. → toggle chat sidebar (default mode only)
  // Cmd+Shift+. → toggle dashboard mode (works in both modes)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          toggleDashboardMode();
        } else if (dashboardMode === 'default') {
          setIsOpen((prev) => !prev);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dashboardMode, toggleDashboardMode]);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        activeConversationId,
        pendingMessage,
        dashboardMode,
        toggleChat,
        openChat,
        openChatWithMessage,
        closeChat,
        setActiveConversation,
        startNewChat,
        clearPendingMessage,
        setDashboardMode,
        toggleDashboardMode,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
