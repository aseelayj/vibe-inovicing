import { memo, useCallback, useState } from 'react';
import Markdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@vibe/shared';
import { AiActionPreviewCard } from './ai-action-preview-card';
import { AiEntityCard } from './ai-entity-card';
import {
  Check, X, FileText, ImageIcon, FileSpreadsheet, Copy, CheckCheck,
} from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamingText?: string;
  isExecuting?: boolean;
  onConfirm?: (messageId: number) => void;
  onReject?: (messageId: number) => void;
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded bg-background/50 p-2 text-xs">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
        h1: ({ children }) => <p className="mb-1 font-bold">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-bold">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </Markdown>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground
        opacity-0 transition-opacity group-hover:opacity-100"
      aria-label="Copy message"
    >
      {copied ? (
        <><CheckCheck className="h-3 w-3" /> Copied</>
      ) : (
        <><Copy className="h-3 w-3" /> Copy</>
      )}
    </button>
  );
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming,
  streamingText,
  isExecuting,
  onConfirm,
  onReject,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const content = isStreaming ? streamingText : message.content;

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <span className="text-xs text-muted-foreground">{content}</span>
      </div>
    );
  }

  // Action preview (pending mutation)
  if (message.actionStatus === 'pending' && message.toolCall) {
    return (
      <div className="px-4 py-2">
        {content && (
          <div className="mb-2 text-sm text-foreground">
            <MarkdownContent text={content} />
          </div>
        )}
        <AiActionPreviewCard
          toolCall={message.toolCall}
          onConfirm={() => onConfirm?.(message.id)}
          onReject={() => onReject?.(message.id)}
          isExecuting={isExecuting}
        />
      </div>
    );
  }

  // Executed action
  if (message.actionStatus === 'executed' && message.toolResult) {
    return (
      <div className="group px-4 py-2">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-green-600">
          <Check className="h-3 w-3" />
          <span>{message.toolResult.summary}</span>
        </div>
        {message.toolResult.data != null ? (
          <AiEntityCard data={message.toolResult.data} toolName={message.toolResult.name} />
        ) : null}
        {content && (
          <div className="mt-2 text-sm text-foreground">
            <MarkdownContent text={content} />
          </div>
        )}
      </div>
    );
  }

  // Rejected action — show what was cancelled
  if (message.actionStatus === 'rejected') {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <X className="h-3 w-3" />
          <span>
            Action cancelled
            {message.toolCall ? `: ${message.toolCall.name.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
      </div>
    );
  }

  // Tool result without mutation (read-only results are folded into assistant text)
  if (!isUser && message.toolResult && !message.content) {
    return (
      <div className="px-4 py-2">
        <AiEntityCard data={message.toolResult.data} toolName={message.toolResult.name} />
      </div>
    );
  }

  return (
    <div className={cn('group flex px-4 py-2', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {/* Attachments */}
        {message.attachments?.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.attachments.map((att, i) => {
              const isImage = att.mimeType.startsWith('image/');
              const isPdf = att.mimeType === 'application/pdf';

              // Show thumbnail for images
              if (isImage && att.url) {
                return (
                  <div key={i} className="overflow-hidden rounded">
                    <img
                      src={att.url}
                      alt={att.name}
                      className="max-h-32 max-w-[200px] rounded object-cover"
                      loading="lazy"
                    />
                  </div>
                );
              }

              const Icon = isPdf ? FileText : FileSpreadsheet;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-1 rounded px-2 py-1 text-xs',
                    isUser ? 'bg-primary-foreground/20' : 'bg-background',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="max-w-[120px] truncate">{att.name}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {content ? (
          isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownContent text={content} />
          )
        ) : null}

        {isStreaming && !content && (
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
          </div>
        )}

        {isStreaming && content && (
          <span className="inline-block h-4 w-0.5 animate-pulse bg-current" />
        )}
      </div>

      {/* Timestamp + copy on hover */}
      {!isStreaming && content && !isUser && (
        <div className="ml-1 flex flex-col items-start self-end">
          <CopyButton text={content} />
        </div>
      )}

      {/* Timestamp for user messages */}
      {!isStreaming && message.id > 0 && (
        <div className={cn(
          'self-end text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100',
          isUser ? 'mr-1 order-first' : 'ml-1',
        )}>
          {formatTime(message.createdAt)}
        </div>
      )}
    </div>
  );
});
