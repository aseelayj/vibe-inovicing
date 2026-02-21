import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ClientForm } from '@/components/clients/client-form';
import {
  useClient,
  useUpdateClient,
  useDeleteClient,
} from '@/hooks/use-clients';
import { useInvoices } from '@/hooks/use-invoices';
import { useQuotes } from '@/hooks/use-quotes';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ClientDetailPage() {
  const { t } = useTranslation('clients');
  const { t: tc } = useTranslation('common');
  const { t: tq } = useTranslation('quotes');
  const { t: ti } = useTranslation('invoices');
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const { data: invoicesData } = useInvoices(
    client ? { clientId: client.id } : {},
  );
  const { data: quotesData } = useQuotes(
    client ? { clientId: client.id } : {},
  );

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const clientInvoices = (Array.isArray(invoicesData) ? invoicesData : invoicesData?.data ?? []) as any[];
  const clientQuotes = (Array.isArray(quotesData) ? quotesData : quotesData?.data ?? []) as any[];

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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/clients">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h2 className="text-xl font-bold sm:text-2xl">{client.name}</h2>
            {client.company && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {client.company}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEdit(true)}
          >
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">{tc('edit')}</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{tc('delete')}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('contactInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            {client.company && (
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.company}</span>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span className="whitespace-pre-line text-sm">
                  {address}
                </span>
              </div>
            )}
            {client.notes && (
              <div className="border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tc('notes')}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {client.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-2">
          <Tabs defaultValue="invoices">
            <TabsList>
              <TabsTrigger value="invoices">{ti('title')}</TabsTrigger>
              <TabsTrigger value="quotes">{tq('title')}</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices">
              <div className="rounded-xl border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{ti('invoice')}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                      <TableHead className="text-right">{tc('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          {t('noInvoicesForClient')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Link
                              to={`/invoices/${inv.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {inv.invoiceNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                STATUS_COLORS[inv.status],
                                'border-transparent',
                              )}
                            >
                              {inv.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDate(inv.issueDate)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(inv.total, inv.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="quotes">
              <div className="rounded-xl border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tq('quote')}</TableHead>
                      <TableHead>{tc('status')}</TableHead>
                      <TableHead>{tc('date')}</TableHead>
                      <TableHead className="text-right">{tc('total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientQuotes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          {t('noQuotesForClient')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientQuotes.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell>
                            <Link
                              to={`/quotes/${q.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {q.quoteNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                STATUS_COLORS[q.status],
                                'border-transparent',
                              )}
                            >
                              {q.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDate(q.issueDate)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(q.total, q.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit client dialog */}
      <Dialog
        open={showEdit}
        onOpenChange={(open) => !open && setShowEdit(false)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('editClient')}</DialogTitle>
            <DialogDescription>
              {t('editClientDesc', { name: client.name })}
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            defaultValues={client}
            onSubmit={handleUpdate}
            isLoading={updateClient.isPending}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDelete}
        onOpenChange={(open) => !open && setShowDelete(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteClient')}</DialogTitle>
            <DialogDescription>
              {t('deleteClientConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDelete(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
