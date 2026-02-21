import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  Send,
  Download,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useInvoice, useDeleteInvoice, useSendInvoice } from '@/hooks/use-invoices';
import { useInvoicePayments, useCreatePayment } from '@/hooks/use-payments';
import { formatCurrency, formatDate } from '@/lib/format';
import { PAYMENT_METHODS } from '@vibe/shared';

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: payments } = useInvoicePayments(invoice?.id);
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const createPayment = useCreatePayment();

  const [showDelete, setShowDelete] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const paymentForm = useForm({
    defaultValues: {
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      reference: '',
      notes: '',
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!invoice) return null;

  const handleDelete = async () => {
    try {
      await deleteInvoice.mutateAsync(invoice.id);
      navigate('/invoices');
    } catch {
      // handled
    }
  };

  const handleSend = async () => {
    await sendInvoice.mutateAsync(invoice.id);
  };

  const handleRecordPayment = async (data: Record<string, unknown>) => {
    try {
      await createPayment.mutateAsync({
        invoiceId: invoice.id,
        ...data,
      });
      setShowPayment(false);
      paymentForm.reset();
    } catch {
      // handled
    }
  };

  const remaining = invoice.total - invoice.amountPaid;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/invoices"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {invoice.invoiceNumber}
              </h2>
              <Badge status={invoice.status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Created {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/invoices/${invoice.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
          {invoice.status === 'draft' && (
            <Button
              size="sm"
              onClick={handleSend}
              loading={sendInvoice.isPending}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              window.open(`/api/v1/invoices/${invoice.id}/pdf`, '_blank')
            }
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          {remaining > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                paymentForm.setValue('amount', remaining);
                setShowPayment(true);
              }}
            >
              <CreditCard className="h-4 w-4" />
              Record Payment
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
                  Bill To
                </p>
                <p className="mt-1 font-medium text-gray-900">
                  {invoice.client?.name || 'No client'}
                </p>
                {invoice.client?.email && (
                  <p className="text-sm text-gray-500">
                    {invoice.client.email}
                  </p>
                )}
                {invoice.client?.company && (
                  <p className="text-sm text-gray-500">
                    {invoice.client.company}
                  </p>
                )}
              </div>
              <div className="space-y-3 text-right">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Issue Date
                  </p>
                  <p className="text-sm text-gray-700">
                    {formatDate(invoice.issueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Due Date
                  </p>
                  <p className="text-sm text-gray-700">
                    {formatDate(invoice.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Currency
                  </p>
                  <p className="text-sm text-gray-700">{invoice.currency}</p>
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
                {invoice.lineItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice, invoice.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount, invoice.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Tax ({invoice.taxRate}%)
                    </span>
                    <span>
                      {formatCurrency(invoice.taxAmount, invoice.currency)}
                    </span>
                  </div>
                )}
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-red-600">
                      -{formatCurrency(invoice.discountAmount, invoice.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                </div>
                {invoice.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Paid</span>
                      <span>
                        -{formatCurrency(invoice.amountPaid, invoice.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-primary-600">
                      <span>Balance Due</span>
                      <span>{formatCurrency(remaining, invoice.currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>

          {(invoice.notes || invoice.terms) && (
            <Card>
              {invoice.notes && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Terms & Conditions
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                    {invoice.terms}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Payment History">
            {!payments?.length ? (
              <p className="py-4 text-center text-sm text-gray-400">
                No payments recorded
              </p>
            ) : (
              <ul className="space-y-3">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(payment.amount, invoice.currency)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(payment.paymentDate)}
                        {payment.paymentMethod &&
                          ` via ${payment.paymentMethod.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                    {payment.reference && (
                      <span className="text-xs text-gray-400">
                        Ref: {payment.reference}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteInvoice.isPending}
      />

      <Modal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        title="Record Payment"
      >
        <form
          onSubmit={paymentForm.handleSubmit(handleRecordPayment)}
          className="space-y-4"
        >
          <Input
            label="Amount"
            type="number"
            min="0.01"
            step="0.01"
            {...paymentForm.register('amount', { valueAsNumber: true })}
          />
          <Input
            label="Payment Date"
            type="date"
            {...paymentForm.register('paymentDate')}
          />
          <Select
            label="Payment Method"
            {...paymentForm.register('paymentMethod')}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </Select>
          <Input
            label="Reference"
            placeholder="Transaction ID, check number, etc."
            {...paymentForm.register('reference')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPayment(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={createPayment.isPending}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
