import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  SalesTaxReport,
  PurchasesReport,
  GstReturnSummary,
  AnnualIncomeTaxReport,
  ProfitLossReport,
  TaxDeadline,
} from '@vibe/shared';

interface PeriodParams {
  year?: number;
  period?: number;
}

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

function buildPeriodQuery(params: PeriodParams) {
  const qs = new URLSearchParams();
  if (params.year != null) qs.set('year', String(params.year));
  if (params.period != null) qs.set('period', String(params.period));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function useSalesTaxReport(params: PeriodParams = {}) {
  return useQuery({
    queryKey: ['reports', 'sales-tax', params],
    queryFn: () =>
      api.get<SalesTaxReport>(`/reports/sales-tax${buildPeriodQuery(params)}`),
  });
}

export function usePurchasesReport(params: PeriodParams = {}) {
  return useQuery({
    queryKey: ['reports', 'purchases', params],
    queryFn: () =>
      api.get<PurchasesReport>(`/reports/purchases${buildPeriodQuery(params)}`),
  });
}

export function useGstSummary(params: PeriodParams = {}) {
  return useQuery({
    queryKey: ['reports', 'gst-summary', params],
    queryFn: () =>
      api.get<GstReturnSummary>(
        `/reports/gst-summary${buildPeriodQuery(params)}`,
      ),
  });
}

export function useIncomeTaxReport(year?: number) {
  const qs = year ? `?year=${year}` : '';
  return useQuery({
    queryKey: ['reports', 'income-tax', year],
    queryFn: () =>
      api.get<AnnualIncomeTaxReport>(`/reports/income-tax${qs}`),
  });
}

export function useProfitLossReport(params: DateRangeParams = {}) {
  const qs = new URLSearchParams();
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  const s = qs.toString();
  return useQuery({
    queryKey: ['reports', 'profit-loss', params],
    queryFn: () =>
      api.get<ProfitLossReport>(`/reports/profit-loss${s ? `?${s}` : ''}`),
  });
}

export function useTaxDeadlines() {
  return useQuery({
    queryKey: ['reports', 'tax-deadlines'],
    queryFn: () => api.get<TaxDeadline[]>('/reports/tax-deadlines'),
  });
}

export function useExportReport() {
  return async (
    type: string,
    params: Record<string, string | number> = {},
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null) qs.set(k, String(v));
    }
    const s = qs.toString();
    const url = `/api/reports/export/${type}${s ? `?${s}` : ''}`;

    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type}-report.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
}
