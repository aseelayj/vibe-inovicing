import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/chat-context';
import {
  useConversations, useCreateConversation, useDeleteConversation,
  useUpdateConversation, useChatMessages,
} from '@/hooks/use-chat';
import { useChatStream } from '@/hooks/use-chat-stream';
import { usePageContext } from '@/hooks/use-page-context';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { ConversationSwitcher } from './conversation-switcher';
import { cn } from '@/lib/utils';
import type { ChatAttachment, ChatMessage } from '@vibe/shared';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Context-aware suggestion chips
function getSuggestions(section: string, entityType?: string, entityId?: number): string[] {
  const base = ['Show my dashboard stats', 'Show tax deadlines'];
  if (section === 'invoices') {
    return ['Create a new invoice', 'Show overdue invoices', 'List unpaid invoices'];
  }
  if (section === 'quotes') {
    return ['Create a new quote', 'Show all quotes', 'Convert a quote to invoice'];
  }
  if (section === 'clients') {
    return ['Create a new client', 'List all clients', 'Show client details'];
  }
  if (entityType === 'invoice' && entityId) {
    return [
      `Send invoice #${entityId}`, `Mark invoice #${entityId} as paid`,
      `Validate invoice #${entityId} for JoFotara`,
    ];
  }
  if (entityType === 'quote' && entityId) {
    return [`Send quote #${entityId}`, `Convert quote #${entityId} to invoice`];
  }
  if (section === 'dashboard') {
    return ['Show my revenue chart', 'Get GST summary', 'Show tax deadlines'];
  }
  if (section === 'payments') {
    return ['List all payments', 'Record a new payment'];
  }
  if (section === 'bank-accounts') {
    return ['List bank accounts', 'Create a bank account'];
  }
  if (section === 'transactions') {
    return ['List recent transactions', 'Create a transaction'];
  }
  if (section === 'settings') {
    return ['Show my settings', 'Show JoFotara config'];
  }
  return base;
}

export function ChatPanel() {
  const {
    isOpen, activeConversationId, pendingMessage,
    setActiveConversation, closeChat, startNewChat, clearPendingMessage,
  } = useChat();
  const navigate = useNavigate();
  const pageContext = usePageContext();
  const { data: conversations = [] } = useConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const updateConversation = useUpdateConversation();
  const {
    data: conversationData, refetch, isLoading: messagesLoading, isError: messagesError,
  } = useChatMessages(activeConversationId);
  const {
    streamingText, isStreaming, pendingAction, executingMessageId,
    sendMessage, confirmAction, rejectAction, stopStream,
  } = useChatStream();

  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const messages: ChatMessage[] = conversationData?.messages || [];
  const suggestions = useMemo(
    () => getSuggestions(pageContext.section, pageContext.entityType, pageContext.entityId),
    [pageContext.section, pageContext.entityType, pageContext.entityId],
  );

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeChat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, closeChat]);

  // Clear pending attachments when switching conversations
  useEffect(() => {
    setPendingAttachments([]);
  }, [activeConversationId]);

  // Handle deleted/missing conversation — reset to new chat
  useEffect(() => {
    if (messagesError && activeConversationId) {
      setActiveConversation(null);
    }
  }, [messagesError, activeConversationId, setActiveConversation]);

  // Auto-send pending message when chat opens
  useEffect(() => {
    if (isOpen && pendingMessage && !isStreaming) {
      clearPendingMessage();
      handleSend(pendingMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pendingMessage]);

  // Listen for AI navigation commands
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent).detail;
      if (typeof path === 'string' && path.startsWith('/')) {
        navigate(path);
      }
    };
    window.addEventListener('chat-navigate', handler);
    return () => window.removeEventListener('chat-navigate', handler);
  }, [navigate]);

  // Prevent body scroll on mobile when chat is open
  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // When the stream finishes, refetch to pick up new DB messages
  useEffect(() => {
    if (!isStreaming && activeConversationId) {
      refetch();
    }
  }, [isStreaming, activeConversationId, refetch]);

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (activeConversationId) return activeConversationId;

    const conv = await createConversation.mutateAsync({
      title: 'New Chat',
      pageContext,
    });
    setActiveConversation(conv.id);
    return conv.id;
  }, [activeConversationId, createConversation, pageContext, setActiveConversation]);

  const handleSend = useCallback(async (content: string) => {
    try {
      setLastFailedMessage(null);
      const convId = await ensureConversation();
      await sendMessage(
        convId, content, pageContext,
        pendingAttachments.length ? pendingAttachments : undefined,
      );
      setPendingAttachments([]);
    } catch {
      setLastFailedMessage(content);
      toast.error('Failed to send message. Click retry to try again.');
    }
  }, [ensureConversation, sendMessage, pageContext, pendingAttachments]);

  const handleRetry = useCallback(() => {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage);
    }
  }, [lastFailedMessage, handleSend]);

  const handleConfirm = useCallback(async (messageId: number) => {
    if (!activeConversationId) return;
    try {
      await confirmAction(activeConversationId, messageId);
    } catch {
      toast.error('Failed to execute action');
    }
  }, [activeConversationId, confirmAction]);

  const handleReject = useCallback(async (messageId: number) => {
    if (!activeConversationId) return;
    try {
      await rejectAction(activeConversationId, messageId);
    } catch {
      toast.error('Failed to reject action');
    }
  }, [activeConversationId, rejectAction]);

  const handleUpload = useCallback(async (file: File) => {
    // Client-side size validation
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      return;
    }

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Upload failed (${response.status})`);
      }
      const json = await response.json();
      const attachment = json.data as ChatAttachment;
      setPendingAttachments((prev) => [...prev, attachment]);
      toast.success(`Attached: ${file.name}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload file');
    }
  }, []);

  const handleRenameConversation = useCallback(async (id: number, title: string) => {
    try {
      await updateConversation.mutateAsync({ id, data: { title } });
    } catch {
      toast.error('Failed to rename conversation');
    }
  }, [updateConversation]);

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if leaving the panel entirely
    if (!panelRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length && handleUpload) {
      for (const file of files) {
        handleUpload(file);
      }
    }
  }, [handleUpload]);

  const handleDeleteConversation = useCallback(async (id: number) => {
    try {
      await deleteConversation.mutateAsync(id);
      if (id === activeConversationId) {
        setActiveConversation(null);
      }
    } catch {
      toast.error('Failed to delete conversation');
    }
  }, [deleteConversation, activeConversationId, setActiveConversation]);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={closeChat}
          aria-hidden="true"
        />
      )}

      <div
        ref={panelRef}
        role="complementary"
        aria-label="AI Chat"
        aria-hidden={!isOpen}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'fixed right-0 top-0 z-40 flex h-screen w-full flex-col border-l',
          'bg-background shadow-xl transition-transform duration-300 ease-in-out',
          'lg:w-[420px]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center
            rounded-lg border-2 border-dashed border-primary bg-primary/10">
            <p className="text-sm font-medium text-primary">Drop files here</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <ConversationSwitcher
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={setActiveConversation}
            onNew={startNewChat}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversation}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={closeChat}
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ChatMessageList
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
          isLoading={messagesLoading && !!activeConversationId}
          executingMessageId={executingMessageId}
          suggestions={suggestions}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onSuggestionClick={handleSend}
        />

        {/* Retry bar for failed messages */}
        {lastFailedMessage && !isStreaming && (
          <div className="flex items-center justify-between border-t bg-destructive/10 px-3 py-2">
            <span className="text-xs text-destructive">Message failed to send</span>
            <button
              onClick={handleRetry}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Pending attachments preview */}
        {pendingAttachments.length > 0 && (
          <div className="flex gap-1.5 border-t px-3 py-2">
            {pendingAttachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
              >
                <span className="max-w-[100px] truncate">{att.name}</span>
                <button
                  onClick={() => setPendingAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <ChatInput
          ref={inputRef}
          onSend={handleSend}
          onUpload={handleUpload}
          isStreaming={isStreaming}
          onStop={stopStream}
        />
      </div>
    </>
  );
}
