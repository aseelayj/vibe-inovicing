import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Payment, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';

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
      api.get<Payment[]>(`/invoices/${invoiceId}/payments`),
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
      toast.success('Payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record payment');
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete payment');
    },
  });
}
