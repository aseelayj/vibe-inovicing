import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api-client';
import type { Client, ClientStatement, PaginatedResponse } from '@vibe/shared';
import { toast } from 'sonner';

export function useClients(search?: string) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  const query = params.toString();
  const path = `/clients${query ? `?${query}` : ''}`;

  return useQuery({
    queryKey: ['clients', { search }],
    queryFn: () => api.get<PaginatedResponse<Client>>(path),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<Client>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Client>('/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create client');
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Client>(`/clients/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({
        queryKey: ['clients', String(variables.id)],
      });
      toast.success('Client updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update client');
    },
  });
}

export function useClientStatement(
  id: string | undefined,
  startDate?: string,
  endDate?: string,
) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();

  return useQuery({
    queryKey: ['clients', id, 'statement', { startDate, endDate }],
    queryFn: () => api.get<ClientStatement>(`/clients/${id}/statement${qs ? `?${qs}` : ''}`),
    enabled: !!id,
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, force }: { id: number; force?: boolean }) =>
      api.delete(`/clients/${id}${force ? '?force=true' : ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted successfully');
    },
    onError: (error: Error) => {
      // Don't toast on 409 — the UI shows a warning dialog instead
      if (error instanceof ApiError && error.status === 409) return;
      toast.error(error.message || 'Failed to delete client');
    },
  });
}
