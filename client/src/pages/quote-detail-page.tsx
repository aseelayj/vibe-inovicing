import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  Send,
  Trash2,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  useQuote,
  useDeleteQuote,
  useConvertQuote,
} from '@/hooks/use-quotes';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

export function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);
  const deleteQuote = useDeleteQuote();
  const convertQuote = useConvertQuote();

  const [showDelete, setShowDelete] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!quote) return null;

  const handleDelete = async () => {
    try {
      await deleteQuote.mutateAsync(quote.id);
      navigate('/quotes');
    } catch {
      // handled
    }
  };

  const handleConvert = async () => {
    try {
      const invoice = await convertQuote.mutateAsync(quote.id);
      toast.success('Quote converted to invoice');
      navigate(`/invoices/${invoice.id}`);
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/quotes"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {quote.quoteNumber}
              </h2>
              <Badge status={quote.status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Created {formatDate(quote.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/quotes/${quote.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
          {quote.status === 'draft' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                window.open(`/api/v1/quotes/${quote.id}/send`, '_blank')
              }
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          )}
          {(quote.status === 'accepted' || quote.status === 'sent') &&
            !quote.convertedInvoiceId && (
              <Button size="sm" onClick={() => setShowConvert(true)}>
                <FileText className="h-4 w-4" />
                Convert to Invoice
              </Button>
            )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Client
                </p>
                <p className="mt-1 font-medium text-gray-900">
                  {quote.client?.name || 'No client'}
                </p>
                {quote.client?.email && (
                  <p className="text-sm text-gray-500">
                    {quote.client.email}
                  </p>
                )}
                {quote.client?.company && (
                  <p className="text-sm text-gray-500">
                    {quote.client.company}
                  </p>
                )}
              </div>
              <div className="space-y-3 text-right">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Issue Date
                  </p>
                  <p className="text-sm text-gray-700">
                    {formatDate(quote.issueDate)}
                  </p>
                </div>
                {quote.expiryDate && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Expiry Date
                    </p>
                    <p className="text-sm text-gray-700">
                      {formatDate(quote.expiryDate)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Currency
                  </p>
                  <p className="text-sm text-gray-700">{quote.currency}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Line Items">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.lineItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice, quote.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount, quote.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>
                    {formatCurrency(quote.subtotal, quote.currency)}
                  </span>
                </div>
                {quote.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Tax ({quote.taxRate}%)
                    </span>
                    <span>
                      {formatCurrency(quote.taxAmount, quote.currency)}
                    </span>
                  </div>
                )}
                {quote.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-red-600">
                      -{formatCurrency(quote.discountAmount, quote.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                  <span>Total</span>
                  <span>
                    {formatCurrency(quote.total, quote.currency)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {(quote.notes || quote.terms) && (
            <Card>
              {quote.notes && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                    {quote.notes}
                  </p>
                </div>
              )}
              {quote.terms && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Terms & Conditions
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                    {quote.terms}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        <div>
          {quote.convertedInvoiceId && (
            <Card title="Converted Invoice">
              <Link
                to={`/invoices/${quote.convertedInvoiceId}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                <FileText className="h-4 w-4" />
                View Invoice
              </Link>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Quote"
        message="Are you sure you want to delete this quote? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteQuote.isPending}
      />

      <ConfirmDialog
        isOpen={showConvert}
        onClose={() => setShowConvert(false)}
        onConfirm={handleConvert}
        title="Convert to Invoice"
        message="This will create a new invoice from this quote. The quote status will be updated to 'converted'."
        confirmText="Convert"
        variant="primary"
        loading={convertQuote.isPending}
      />
    </div>
  );
}
