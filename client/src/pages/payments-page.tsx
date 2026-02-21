import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  CreditCard,
  MoreHorizontal,
  Eye,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePayments, useDeletePayment } from '@/hooks/use-payments';
import { formatCurrency, formatDate } from '@/lib/format';

export function PaymentsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = usePayments();
  const deletePayment = useDeletePayment();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const payments = (Array.isArray(data) ? data : data?.data ?? []) as any[];

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deletePayment.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Payments</h2>
        <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
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
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead className="hidden md:table-cell">Method</TableHead>
                <TableHead className="hidden lg:table-cell">Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell className="hidden md:table-cell">
                    {formatDate(payment.paymentDate)}
                  </TableCell>
                  <TableCell>
                    {payment.invoice ? (
                      <Link
                        to={`/invoices/${payment.invoiceId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {payment.invoice.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        Invoice #{payment.invoiceId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {payment.invoice?.client?.name || '--'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {payment.paymentMethod
                      ? payment.paymentMethod
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c: string) => c.toUpperCase())
                      : '--'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {payment.reference || '--'}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {payment.invoiceId && (
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/invoices/${payment.invoiceId}`)
                            }
                          >
                            <Eye className="h-4 w-4" />
                            View Invoice
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(payment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Payment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deletePayment.isPending}
      />
    </div>
  );
}
