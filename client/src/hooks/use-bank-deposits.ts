import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { BankDeposit } from '@vibe/shared';
import { toast } from 'sonner';

export function useBankDeposits(page = 1, pageSize = 25, bankAccountId?: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (bankAccountId) params.set('bankAccountId', String(bankAccountId));

  return useQuery({
    queryKey: ['bank-deposits', page, pageSize, bankAccountId],
    queryFn: () =>
      api.get<{ data: BankDeposit[]; total: number; page: number; pageSize: number; totalPages: number }>(
        `/bank-deposits?${params.toString()}`,
      ),
  });
}

export function useBankDeposit(id: string | undefined) {
  return useQuery({
    queryKey: ['bank-deposits', id],
    queryFn: () => api.get<BankDeposit>(`/bank-deposits/${id}`),
    enabled: !!id,
  });
}

export function useCreateBankDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<BankDeposit>('/bank-deposits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Deposit created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create deposit');
    },
  });
}

export function useDeleteBankDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/bank-deposits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Deposit deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete deposit');
    },
  });
}
