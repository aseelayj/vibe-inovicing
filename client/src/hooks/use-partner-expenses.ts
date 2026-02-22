import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  PartnerExpenseCategory,
  PartnerExpense,
  PartnerPayment,
  PartnerEmployee,
  PartnerSskEntry,
  PartnerBalanceSummary,
  PaginatedResponse,
} from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

// ===================== Categories =====================

export function usePartnerCategories() {
  return useQuery({
    queryKey: ['partner-categories'],
    queryFn: () => api.get<PartnerExpenseCategory[]>(
      '/partner-expenses/categories',
    ),
  });
}

export function useCreatePartnerCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PartnerExpenseCategory>) =>
      api.post<PartnerExpenseCategory>('/partner-expenses/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-categories'] });
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('category') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('createFailed', { entity: i18n.t('category') })),
  });
}

export function useUpdatePartnerCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<PartnerExpenseCategory> & { id: number }) =>
      api.put<PartnerExpenseCategory>(
        `/partner-expenses/categories/${id}`, data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-categories'] });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('category') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('updateFailed', { entity: i18n.t('category') })),
  });
}

export function useDeletePartnerCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/partner-expenses/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-categories'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('category') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('deleteFailed', { entity: i18n.t('category') })),
  });
}

export function useSeedPartnerCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<PartnerExpenseCategory[]>('/partner-expenses/categories/seed'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-categories'] });
      toast.success(i18n.t('seedSuccess'));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('seedFailed')),
  });
}

// ===================== Expenses =====================

export function usePartnerExpenses(params?: {
  categoryId?: number;
  year?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.categoryId) qs.set('categoryId', String(params.categoryId));
  if (params?.year) qs.set('year', String(params.year));
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  if (params?.search) qs.set('search', params.search);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();

  return useQuery({
    queryKey: ['partner-expenses', params],
    queryFn: () => api.get<PaginatedResponse<PartnerExpense>>(
      `/partner-expenses/expenses${query ? `?${query}` : ''}`,
    ),
  });
}

export function useCreatePartnerExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<PartnerExpense>('/partner-expenses/expenses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-expenses'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('expense') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('createFailed', { entity: i18n.t('expense') })),
  });
}

export function useUpdatePartnerExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: number }) =>
      api.put<PartnerExpense>(`/partner-expenses/expenses/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-expenses'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('expense') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('updateFailed', { entity: i18n.t('expense') })),
  });
}

export function useDeletePartnerExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/partner-expenses/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-expenses'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('expense') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('deleteFailed', { entity: i18n.t('expense') })),
  });
}

// ===================== Payments =====================

export function usePartnerPayments(params?: {
  year?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.year) qs.set('year', String(params.year));
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();

  return useQuery({
    queryKey: ['partner-payments', params],
    queryFn: () => api.get<PaginatedResponse<PartnerPayment>>(
      `/partner-expenses/payments${query ? `?${query}` : ''}`,
    ),
  });
}

export function useCreatePartnerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<PartnerPayment>('/partner-expenses/payments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-payments'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('recordedSuccess', { entity: i18n.t('payment') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('recordFailed', { entity: i18n.t('payment') })),
  });
}

export function useUpdatePartnerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: number }) =>
      api.put<PartnerPayment>(`/partner-expenses/payments/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-payments'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('paymentUpdated'));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('paymentUpdateFailed')),
  });
}

export function useDeletePartnerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/partner-expenses/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-payments'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('payment') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('deleteFailed', { entity: i18n.t('payment') })),
  });
}

// ===================== Partner Employees =====================

export function usePartnerEmployees() {
  return useQuery({
    queryKey: ['partner-employees'],
    queryFn: () => api.get<PartnerEmployee[]>(
      '/partner-expenses/employees',
    ),
  });
}

export function useCreatePartnerEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<PartnerEmployee>('/partner-expenses/employees', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-employees'] });
      toast.success(i18n.t('createdSuccess', { entity: i18n.t('employee') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('createFailed', { entity: i18n.t('employee') })),
  });
}

export function useUpdatePartnerEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: number }) =>
      api.put<PartnerEmployee>(`/partner-expenses/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-employees'] });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('employee') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('updateFailed', { entity: i18n.t('employee') })),
  });
}

export function useDeletePartnerEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/partner-expenses/employees/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-employees'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('employee') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('deleteFailed', { entity: i18n.t('employee') })),
  });
}

// ===================== SSK =====================

export function usePartnerSskEntries(year?: number) {
  const qs = year ? `?year=${year}` : '';
  return useQuery({
    queryKey: ['partner-ssk', year],
    queryFn: () => api.get<PartnerSskEntry[]>(
      `/partner-expenses/ssk${qs}`,
    ),
  });
}

export function useGeneratePartnerSsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { year: number; month: number }) =>
      api.post<PartnerSskEntry>('/partner-expenses/ssk/generate', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-ssk'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('sskGenerated'));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('sskGenerateFailed')),
  });
}

export function useUpdatePartnerSsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api.put<PartnerSskEntry>(`/partner-expenses/ssk/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-ssk'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('updatedSuccess', { entity: i18n.t('sskEntry') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('updateFailed', { entity: i18n.t('sskEntry') })),
  });
}

export function useDeletePartnerSsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/partner-expenses/ssk/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner-ssk'] });
      qc.invalidateQueries({ queryKey: ['partner-summary'] });
      toast.success(i18n.t('deletedSuccess', { entity: i18n.t('sskEntry') }));
    },
    onError: (e: Error) => toast.error(e.message || i18n.t('deleteFailed', { entity: i18n.t('sskEntry') })),
  });
}

// ===================== Summary =====================

export function usePartnerSummary(params?: { year?: number }) {
  const qs = params?.year ? `?year=${params.year}` : '';
  return useQuery({
    queryKey: ['partner-summary', params],
    queryFn: () => api.get<PartnerBalanceSummary>(
      `/partner-expenses/summary${qs}`,
    ),
  });
}
