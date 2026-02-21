import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { useCreateInvoice, useSendInvoice } from '@/hooks/use-invoices';

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const sendInvoice = useSendInvoice();

  const handleSubmit = async (
    data: Record<string, unknown>,
    action: 'draft' | 'send',
  ) => {
    try {
      const invoice = await createInvoice.mutateAsync(data);
      if (action === 'send') {
        await sendInvoice.mutateAsync(invoice.id);
      }
      navigate(`/invoices/${invoice.id}`);
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/invoices"
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Create Invoice
          </h2>
          <p className="mt-1 text-sm text-gray-500">
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
