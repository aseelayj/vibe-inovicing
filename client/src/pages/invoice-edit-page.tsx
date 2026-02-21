import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { useInvoice, useUpdateInvoice, useSendInvoice } from '@/hooks/use-invoices';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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
    action: 'draft' | 'send',
  ) => {
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, data });
      if (action === 'send') {
        await sendInvoice.mutateAsync(invoice.id);
      }
      navigate(`/invoices/${invoice.id}`);
    } catch {
      // handled by mutation
    }
  };

  const defaultValues = {
    clientId: invoice.clientId,
    issueDate: invoice.issueDate.split('T')[0],
    dueDate: invoice.dueDate.split('T')[0],
    currency: invoice.currency,
    taxRate: invoice.taxRate,
    discountAmount: invoice.discountAmount,
    notes: invoice.notes,
    terms: invoice.terms,
    lineItems: invoice.lineItems?.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })) ?? [],
    clientName: invoice.client?.name,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to={`/invoices/${id}`}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Edit Invoice {invoice.invoiceNumber}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
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
