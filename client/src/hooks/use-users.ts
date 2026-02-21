import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { User } from '@vibe/shared';
import { toast } from 'sonner';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      password: string;
      role?: string;
    }) => api.post<User>('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Team member added');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add team member');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: {
      id: number;
      data: Record<string, unknown>;
    }) => api.put<User>(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Team member updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update team member');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Team member deactivated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to deactivate team member');
    },
  });
}
