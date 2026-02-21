import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import type { ChatMessage as ChatMessageType } from '@vibe/shared';
import { ChatMessage } from './chat-message';
import { ArrowDown } from 'lucide-react';

interface ChatMessageListProps {
  messages: ChatMessageType[];
  streamingText: string;
  isStreaming: boolean;
  isLoading?: boolean;
  executingMessageId?: number | null;
  suggestions?: string[];
  onConfirm: (messageId: number) => void;
  onReject: (messageId: number) => void;
  onSuggestionClick?: (text: string) => void;
}

const SCROLL_THRESHOLD = 120;

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  streamingText,
  isStreaming,
  isLoading,
  executingMessageId,
  suggestions,
  onConfirm,
  onReject,
  onSuggestionClick,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const checkNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    setIsNearBottom(near);
    setShowScrollBtn(!near);
  }, []);

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' });
    }
  }, [messages.length, streamingText, isNearBottom, isStreaming]);

  // Scroll to bottom on new conversation load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    setIsNearBottom(true);
    setShowScrollBtn(false);
  }, [messages.length > 0 && messages[0]?.conversationId]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsNearBottom(true);
    setShowScrollBtn(false);
  }, []);

  // Memoize streaming message objects to avoid re-creating on every render
  const streamingMsg = useMemo<ChatMessageType>(() => ({
    id: -1,
    conversationId: 0,
    role: 'assistant',
    content: streamingText || null,
    toolCall: null,
    toolResult: null,
    actionStatus: null,
    attachments: null,
    createdAt: new Date().toISOString(),
  }), [streamingText]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-y-auto py-3"
      onScroll={checkNearBottom}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="flex h-full items-center justify-center">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && messages.length === 0 && !isStreaming && (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 text-4xl">AI</div>
          <p className="text-sm font-medium">How can I help?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ask me to create invoices, look up clients, check your
            dashboard stats, or manage any part of your business.
          </p>
          {suggestions && suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onSuggestionClick?.(s)}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs
                    text-foreground transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          isExecuting={msg.id === executingMessageId}
          onConfirm={onConfirm}
          onReject={onReject}
        />
      ))}

      {/* Streaming message (not yet saved to DB) */}
      {isStreaming && streamingText && (
        <ChatMessage
          message={streamingMsg}
          isStreaming
          streamingText={streamingText}
        />
      )}

      {/* Thinking indicator when streaming but no text yet */}
      {isStreaming && !streamingText && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
            <span>{executingMessageId ? 'Executing action...' : 'AI is thinking...'}</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full
            border bg-background p-1.5 shadow-md transition-opacity hover:bg-muted"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});
