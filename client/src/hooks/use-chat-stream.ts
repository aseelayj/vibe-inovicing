import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatToolCall, ChatAttachment } from '@vibe/shared';

interface StreamState {
  streamingText: string;
  isStreaming: boolean;
  executingMessageId: number | null;
  pendingAction: {
    messageId: number;
    toolCall: ChatToolCall;
    summary: string;
  } | null;
}

// Track whether mutations happened during a stream to avoid broad invalidation
let hadMutationInStream = false;

export function useChatStream() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamState>({
    streamingText: '',
    isStreaming: false,
    executingMessageId: null,
    pendingAction: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0); // Generation counter for race condition protection

  const invalidateAfterStream = useCallback((conversationId: number) => {
    queryClient.invalidateQueries({
      queryKey: ['conversations', conversationId],
    });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });

    // Only invalidate entity caches when mutations actually happened
    if (hadMutationInStream) {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  }, [queryClient]);

  const parseSSE = useCallback(
    async (
      response: Response,
      gen: number,
      onDone?: () => void,
    ) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      const SSE_TIMEOUT = 60_000; // 60s inactivity timeout
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const resetTimeout = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {
          reader.cancel();
        }, SSE_TIMEOUT);
      };

      try {
        resetTimeout();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetTimeout();
          // Stale generation — discard
          if (gen !== genRef.current) {
            reader.cancel();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          for (const line of lines) {
            // Skip keepalive comments
            if (line.startsWith(':')) continue;

            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                switch (eventType) {
                  case 'text_delta':
                    setState((prev) => ({
                      ...prev,
                      streamingText: prev.streamingText + parsed.text,
                    }));
                    break;
                  case 'tool_result':
                    // Check for navigation commands
                    if (parsed.data?.navigate) {
                      window.dispatchEvent(
                        new CustomEvent('chat-navigate', { detail: parsed.data.navigate }),
                      );
                    }
                    break;
                  case 'action_proposal':
                    hadMutationInStream = true;
                    setState((prev) => ({
                      ...prev,
                      pendingAction: {
                        messageId: parsed.messageId,
                        toolCall: parsed.toolCall,
                        summary: parsed.summary,
                      },
                    }));
                    break;
                  case 'done':
                    break;
                  case 'error':
                    console.error('SSE error:', parsed.message);
                    break;
                }
              } catch {
                // ignore parse errors for incomplete JSON
              }
              // Reset event type after processing data
              eventType = '';
            }
          }
        }
      } finally {
        clearTimeout(timeoutHandle);
        reader.releaseLock();
        // Only update state if this is still the current generation
        if (gen === genRef.current) {
          setState((prev) => ({ ...prev, isStreaming: false, executingMessageId: null }));
          onDone?.();
        }
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      conversationId: number,
      content: string,
      pageContext?: unknown,
      attachments?: ChatAttachment[],
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const gen = ++genRef.current;
      hadMutationInStream = false;

      setState({
        streamingText: '',
        isStreaming: true,
        executingMessageId: null,
        pendingAction: null,
      });

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `/api/chat/${conversationId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ content, pageContext, attachments }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          if (gen === genRef.current) {
            setState((prev) => ({ ...prev, isStreaming: false }));
          }
          throw new Error('Failed to send message');
        }

        await parseSSE(response, gen, () => {
          invalidateAfterStream(conversationId);
        });
      } catch (err) {
        // Don't throw on intentional abort (user pressed stop)
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        throw err;
      }
    },
    [parseSSE, invalidateAfterStream],
  );

  const confirmAction = useCallback(
    async (conversationId: number, messageId: number, overrideArgs?: Record<string, any>) => {
      const gen = ++genRef.current;
      hadMutationInStream = true;

      setState((prev) => ({
        ...prev,
        streamingText: '',
        isStreaming: true,
        executingMessageId: messageId,
        pendingAction: null,
      }));

      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/chat/${conversationId}/confirm/${messageId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: overrideArgs ? JSON.stringify({ args: overrideArgs }) : undefined,
        },
      );

      if (!response.ok) {
        if (gen === genRef.current) {
          setState((prev) => ({ ...prev, isStreaming: false }));
        }
        throw new Error('Failed to confirm action');
      }

      await parseSSE(response, gen, () => {
        invalidateAfterStream(conversationId);
      });
    },
    [parseSSE, invalidateAfterStream],
  );

  const rejectAction = useCallback(
    async (conversationId: number, messageId: number) => {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/chat/${conversationId}/reject/${messageId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!response.ok) {
        throw new Error('Failed to reject action');
      }
      setState((prev) => ({ ...prev, pendingAction: null }));
      queryClient.invalidateQueries({
        queryKey: ['conversations', conversationId],
      });
    },
    [queryClient],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    genRef.current++; // Increment so stale parseSSE callbacks are ignored
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  return {
    ...state,
    sendMessage,
    confirmAction,
    rejectAction,
    stopStream,
  };
}
