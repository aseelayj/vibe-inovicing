import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PayrollRun, PayrollEntry } from '@vibe/shared';
import { toast } from 'sonner';

export function usePayrollRuns(params?: {
  year?: number;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.year) qs.set('year', String(params.year));
  if (params?.status && params.status !== 'all') {
    qs.set('status', params.status);
  }
  const query = qs.toString();

  return useQuery({
    queryKey: ['payroll', params],
    queryFn: () => api.get<PayrollRun[]>(
      `/payroll${query ? `?${query}` : ''}`,
    ),
  });
}

export function usePayrollRun(id: number | undefined) {
  return useQuery({
    queryKey: ['payroll', id],
    queryFn: () => api.get<PayrollRun>(`/payroll/${id}`),
    enabled: !!id,
  });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      year: number;
      month: number;
      standardWorkingDays?: number;
      notes?: string;
      duplicateFromRunId?: number;
    }) => api.post<PayrollRun>('/payroll', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Payroll run created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create payroll run');
    },
  });
}

export function useUpdatePayrollEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      entryId,
      data,
    }: {
      runId: number;
      entryId: number;
      data: Record<string, unknown>;
    }) => api.put<PayrollEntry>(
      `/payroll/${runId}/entries/${entryId}`,
      data,
    ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', vars.runId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update entry');
    },
  });
}

export function useFinalizePayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.patch<PayrollRun>(`/payroll/${id}/finalize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Payroll run finalized');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to finalize');
    },
  });
}

export function useReopenPayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      api.patch<PayrollRun>(`/payroll/${id}/reopen`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Payroll run reopened');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reopen');
    },
  });
}

export function useUpdatePayrollPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      entryId,
      data,
    }: {
      runId: number;
      entryId: number;
      data: Record<string, unknown>;
    }) => api.patch<PayrollEntry>(
      `/payroll/${runId}/entries/${entryId}/payment`,
      data,
    ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', vars.runId] });
      toast.success('Payment updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update payment');
    },
  });
}

export function useMarkAllPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, bankAccountId }: { id: number; bankAccountId?: number | null }) =>
      api.patch<PayrollRun>(`/payroll/${id}/mark-all-paid`, { bankAccountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('All entries marked as paid');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark all paid');
    },
  });
}

export function useDeletePayrollRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/payroll/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Payroll run deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete payroll run');
    },
  });
}
