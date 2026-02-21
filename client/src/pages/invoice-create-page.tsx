import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import type { InvoiceAction } from '@/components/invoices/invoice-form';
import { useCreateInvoice, useSendInvoice } from '@/hooks/use-invoices';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const sendInvoice = useSendInvoice();

  const handleSubmit = async (
    data: Record<string, unknown>,
    action: InvoiceAction,
  ) => {
    try {
      const invoice = await createInvoice.mutateAsync(data);
      if (action === 'publish') {
        try {
          await api.patch(`/invoices/${invoice.id}/status`, { status: 'sent' });
          toast.success('Invoice published');
        } catch {
          toast.error('Invoice saved but failed to publish');
        }
      } else if (action === 'send') {
        try {
          await sendInvoice.mutateAsync(invoice.id);
        } catch {
          // toast already shown by mutation onError
        }
      }
      navigate(`/invoices/${invoice.id}`);
    } catch {
      // create failed - handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/invoices">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">Create Invoice</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Fill in the details to create a new invoice
          </p>
        </div>
      </div>

      <InvoiceForm
        onSubmit={handleSubmit}
        isLoading={createInvoice.isPending || sendInvoice.isPending}
      />
    </div>
  );
}
