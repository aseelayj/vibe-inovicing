import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

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
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('recurringInvoice') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('createFailed', { entity: i18n.t('recurringInvoice') }));
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
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('recurringInvoice') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('updateFailed', { entity: i18n.t('recurringInvoice') }));
    },
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/recurring/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('recurringInvoice') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('deleteFailed', { entity: i18n.t('recurringInvoice') }));
    },
  });
}

export function useToggleRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.patch(`/recurring/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      toast.success(i18n.t('statusUpdated'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('toggleFailed'));
    },
  });
}
