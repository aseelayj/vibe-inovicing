import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { EmailTemplate } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api.get<EmailTemplate[]>('/email-templates'),
  });
}

export function useEmailTemplate(type: string) {
  return useQuery({
    queryKey: ['email-templates', type],
    queryFn: () => api.get<EmailTemplate>(`/email-templates/${type}`),
    enabled: !!type,
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, data }: {
      type: string;
      data: { subject: string; body: string; headerColor?: string | null };
    }) => api.put<EmailTemplate>(`/email-templates/${type}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success(i18n.t('templateSaved'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('templateSaveFailed'));
    },
  });
}

export function useResetEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: string) =>
      api.post<EmailTemplate>(`/email-templates/${type}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success(i18n.t('templateReset'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('templateResetFailed'));
    },
  });
}

export function usePreviewEmailTemplate() {
  return useMutation({
    mutationFn: ({ type, data }: {
      type: string;
      data?: { subject: string; body: string; headerColor?: string | null };
    }) =>
      api.post<{ html: string; subject: string }>(
        `/email-templates/${type}/preview`,
        data,
      ),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('previewFailed'));
    },
  });
}
