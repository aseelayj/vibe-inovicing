import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.get('/recurring'),
  });
}

export function useRecurringById(id: number) {
  return useQuery({
    queryKey: ['recurring', id],
    queryFn: () => api.get(`/recurring/${id}`),
    enabled: !!id,
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/recurring', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      toast.success('Recurring invoice created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create recurring invoice');
    },
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/recurring/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      toast.success('Recurring invoice updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update recurring invoice');
    },
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/recurring/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      toast.success('Recurring invoice deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete recurring invoice');
    },
  });
}

export function useToggleRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.patch(`/recurring/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      toast.success('Status updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to toggle status');
    },
  });
}
