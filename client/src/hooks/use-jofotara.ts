import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { JofotaraSubmission } from '@vibe/shared';
import { toast } from 'sonner';

export function useJofotaraSubmit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      { invoiceId, paymentMethod, invoiceType }: {
        invoiceId: number;
        paymentMethod: 'cash' | 'receivable';
        invoiceType?: string;
      },
    ) =>
      api.post<JofotaraSubmission>(
        `/jofotara/invoices/${invoiceId}/submit`,
        { paymentMethod, invoiceType },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['invoices', String(variables.invoiceId)],
      });
      queryClient.invalidateQueries({
        queryKey: ['jofotara-submissions', variables.invoiceId],
      });
      toast.success('Invoice submitted to JoFotara successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'JoFotara submission failed');
    },
  });
}

export function useJofotaraCreditSubmit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      { invoiceId, originalInvoiceId, reasonForReturn }: {
        invoiceId: number;
        originalInvoiceId: number;
        reasonForReturn: string;
      },
    ) =>
      api.post<JofotaraSubmission>(
        `/jofotara/invoices/${invoiceId}/credit`,
        { originalInvoiceId, reasonForReturn },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['invoices', String(variables.invoiceId)],
      });
      toast.success('Credit note submitted to JoFotara');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Credit note submission failed');
    },
  });
}

export function useJofotaraValidate() {
  return useMutation({
    mutationFn: (invoiceId: number) =>
      api.post<{
        valid: boolean;
        errors: string[];
      }>(`/jofotara/validate/${invoiceId}`),
  });
}

export function useJofotaraSubmissions(invoiceId: number | undefined) {
  return useQuery({
    queryKey: ['jofotara-submissions', invoiceId],
    queryFn: () =>
      api.get<JofotaraSubmission[]>(
        `/jofotara/invoices/${invoiceId}/submissions`,
      ),
    enabled: !!invoiceId,
  });
}
