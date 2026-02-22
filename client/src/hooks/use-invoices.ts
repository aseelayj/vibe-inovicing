import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Invoice, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

interface InvoiceFilters {
  status?: string;
  search?: string;
  clientId?: number;
  isTaxable?: string;
  page?: number;
  pageSize?: number;
}

export function useInvoices(filters: InvoiceFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.search) params.set('search', filters.search);
  if (filters.clientId) params.set('clientId', String(filters.clientId));
  if (filters.isTaxable) params.set('isTaxable', filters.isTaxable);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const query = params.toString();
  const path = `/invoices${query ? `?${query}` : ''}`;

  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => api.get<PaginatedResponse<Invoice>>(path),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Invoice>('/invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('invoice') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('createFailed', { entity: i18n.t('invoice') }));
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Invoice>(`/invoices/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['invoices', String(variables.id)],
      });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('invoice') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('updateFailed', { entity: i18n.t('invoice') }));
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('invoice') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('deleteFailed', { entity: i18n.t('invoice') }));
    },
  });
}

export function useDuplicateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post<Invoice>(`/invoices/${id}/duplicate`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(i18n.t('duplicatedSuccess', { entity: i18n.t('invoice') }));
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('duplicateFailed', { entity: i18n.t('invoice') }));
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post(`/invoices/${id}/send`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['invoices', String(id)],
      });
      toast.success(i18n.t('sentSuccess', { entity: i18n.t('invoice') }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('sendFailed', { entity: i18n.t('invoice') }));
    },
  });
}

export function useSendReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.post(`/invoices/${id}/remind`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['invoices', String(id)],
      });
      toast.success(i18n.t('reminderSent'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('reminderFailed'));
    },
  });
}
