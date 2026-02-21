import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { BankAccount } from '@vibe/shared';
import { toast } from 'sonner';

export function useBankAccounts(activeOnly = false) {
  const path = activeOnly ? '/bank-accounts?active=true' : '/bank-accounts';
  return useQuery({
    queryKey: ['bank-accounts', { activeOnly }],
    queryFn: () => api.get<BankAccount[]>(path),
  });
}

export function useBankAccount(id: string | undefined) {
  return useQuery({
    queryKey: ['bank-accounts', id],
    queryFn: () => api.get<BankAccount & { transactions: unknown[] }>(`/bank-accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<BankAccount>('/bank-accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Bank account created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create bank account');
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<BankAccount>(`/bank-accounts/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({
        queryKey: ['bank-accounts', String(variables.id)],
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Bank account updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update bank account');
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/bank-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Bank account deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete bank account');
    },
  });
}
