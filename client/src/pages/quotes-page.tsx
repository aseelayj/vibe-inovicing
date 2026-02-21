import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileCheck,
  Send,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useQuotes,
  useDeleteQuote,
  useConvertQuote,
  useSendQuote,
} from '@/hooks/use-quotes';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function QuotesPage() {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuotes({ status, search });
  const deleteQuote = useDeleteQuote();
  const convertQuote = useConvertQuote();
  const sendQuote = useSendQuote();

  const quotes = (Array.isArray(data) ? data : data?.data ?? []) as any[];

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteQuote.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled by mutation
    }
  };

  const handleConvert = async (id: number) => {
    try {
      const invoice = await convertQuote.mutateAsync(id);
      navigate(`/invoices/${invoice.id}`);
    } catch {
      // handled by mutation
    }
  };

  const handleSend = async (id: number) => {
    try {
      await sendQuote.mutateAsync(id);
    } catch {
      // handled by mutation
    }
  };

  const renderTable = () => {
    if (isLoading) return <LoadingSpinner />;

    if (quotes.length === 0) {
      return (
        <EmptyState
          icon={FileCheck}
          title={t('emptyTitle')}
          description={
            search || status !== 'all'
              ? t('emptyFilteredDescription')
              : t('emptyDescription')
          }
          actionLabel={!search && status === 'all' ? t('createQuote') : undefined}
          onAction={
            !search && status === 'all'
              ? () => navigate('/quotes/new')
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
              <TableHead>{t('quote')}</TableHead>
              <TableHead>{tc('client')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('issueDate')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('expiryDate')}</TableHead>
              <TableHead className="text-right">{tc('amount')}</TableHead>
              <TableHead>{tc('status')}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote: any) => (
              <TableRow key={quote.id}>
                <TableCell>
                  <Link
                    to={`/quotes/${quote.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {quote.quoteNumber}
                  </Link>
                </TableCell>
                <TableCell>{quote.client?.name || t('noClient')}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatDate(quote.issueDate)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {quote.expiryDate ? formatDate(quote.expiryDate) : '--'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(quote.total, quote.currency)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'capitalize',
                      STATUS_COLORS[quote.status],
                    )}
                  >
                    {quote.status?.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => navigate(`/quotes/${quote.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        {tc('view')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" />
                        {tc('edit')}
                      </DropdownMenuItem>
                      {quote.status === 'draft' && (
                        <DropdownMenuItem onClick={() => handleSend(quote.id)}>
                          <Send className="h-4 w-4" />
                          {t('sendQuote')}
                        </DropdownMenuItem>
                      )}
                      {(quote.status === 'accepted' || quote.status === 'sent') &&
                        !quote.convertedInvoiceId && (
                          <DropdownMenuItem
                            onClick={() => handleConvert(quote.id)}
                          >
                            <FileText className="h-4 w-4" />
                            {t('convertToInvoice')}
                          </DropdownMenuItem>
                        )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteId(quote.id)}
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
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t('title')}</h2>
          <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
            {t('subtitle')}
          </p>
        </div>
        <Link to="/quotes/new">
          <Button size="sm" className="shrink-0 sm:size-default">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('newQuote')}</span>
            <span className="sm:hidden">{tc('new')}</span>
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Tabs
            value={status}
            onValueChange={setStatus}
            className="w-full sm:w-auto"
          >
            <TabsList>
              <TabsTrigger value="all">{tc('all')}</TabsTrigger>
              <TabsTrigger value="draft">{tc('draft')}</TabsTrigger>
              <TabsTrigger value="sent">{tc('sent')}</TabsTrigger>
              <TabsTrigger value="accepted">{t('accepted')}</TabsTrigger>
              <TabsTrigger value="rejected">{t('rejected')}</TabsTrigger>
            </TabsList>
          </Tabs>
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

      {renderTable()}

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        confirmText={tc('delete')}
        variant="danger"
        loading={deleteQuote.isPending}
      />
    </div>
  );
}
