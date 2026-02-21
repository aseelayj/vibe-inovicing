import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { EmailLogEntry } from '@vibe/shared';

export function useEmailLog(params: {
  invoiceId?: number;
  quoteId?: number;
}) {
  const queryParam = params.invoiceId
    ? `invoiceId=${params.invoiceId}`
    : params.quoteId
      ? `quoteId=${params.quoteId}`
      : '';

  return useQuery({
    queryKey: ['email-log', params],
    queryFn: () => api.get<EmailLogEntry[]>(`/email-log?${queryParam}`),
    enabled: !!queryParam,
  });
}
