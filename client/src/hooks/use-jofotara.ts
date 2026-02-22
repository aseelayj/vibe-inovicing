import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { JofotaraSubmission } from '@vibe/shared';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

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
      toast.success(i18n.t('jofotaraSubmitSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('jofotaraSubmitFailed'));
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
      toast.success(i18n.t('creditNoteSubmitted'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('creditNoteSubmitFailed'));
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
