import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Quote, Invoice, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';

interface QuoteFilters {
  status?: string;
  search?: string;
  clientId?: number;
  page?: number;
  pageSize?: number;
}

export function useQuotes(filters: QuoteFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.search) params.set('search', filters.search);
  if (filters.clientId) params.set('clientId', String(filters.clientId));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const query = params.toString();
  const path = `/quotes${query ? `?${query}` : ''}`;

  return useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => api.get<PaginatedResponse<Quote>>(path),
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: () => api.get<Quote>(`/quotes/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Quote>('/quotes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create quote');
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Quote>(`/quotes/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({
        queryKey: ['quotes', String(variables.id)],
      });
      toast.success('Quote updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update quote');
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete quote');
    },
  });
}

export function useConvertQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      { id, isTaxable = false }: { id: number; isTaxable?: boolean },
    ) => api.post<Invoice>(`/quotes/${id}/convert`, { isTaxable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Quote converted to invoice successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to convert quote');
    },
  });
}

export function useSendQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.post(`/quotes/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send quote');
    },
  });
}
