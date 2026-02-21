import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { EmailTemplate } from '@vibe/shared';
import { toast } from 'sonner';

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
      toast.success('Email template saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save template');
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
      toast.success('Template reset to defaults');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reset template');
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
      toast.error(error.message || 'Failed to generate preview');
    },
  });
}
