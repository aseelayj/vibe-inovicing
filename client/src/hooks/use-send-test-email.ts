import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

export function useSendTestEmail() {
  const { t } = useTranslation('settings');

  return useMutation({
    mutationFn: ({ type, to }: { type: string; to: string }) =>
      api.post(`/email-templates/${type}/send-test`, { to }),
    onSuccess: () => {
      toast.success(t('testEmailSent'));
    },
    onError: (err: Error) => {
      toast.error(err.message || i18n.t('testEmailFailed'));
    },
  });
}
