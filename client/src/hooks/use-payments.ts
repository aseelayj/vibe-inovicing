import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Payment, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get<PaginatedResponse<Payment>>('/payments'),
  });
}

export function useInvoicePayments(invoiceId: number | undefined) {
  return useQuery({
    queryKey: ['payments', 'invoice', invoiceId],
    queryFn: () =>
      api.get<Payment[]>(`/payments/invoice/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Payment>('/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(i18n.t('recordedSuccess', { entity: i18n.t('payment') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('recordFailed', { entity: i18n.t('payment') }));
    },
  });
}

export function useClientCredit(clientId: number | undefined) {
  return useQuery({
    queryKey: ['payments', 'client', clientId, 'credit'],
    queryFn: () =>
      api.get<{ creditBalance: number; overpaidInvoiceCount: number }>(
        `/payments/client/${clientId}/credit`,
      ),
    enabled: !!clientId,
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('payment') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('deleteFailed', { entity: i18n.t('payment') }));
    },
  });
}
