import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Send,
  FileText,
  Globe,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useInvoices,
  useDeleteInvoice,
  useDuplicateInvoice,
  useSendInvoice,
} from '@/hooks/use-invoices';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function InvoicesPage() {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [taxFilter, setTaxFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sendId, setSendId] = useState<number | null>(null);

  const { data, isLoading } = useInvoices({
    status,
    search,
    isTaxable: taxFilter === 'all' ? undefined : taxFilter,
  });
  const deleteInvoice = useDeleteInvoice();
  const duplicateInvoice = useDuplicateInvoice();
  const sendInvoice = useSendInvoice();

  const invoices = (Array.isArray(data) ? data : data?.data ?? []) as any[];

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteInvoice.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by mutation
    }
  };

  const handleSend = async () => {
    if (sendId === null) return;
    try {
      await sendInvoice.mutateAsync(sendId);
      setSendId(null);
    } catch {
      // handled by mutation
    }
  };

  const renderInvoiceTable = () => {
    if (isLoading) return <LoadingSpinner />;

    if (invoices.length === 0) {
      return (
        <EmptyState
          icon={FileText}
          title={t('noInvoicesFound')}
          description={
            search || status !== 'all'
              ? t('adjustFilters')
              : t('createFirstInvoice')
          }
          actionLabel={
            !search && status === 'all' ? t('createInvoice') : undefined
          }
          onAction={
            !search && status === 'all'
              ? () => navigate('/invoices/new')
              : undefined
          }
        />
      );
    }

    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('invoice')}</TableHead>
              <TableHead>{t('client')}</TableHead>
              <TableHead>{tc('status')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('issueDate')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('dueDate')}</TableHead>
              <TableHead className="text-right">{tc('total')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/invoices/${invoice.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-transparent text-[10px] px-1.5 py-0',
                        invoice.isTaxable
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600',
                      )}
                    >
                      {invoice.isTaxable ? tc('tax') : tc('exempt')}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {invoice.client?.name || tc('noClient')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        STATUS_COLORS[invoice.status],
                        'border-transparent',
                      )}
                    >
                      {invoice.status.replace(/_/g, ' ')}
                    </Badge>
                    {invoice.jofotaraStatus === 'submitted' && (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-green-100 text-green-700"
                      >
                        <Globe className="mr-0.5 h-3 w-3" />
                        {tc('eInvoice')}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatDate(invoice.issueDate)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {formatDate(invoice.dueDate)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.total, invoice.currency)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          navigate(`/invoices/${invoice.id}`)
                        }
                      >
                        <Eye className="h-4 w-4" />
                        {tc('view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          navigate(`/invoices/${invoice.id}/edit`)
                        }
                      >
                        <Pencil className="h-4 w-4" />
                        {tc('edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          const dup = await duplicateInvoice.mutateAsync(invoice.id);
                          if (dup?.id) navigate(`/invoices/${dup.id}`);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        {tc('duplicate')}
                      </DropdownMenuItem>
                      {invoice.status === 'draft' && (
                        <DropdownMenuItem
                          onClick={() => setSendId(invoice.id)}
                        >
                          <Send className="h-4 w-4" />
                          {tc('send')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteId(invoice.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {tc('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
            {' · '}
            <Link
              to={`/tax-reports?tab=sales-tax&year=${new Date().getFullYear()}&period=${Math.floor(new Date().getMonth() / 2)}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <FileSpreadsheet className="inline h-3 w-3" />
              {t('taxReport')}
            </Link>
          </p>
        </div>
        <Link to="/invoices/new">
          <Button size="sm" className="shrink-0 sm:size-default">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('newInvoice')}</span>
            <span className="sm:hidden">{tc('new')}</span>
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-3">
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList>
                <TabsTrigger value="all">{tc('all')}</TabsTrigger>
                <TabsTrigger value="draft">{t('statusDraft')}</TabsTrigger>
                <TabsTrigger value="sent">{t('statusSent')}</TabsTrigger>
                <TabsTrigger value="paid">{t('statusPaid')}</TabsTrigger>
                <TabsTrigger value="overdue">{t('statusOverdue')}</TabsTrigger>
                <TabsTrigger value="written_off">{t('statusWrittenOff')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={taxFilter} onValueChange={setTaxFilter}>
              <TabsList>
                <TabsTrigger value="all">{t('allTypes')}</TabsTrigger>
                <TabsTrigger value="true">{tc('taxable')}</TabsTrigger>
                <TabsTrigger value="false">{tc('exempt')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 sm:w-64"
          />
        </div>
      </div>

      {renderInvoiceTable()}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteInvoice')}</DialogTitle>
            <DialogDescription>
              {t('deleteInvoiceConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteInvoice.isPending}
            >
              {deleteInvoice.isPending ? tc('deleting') : tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send confirmation dialog */}
      <Dialog
        open={sendId !== null}
        onOpenChange={(open) => !open && setSendId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sendInvoice')}</DialogTitle>
            <DialogDescription>
              {t('sendInvoiceConfirmGeneric')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendId(null)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendInvoice.isPending}
            >
              {sendInvoice.isPending ? tc('sending') : tc('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
