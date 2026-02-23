import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Settings } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<Settings>('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(i18n.t('settingsSaved'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('settingsSaveFailed'));
    },
  });
}
