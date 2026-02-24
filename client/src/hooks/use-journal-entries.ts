import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { JournalEntry, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

interface JournalEntryFilters {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useJournalEntries(filters: JournalEntryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const query = params.toString();
  const path = `/journal-entries${query ? `?${query}` : ''}`;

  return useQuery({
    queryKey: ['journal-entries', filters],
    queryFn: () => api.get<PaginatedResponse<JournalEntry>>(path),
  });
}

export function useJournalEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['journal-entries', id],
    queryFn: () => api.get<JournalEntry>(`/journal-entries/${id}`),
    enabled: !!id,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<JournalEntry>('/journal-entries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(i18n.t('journal-entries:createdSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('journal-entries:createFailed'));
    },
  });
}

export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<JournalEntry>(`/journal-entries/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({
        queryKey: ['journal-entries', String(variables.id)],
      });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(i18n.t('journal-entries:updatedSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('journal-entries:updateFailed'));
    },
  });
}

export function usePostJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post<JournalEntry>(`/journal-entries/${id}/post`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({
        queryKey: ['journal-entries', String(id)],
      });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(i18n.t('journal-entries:postedSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('journal-entries:postFailed'));
    },
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/journal-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(i18n.t('journal-entries:deletedSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('journal-entries:deleteFailed'));
    },
  });
}
