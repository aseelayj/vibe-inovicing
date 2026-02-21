import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Employee } from '@vibe/shared';
import { toast } from 'sonner';

export function useEmployees(params?: {
  search?: string;
  active?: string;
  role?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.active) qs.set('active', params.active);
  if (params?.role) qs.set('role', params.role);
  const query = qs.toString();

  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => api.get<Employee[]>(`/employees${query ? `?${query}` : ''}`),
  });
}

export function useEmployee(id: number | undefined) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => api.get<Employee & { payrollEntries: unknown[] }>(
      `/employees/${id}`,
    ),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Employee>('/employees', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create employee');
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Employee>(`/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update employee');
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete employee');
    },
  });
}
