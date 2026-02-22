import {
  forwardRef, useCallback, useImperativeHandle, useRef, useState,
  type KeyboardEvent,
} from 'react';
import { ArrowUp, Paperclip, Square, Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getAuthToken } from '@/lib/api-client';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { VoiceRecorder } from './voice-recorder';

interface ChatInputProps {
  onSend: (message: string) => void;
  onUpload?: (file: File) => void;
  isStreaming: boolean;
  onStop?: () => void;
  disabled?: boolean;
  variant?: 'sidebar' | 'fullscreen';
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  function ChatInput({ onSend, onUpload, isStreaming, onStop, disabled, variant = 'sidebar' }, ref) {
    const { t } = useTranslation('chat');
    const [value, setValue] = useState('');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const {
      isRecording, duration, analyserRef, audioLevelsRef,
      startRecording, stopRecording, cancelRecording,
    } = useAudioRecorder();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const maxHeight = variant === 'fullscreen' ? 320 : 160;

    const handleInput = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onUpload) {
        onUpload(file);
      }
      e.target.value = '';
    };

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

    const handleStartRecording = useCallback(async () => {
      try {
        await startRecording();
      } catch {
        toast.error('Could not access microphone');
      }
    }, [startRecording]);

    const handleCancelRecording = useCallback(() => {
      cancelRecording();
    }, [cancelRecording]);

    const handleSendRecording = useCallback(async () => {
      try {
        setIsTranscribing(true);
        const audioBlob = await stopRecording();

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const token = getAuthToken();
        const res = await fetch('/api/chat/transcribe', {
          method: 'POST',
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error('Transcription failed');
        const data = await res.json();

        if (data?.data?.text) {
          onSend(data.data.text);
        }
      } catch (err) {
        console.error('Failed to transcribe audio:', err);
        toast.error('Failed to transcribe audio.');
      } finally {
        setIsTranscribing(false);
      }
    }, [stopRecording, onSend]);

    const canSend = value.trim().length > 0 && !isStreaming && !disabled;

    const isFullscreen = variant === 'fullscreen';

    return (
      <div className={cn('px-3 pb-3 pt-1', isFullscreen && 'px-4 pb-4 pt-2')}>
        <div
          className={cn(
            'relative rounded-2xl border bg-muted/40 transition-colors',
            'focus-within:border-ring focus-within:bg-muted/60',
            isRecording && 'border-destructive/50 bg-destructive/5',
          )}
        >
          {isRecording || isTranscribing ? (
            <VoiceRecorder
              duration={duration}
              analyserRef={analyserRef}
              audioLevelsRef={audioLevelsRef}
              isTranscribing={isTranscribing}
              onCancel={handleCancelRecording}
              onSend={handleSendRecording}
            />
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                onPaste={handlePaste}
                placeholder={t('askAnything')}
                rows={1}
                maxLength={4000}
                disabled={isStreaming || disabled}
                aria-label={t('chatMessage')}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-10 text-sm
                  outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />

              {/* Bottom toolbar inside the container */}
              <div className="absolute bottom-1.5 start-1.5 end-1.5 flex items-center justify-between">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                    aria-label={t('attachFile')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg
                      text-muted-foreground/70 transition-colors
                      hover:bg-background hover:text-foreground
                      disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.csv,.xlsx,.xls"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={isStreaming || disabled}
                    aria-label={t('voiceInput')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg
                      text-muted-foreground/70 transition-colors
                      hover:bg-background hover:text-foreground
                      disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </div>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStop}
                    aria-label={t('stopGenerating')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg
                      bg-foreground text-background transition-opacity hover:opacity-80"
                  >
                    <Square className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    aria-label={t('sendMessage')}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                      canSend
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'bg-muted-foreground/20 text-muted-foreground/40',
                    )}
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {isFullscreen && (
          <p className="mt-1 text-center text-[10px] text-muted-foreground/40">
            {t('shiftEnterHint')}
          </p>
        )}
      </div>
    );
  },
);
