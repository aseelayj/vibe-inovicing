import { Link } from 'react-router';
import { CreditCard } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { usePayments } from '@/hooks/use-payments';
import { formatCurrency, formatDate } from '@/lib/format';

export function PaymentsPage() {
  const { data, isLoading } = usePayments();

  const payments = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
        <p className="mt-1 text-sm text-gray-500">
          All payment transactions across invoices
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Payments will appear here when you record them against invoices."
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {formatDate(payment.paymentDate)}
                  </TableCell>
                  <TableCell>
                    {payment.invoice ? (
                      <Link
                        to={`/invoices/${payment.invoiceId}`}
                        className="font-medium text-primary-600 hover:text-primary-700"
                      >
                        {payment.invoice.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-gray-400">
                        Invoice #{payment.invoiceId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {payment.paymentMethod
                      ? payment.paymentMethod
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())
                      : '--'}
                  </TableCell>
                  <TableCell>
                    {payment.reference || '--'}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
