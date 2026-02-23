import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getAuthToken } from '@/lib/api-client';
import type { Transaction, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

interface TransactionFilters {
  bankAccountId?: number;
  type?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.bankAccountId) params.set('bankAccountId', String(filters.bankAccountId));
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const query = params.toString();
  const path = `/transactions${query ? `?${query}` : ''}`;

  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.get<PaginatedResponse<Transaction>>(path),
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => api.get<Transaction>(`/transactions/${id}`),
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Transaction>('/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('transaction') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('createFailed', { entity: i18n.t('transaction') }));
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Transaction>(`/transactions/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({
        queryKey: ['transactions', String(variables.id)],
      });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('transaction') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('updateFailed', { entity: i18n.t('transaction') }));
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('transaction') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('deleteFailed', { entity: i18n.t('transaction') }));
    },
  });
}

export function useImportTransactions() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Import failed');
      }

      const json = await res.json();
      return json.data ?? json;
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('importFailed', { entity: i18n.t('transaction') }));
    },
  });
}

export function useBatchCreateTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { bankAccountId: number; transactions: Record<string, unknown>[] }) =>
      api.post<Transaction[]>('/transactions/batch', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(i18n.t('importedSuccess', { entity: i18n.t('transaction') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('importFailed', { entity: i18n.t('transaction') }));
    },
  });
}
