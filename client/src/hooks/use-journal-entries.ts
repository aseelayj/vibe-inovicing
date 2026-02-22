import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { JournalEntry } from '@vibe/shared';
import { toast } from 'sonner';

export function useJournalEntries(page = 1, pageSize = 25, status?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status && status !== 'all') params.set('status', status);

  return useQuery({
    queryKey: ['journal-entries', page, pageSize, status],
    queryFn: () =>
      api.get<{ data: JournalEntry[]; total: number; page: number; pageSize: number; totalPages: number }>(
        `/journal-entries?${params.toString()}`,
      ),
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
      toast.success('Journal entry created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create journal entry');
    },
  });
}

export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<JournalEntry>(`/journal-entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Journal entry updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update journal entry');
    },
  });
}

export function usePostJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post<JournalEntry>(`/journal-entries/${id}/post`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Journal entry posted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to post journal entry');
    },
  });
}

export function useVoidJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post<JournalEntry>(`/journal-entries/${id}/void`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Journal entry voided');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to void journal entry');
    },
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/journal-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Journal entry deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete journal entry');
    },
  });
}
