import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import type { InvoiceAction } from '@/components/invoices/invoice-form';
import {
  useInvoice,
  useUpdateInvoice,
  useSendInvoice,
} from '@/hooks/use-invoices';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export function InvoiceEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id);
  const updateInvoice = useUpdateInvoice();
  const sendInvoice = useSendInvoice();

  if (isLoading) return <LoadingSpinner />;
  if (!invoice) return null;

  const handleSubmit = async (
    data: Record<string, unknown>,
    action: InvoiceAction,
  ) => {
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, data });
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
      // update failed - handled by mutation
    }
  };

  const defaultValues = {
    clientId: invoice.clientId,
    issueDate: invoice.issueDate.split('T')[0],
    dueDate: invoice.dueDate.split('T')[0],
    currency: invoice.currency,
    taxRate: invoice.taxRate,
    discountAmount: invoice.discountAmount,
    isTaxable: invoice.isTaxable,
    notes: invoice.notes,
    terms: invoice.terms,
    lineItems:
      invoice.lineItems?.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) ?? [],
    clientName: invoice.client?.name,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/invoices/${id}`}>
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold sm:text-2xl">
            Edit {invoice.invoiceNumber}
          </h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Update the invoice details below
          </p>
        </div>
      </div>

      <InvoiceForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={updateInvoice.isPending || sendInvoice.isPending}
      />
    </div>
  );
}
