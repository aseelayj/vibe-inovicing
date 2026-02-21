import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import type { ChatMessage as ChatMessageType } from '@vibe/shared';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from './chat-message';
import { ArrowDown, Sparkles } from 'lucide-react';

interface ChatMessageListProps {
  messages: ChatMessageType[];
  streamingText: string;
  isStreaming: boolean;
  isLoading?: boolean;
  executingMessageId?: number | null;
  suggestions?: string[];
  onConfirm: (messageId: number, overrideArgs?: Record<string, any>) => void;
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
  const { t } = useTranslation('chat');
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

  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' });
    }
  }, [messages.length, streamingText, isNearBottom, isStreaming]);

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
      className="relative flex-1 overflow-y-auto"
      onScroll={checkNearBottom}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="flex h-full items-center justify-center">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/30 [animation-delay:300ms]" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && messages.length === 0 && !isStreaming && (
        <div className="flex h-full flex-col items-center justify-center px-8">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('howCanIHelp')}</p>
          <p className="mt-1.5 text-center text-xs leading-relaxed text-muted-foreground/70">
            {t('emptyStateDescription')}
          </p>
          {suggestions && suggestions.length > 0 && (
            <div className="mt-5 flex w-full max-w-[300px] flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onSuggestionClick?.(s)}
                  className="rounded-xl border border-border/60 bg-background px-3.5 py-2
                    text-left text-xs text-muted-foreground transition-all
                    hover:border-primary/30 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="py-3">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isExecuting={msg.id === executingMessageId}
            onConfirm={onConfirm}
            onReject={onReject}
            onSuggestionClick={onSuggestionClick}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingText && (
          <ChatMessage
            message={streamingMsg}
            isStreaming
            streamingText={streamingText}
            onSuggestionClick={onSuggestionClick}
          />
        )}

        {/* Thinking indicator */}
        {isStreaming && !streamingText && (
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
              <span>{executingMessageId ? t('executing') : t('thinking')}</span>
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} />

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full
            border bg-background/90 p-1.5 shadow-sm backdrop-blur-sm
            transition-all hover:bg-muted"
          aria-label={t('scrollToBottom')}
        >
          <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
});
