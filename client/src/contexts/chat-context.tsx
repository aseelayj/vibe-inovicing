import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface ChatContextValue {
  isOpen: boolean;
  activeConversationId: number | null;
  pendingMessage: string | null;
  toggleChat: () => void;
  openChat: (conversationId?: number) => void;
  openChatWithMessage: (message: string) => void;
  closeChat: () => void;
  setActiveConversation: (id: number | null) => void;
  startNewChat: () => void;
  clearPendingMessage: () => void;
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

  // Cmd+. keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        activeConversationId,
        pendingMessage,
        toggleChat,
        openChat,
        openChatWithMessage,
        closeChat,
        setActiveConversation,
        startNewChat,
        clearPendingMessage,
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
