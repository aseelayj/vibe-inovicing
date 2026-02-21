import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Invoice, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';

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
      toast.success('Invoice created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create invoice');
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
      toast.success('Invoice updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update invoice');
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete invoice');
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
      toast.success('Invoice duplicated successfully');
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to duplicate invoice');
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
      toast.success('Invoice sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send invoice');
    },
  });
}
