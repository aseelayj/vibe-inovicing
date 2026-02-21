import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Building,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ClientForm } from '@/components/clients/client-form';
import { useClient, useUpdateClient, useDeleteClient } from '@/hooks/use-clients';
import { useInvoices } from '@/hooks/use-invoices';
import { useQuotes } from '@/hooks/use-quotes';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const TABS = ['Invoices', 'Quotes'] as const;

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const { data: invoicesData } = useInvoices({ search: client?.name });
  const { data: quotesData } = useQuotes({ search: client?.name });

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Invoices');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!client) return null;

  const handleUpdate = async (data: Record<string, unknown>) => {
    try {
      await updateClient.mutateAsync({ id: client.id, data });
      setShowEdit(false);
    } catch {
      // handled
    }
  };

  const handleDelete = async () => {
    try {
      await deleteClient.mutateAsync(client.id);
      navigate('/clients');
    } catch {
      // handled
    }
  };

  const address = [
    client.addressLine1,
    client.addressLine2,
    [client.city, client.state].filter(Boolean).join(', '),
    client.postalCode,
    client.country,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/clients"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
            {client.company && (
              <p className="mt-1 text-sm text-gray-500">{client.company}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowEdit(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
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
        <Card>
          <div className="space-y-4">
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{client.phone}</span>
              </div>
            )}
            {client.company && (
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{client.company}</span>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                <span className="whitespace-pre-line text-sm text-gray-700">
                  {address}
                </span>
              </div>
            )}
            {client.notes && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                  {client.notes}
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="xl:col-span-2">
          <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {activeTab === 'Invoices' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoicesData?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-gray-400">
                        No invoices for this client
                      </TableCell>
                    </TableRow>
                  ) : (
                    (invoicesData?.data ?? []).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link
                            to={`/invoices/${inv.id}`}
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            {inv.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge status={inv.status} />
                        </TableCell>
                        <TableCell>{formatDate(inv.issueDate)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(inv.total, inv.currency)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {activeTab === 'Quotes' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(quotesData?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-gray-400">
                        No quotes for this client
                      </TableCell>
                    </TableRow>
                  ) : (
                    (quotesData?.data ?? []).map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>
                          <Link
                            to={`/quotes/${q.id}`}
                            className="font-medium text-primary-600 hover:text-primary-700"
                          >
                            {q.quoteNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge status={q.status} />
                        </TableCell>
                        <TableCell>{formatDate(q.issueDate)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(q.total, q.currency)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Client"
      >
        <ClientForm
          defaultValues={client}
          onSubmit={handleUpdate}
          isLoading={updateClient.isPending}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Client"
        message="Are you sure you want to delete this client? Associated invoices and quotes will not be deleted."
        confirmText="Delete"
        variant="danger"
        loading={deleteClient.isPending}
      />
    </div>
  );
}
