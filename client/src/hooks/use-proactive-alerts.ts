import { useQuery } from '@tanstack/react-query';

export interface ProactiveAlertsData {
    hasAlerts: boolean;
    message?: string;
}

export function useProactiveAlerts() {
    return useQuery({
        queryKey: ['proactive-alerts'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
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
