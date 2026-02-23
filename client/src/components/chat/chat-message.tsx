import { memo, useCallback, useState, type ReactNode, Children, isValidElement } from 'react';
import Markdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@vibe/shared';
import { AiActionPreviewCard } from './ai-action-preview-card';
import { AiEntityCard } from './ai-entity-card';
import { Check, Copy, CheckCheck, FileSpreadsheet, FileText, X, ArrowRight } from 'lucide-react';

function extractTextFromChildren(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (isValidElement(node)) {
    return extractTextFromChildren((node.props as { children?: ReactNode }).children);
  }
  if (Array.isArray(node)) {
    return Children.toArray(node).map(extractTextFromChildren).join('');
  }
  return '';
}

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamingText?: string;
  isExecuting?: boolean;
  onConfirm?: (messageId: number, overrideArgs?: Record<string, any>) => void;
  onReject?: (messageId: number) => void;
  onSuggestionClick?: (text: string) => void;
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

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center
        rounded-md bg-background/80 text-muted-foreground/60 opacity-0
        transition-all hover:bg-background hover:text-foreground
        group-hover/code:opacity-100"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="mb-2 ms-4 list-disc last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ms-4 list-decimal last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-lg bg-muted p-2.5 text-xs">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
              {children}
            </code>
          );
        },
        pre: ({ children }) => {
          const codeText = extractTextFromChildren(children);
          return (
            <pre className="group/code relative mb-2 last:mb-0">
              {children}
              {codeText && <CodeCopyButton code={codeText} />}
            </pre>
          );
        },
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
  const { t } = useTranslation('chat');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]
        text-muted-foreground/60 transition-all hover:bg-muted hover:text-muted-foreground
        opacity-0 group-hover:opacity-100"
      aria-label={t('copyMessage')}
    >
      {copied ? (
        <><CheckCheck className="h-3 w-3" /> {t('copied')}</>
      ) : (
        <><Copy className="h-3 w-3" /> {t('copy')}</>
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
  onSuggestionClick,
}: ChatMessageProps) {
  const { t } = useTranslation('chat');
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  let content = isStreaming ? streamingText : message.content;

  // Extract dynamic suggestions
  const dynamicSuggestions: string[] = [];
  if (content && !isUser) {
    const regex = /\[SUGGESTION:\s*"?([^"\]]+)"?\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) dynamicSuggestions.push(match[1].trim());
    }
    content = content.replace(regex, '').trim();
  }

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <span className="text-[11px] text-muted-foreground/60">{content}</span>
      </div>
    );
  }

  // Action preview (pending mutation)
  if (message.actionStatus === 'pending' && message.toolCall) {
    return (
      <div className="px-4 py-2">
        {content && (
          <div className="mb-3 text-[13px] leading-relaxed text-foreground">
            <MarkdownContent text={content} />
          </div>
        )}
        <AiActionPreviewCard
          toolCall={message.toolCall}
          onConfirm={(overrideArgs) => onConfirm?.(message.id, overrideArgs)}
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
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-green-600/80">
          <Check className="h-3 w-3" />
          <span>{message.toolResult.summary}</span>
        </div>
        {message.toolResult.data != null ? (
          <AiEntityCard
            data={message.toolResult.data}
            toolName={message.toolResult.name}
            onAction={onSuggestionClick}
          />
        ) : null}
        {content && (
          <div className="mt-3 text-[13px] leading-relaxed text-foreground">
            <MarkdownContent text={content} />
          </div>
        )}
      </div>
    );
  }

  // Rejected action
  if (message.actionStatus === 'rejected') {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <X className="h-3 w-3" />
          <span>
            {t('cancelled')}{message.toolCall ? ` ${message.toolCall.name.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
      </div>
    );
  }

  // Tool result without mutation
  if (!isUser && message.toolResult && !message.content) {
    return (
      <div className="px-4 py-2">
        <AiEntityCard
          data={message.toolResult.data}
          toolName={message.toolResult.name}
          onAction={onSuggestionClick}
        />
      </div>
    );
  }

  // --- Regular messages ---
  return (
    <div className={cn('group px-4 py-1.5', isUser ? 'flex justify-end' : '')}>
      {isUser ? (
        /* User message — right-aligned bubble */
        <div className="max-w-[80%]">
          {/* Attachments */}
          {message.attachments?.length ? (
            <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((att, i) => {
                if (att.mimeType.startsWith('image/') && att.url) {
                  return (
                    <div key={i} className="overflow-hidden rounded-xl">
                      <img
                        src={att.url}
                        alt={att.name}
                        className="max-h-32 max-w-[200px] rounded-xl object-cover"
                        loading="lazy"
                      />
                    </div>
                  );
                }
                const Icon = att.mimeType === 'application/pdf' ? FileText : FileSpreadsheet;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs"
                  >
                    <Icon className="h-3 w-3" />
                    <span className="max-w-[120px] truncate">{att.name}</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
            {content && <p className="whitespace-pre-wrap leading-relaxed">{content}</p>}
          </div>

          {/* Timestamp */}
          {!isStreaming && message.id > 0 && (
            <div className="mt-1 text-end text-[10px] text-muted-foreground/40
              opacity-0 transition-opacity group-hover:opacity-100">
              {formatTime(message.createdAt)}
            </div>
          )}
        </div>
      ) : (
        /* AI message — left-aligned, no bubble */
        <div className="max-w-[90%]">
          {/* Attachments (rare for AI but supported) */}
          {message.attachments?.length ? (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {message.attachments.map((att, i) => {
                if (att.mimeType.startsWith('image/') && att.url) {
                  return (
                    <div key={i} className="overflow-hidden rounded-xl">
                      <img
                        src={att.url}
                        alt={att.name}
                        className="max-h-32 max-w-[200px] rounded-xl object-cover"
                        loading="lazy"
                      />
                    </div>
                  );
                }
                const Icon = att.mimeType === 'application/pdf' ? FileText : FileSpreadsheet;
                return (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs">
                    <Icon className="h-3 w-3" />
                    <span className="max-w-[120px] truncate">{att.name}</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {content ? (
            <div className="text-[13px] leading-relaxed text-foreground">
              <MarkdownContent text={content} />
            </div>
          ) : null}

          {/* Streaming dots */}
          {isStreaming && !content && (
            <div className="flex gap-1 py-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
            </div>
          )}

          {/* Streaming cursor */}
          {isStreaming && content && (
            <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground/40" />
          )}

          {/* Copy + timestamp row */}
          {!isStreaming && content && (
            <div className="mt-1 flex items-center gap-2">
              <CopyButton text={content} />
              {message.id > 0 && (
                <span className="text-[10px] text-muted-foreground/40
                  opacity-0 transition-opacity group-hover:opacity-100">
                  {formatTime(message.createdAt)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dynamic follow-up suggestions */}
      {!isUser && dynamicSuggestions.length > 0 && !isStreaming && (
        <div className="mt-2 flex w-full flex-col gap-1.5 ps-0">
          {dynamicSuggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => onSuggestionClick?.(s)}
              className="group/btn flex w-fit max-w-full items-center gap-2 rounded-xl
                border border-border/60 bg-background px-3 py-1.5 text-start text-xs
                text-muted-foreground transition-all
                hover:border-primary/30 hover:text-foreground"
            >
              <span className="flex-1 truncate whitespace-normal leading-relaxed">{s}</span>
              <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity
                group-hover/btn:opacity-100 text-primary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
