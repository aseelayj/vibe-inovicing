import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  DashboardStats,
  RevenueChartData,
  ActivityLogEntry,
} from '@vibe/shared';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
  });
}

export function useRevenueChart() {
  return useQuery({
    queryKey: ['dashboard', 'revenue-chart'],
    queryFn: () => api.get<RevenueChartData[]>('/dashboard/revenue-chart'),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity'],
    queryFn: () => api.get<ActivityLogEntry[]>('/dashboard/recent-activity'),
  });
}
