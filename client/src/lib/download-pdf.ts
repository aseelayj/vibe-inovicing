import { getAuthToken } from '@/lib/api-client';
import { toast } from 'sonner';

export async function downloadInvoicePdf(
  invoiceId: number,
  filename: string,
) {
  try {
    const token = getAuthToken();
    const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to download PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Failed to download PDF');
  }
}
