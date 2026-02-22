import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Commitment, CommitmentSummary } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export function useCommitments(activeOnly = false) {
  const path = activeOnly
    ? '/commitments?active=true'
    : '/commitments';
  return useQuery({
    queryKey: ['commitments', { activeOnly }],
    queryFn: () => api.get<Commitment[]>(path),
  });
}

export function useCommitmentSummary() {
  return useQuery({
    queryKey: ['commitments', 'summary'],
    queryFn: () => api.get<CommitmentSummary>('/commitments/summary'),
  });
}

export function useCreateCommitment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Commitment>('/commitments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('commitment') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('createFailed', { entity: i18n.t('commitment') }));
    },
  });
}

export function useUpdateCommitment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Commitment>(`/commitments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('commitment') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('updateFailed', { entity: i18n.t('commitment') }));
    },
  });
}

export function useDeleteCommitment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/commitments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('commitment') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('deleteFailed', { entity: i18n.t('commitment') }));
    },
  });
}
