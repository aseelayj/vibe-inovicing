import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { BankTransfer } from '@vibe/shared';
import { toast } from 'sonner';

export function useBankTransfers(page = 1, pageSize = 25) {
  return useQuery({
    queryKey: ['bank-transfers', page, pageSize],
    queryFn: () =>
      api.get<{ data: BankTransfer[]; total: number; page: number; pageSize: number; totalPages: number }>(
        `/bank-transfers?page=${page}&pageSize=${pageSize}`,
      ),
  });
}

export function useBankTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ['bank-transfers', id],
    queryFn: () => api.get<BankTransfer>(`/bank-transfers/${id}`),
    enabled: !!id,
  });
}

export function useCreateBankTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<BankTransfer>('/bank-transfers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transfer created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create transfer');
    },
  });
}

export function useDeleteBankTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/bank-transfers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transfer deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete transfer');
    },
  });
}
