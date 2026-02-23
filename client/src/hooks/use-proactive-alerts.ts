import { useQuery } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/api-client';

export interface ProactiveAlertsData {
    hasAlerts: boolean;
    message?: string;
}

export function useProactiveAlerts() {
    return useQuery({
        queryKey: ['proactive-alerts'],
        queryFn: async () => {
            const token = getAuthToken();
            const res = await fetch('/api/chat/proactive-alerts', {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) {
                throw new Error('Failed to fetch alerts');
            }
            const json = await res.json();
            return json.data as ProactiveAlertsData;
        },
        refetchInterval: 5 * 60 * 1000, // background refresh every 5 mins
    });
}
