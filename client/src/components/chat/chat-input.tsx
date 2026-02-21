import {
  forwardRef, useCallback, useImperativeHandle, useRef, useState,
  type KeyboardEvent,
} from 'react';
import { Send, Paperclip, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSend: (message: string) => void;
  onUpload?: (file: File) => void;
  isStreaming: boolean;
  onStop?: () => void;
  disabled?: boolean;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  function ChatInput({ onSend, onUpload, isStreaming, onStop, disabled }, ref) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Forward ref to the textarea for external focus control
    useImperativeHandle(ref, () => textareaRef.current!);

    const handleSend = useCallback(() => {
      const trimmed = value.trim();
      if (!trimmed || isStreaming || disabled) return;
      onSend(trimmed);
      setValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }, [value, isStreaming, disabled, onSend]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleInput = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onUpload) {
        onUpload(file);
      }
      e.target.value = '';
    };

    // Handle clipboard paste of images
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !onUpload) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onUpload(file);
            return;
          }
        }
      }
    }, [onUpload]);

    return (
      <div className="border-t bg-background p-3">
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.csv,.xlsx,.xls"
            onChange={handleFileChange}
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            placeholder="Ask anything..."
            rows={1}
            maxLength={4000}
            disabled={isStreaming || disabled}
            aria-label="Chat message"
            className="flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2
              text-sm outline-none placeholder:text-muted-foreground
              focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onStop}
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  },
);
