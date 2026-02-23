import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ChatConversation } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<ChatConversation[]>('/chat'),
  });
}

export function useChatMessages(conversationId: number | null) {
  return useQuery({
    queryKey: ['conversations', conversationId],
    queryFn: () => api.get<ChatConversation>(`/chat/${conversationId}`),
    enabled: !!conversationId,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (deleted conversation)
      if (error?.status === 404 || error?.message?.includes('404')) return false;
      return failureCount < 2;
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; pageContext?: unknown }) =>
      api.post<ChatConversation>('/chat', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('conversationCreateFailed'));
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/chat/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('conversationDeleteFailed'));
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch<ChatConversation>(`/chat/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
