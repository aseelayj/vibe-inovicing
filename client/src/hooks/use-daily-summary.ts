import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { DailySummary, AiDailySummaryResponse } from '@vibe/shared';

export function useDailySummary(date: string) {
  return useQuery({
    queryKey: ['daily-summary', date],
    queryFn: () => api.get<DailySummary>(`/daily-summary?date=${date}`),
    enabled: !!date,
  });
}

export function useAiDailySummary(date: string, enabled = false) {
  return useQuery({
    queryKey: ['daily-summary', 'ai', date],
    queryFn: () =>
      api.get<AiDailySummaryResponse>(
        `/daily-summary/ai-summary?date=${date}`,
      ),
    enabled: enabled && !!date,
  });
}
