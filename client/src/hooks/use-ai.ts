import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  AiGenerateInvoiceResponse,
  AiDraftEmailResponse,
  LineItemInput,
} from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

export function useGenerateInvoice() {
  return useMutation({
    mutationFn: (prompt: string) =>
      api.post<AiGenerateInvoiceResponse>('/ai/generate-invoice', { prompt }),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('aiGenerationFailed'));
    },
  });
}

export function useSuggestLineItems() {
  return useMutation({
    mutationFn: (data: { clientId: number; partialDescription?: string }) =>
      api.post<LineItemInput[]>('/ai/suggest-line-items', data),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('aiSuggestionsFailed'));
    },
  });
}

export function useDraftEmail() {
  return useMutation({
    mutationFn: (data: {
      invoiceId?: number;
      quoteId?: number;
      context: 'send' | 'reminder' | 'followup';
    }) => api.post<AiDraftEmailResponse>('/ai/draft-email', data),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('aiDraftFailed'));
    },
  });
}

export function useSummarizeDashboard() {
  return useMutation({
    mutationFn: () =>
      api.post<{ summary: string }>('/ai/summarize-dashboard'),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('aiSummaryFailed'));
    },
  });
}

export function useAiSearch() {
  return useMutation({
    mutationFn: (query: string) =>
      api.post<{ results: string }>('/ai/search', { query }),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('aiSearchFailed'));
    },
  });
}
