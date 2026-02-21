import { useState } from 'react';
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
          title="No invoices found"
          description={
            search || status !== 'all'
              ? 'Try adjusting your filters or search term.'
              : 'Create your first invoice to get started.'
          }
          actionLabel={
            !search && status === 'all' ? 'Create Invoice' : undefined
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
              <TableHead>Invoice</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Issue Date</TableHead>
              <TableHead className="hidden lg:table-cell">Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
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
                      {invoice.isTaxable ? 'Tax' : 'Exempt'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {invoice.client?.name || 'No client'}
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
                        E-Invoice
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
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          navigate(`/invoices/${invoice.id}/edit`)
                        }
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          const dup = await duplicateInvoice.mutateAsync(invoice.id);
                          if (dup?.id) navigate(`/invoices/${dup.id}`);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      {invoice.status === 'draft' && (
                        <DropdownMenuItem
                          onClick={() => setSendId(invoice.id)}
                        >
                          <Send className="h-4 w-4" />
                          Send
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteId(invoice.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
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
          <h2 className="text-xl font-bold sm:text-2xl">Invoices</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            Manage and track your invoices
            {' · '}
            <Link
              to={`/tax-reports?tab=sales-tax&year=${new Date().getFullYear()}&period=${Math.floor(new Date().getMonth() / 2)}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <FileSpreadsheet className="inline h-3 w-3" />
              Tax report
            </Link>
          </p>
        </div>
        <Link to="/invoices/new">
          <Button size="sm" className="shrink-0 sm:size-default">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Invoice</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-3">
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={taxFilter} onValueChange={setTaxFilter}>
              <TabsList>
                <TabsTrigger value="all">All Types</TabsTrigger>
                <TabsTrigger value="true">Taxable</TabsTrigger>
                <TabsTrigger value="false">Exempt</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search invoices..."
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
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this invoice? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteInvoice.isPending}
            >
              {deleteInvoice.isPending ? 'Deleting...' : 'Delete'}
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
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to send this invoice to the client?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendInvoice.isPending}
            >
              {sendInvoice.isPending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
