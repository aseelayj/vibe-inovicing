import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Commitment, CommitmentSummary } from '@vibe/shared';
import { toast } from 'sonner';

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
      toast.success('Commitment created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create commitment');
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
      toast.success('Commitment updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update commitment');
    },
  });
}

export function useDeleteCommitment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/commitments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
      toast.success('Commitment deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete commitment');
    },
  });
}
