import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useQuotes, useDeleteQuote } from '@/hooks/use-quotes';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
];

export function QuotesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuotes({ status, search });
  const deleteQuote = useDeleteQuote();

  const quotes = data?.data ?? [];

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteQuote.mutateAsync(deleteId);
      setDeleteId(null);
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quotes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track your quotes
          </p>
        </div>
        <Link to="/quotes/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Quote
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                status === tab.value
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No quotes found"
          description={
            search || status !== 'all'
              ? 'Try adjusting your filters or search term.'
              : 'Create your first quote to get started.'
          }
          actionLabel={!search && status === 'all' ? 'Create Quote' : undefined}
          onAction={
            !search && status === 'all'
              ? () => navigate('/quotes/new')
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <Link
                      to={`/quotes/${quote.id}`}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      {quote.quoteNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {quote.client?.name || 'No client'}
                  </TableCell>
                  <TableCell>
                    <Badge status={quote.status} />
                  </TableCell>
                  <TableCell>{formatDate(quote.issueDate)}</TableCell>
                  <TableCell>
                    {quote.expiryDate ? formatDate(quote.expiryDate) : '--'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(quote.total, quote.currency)}
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenu(openMenu === quote.id ? null : quote.id)
                        }
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === quote.id && (
                        <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/quotes/${quote.id}`);
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/quotes/${quote.id}/edit`);
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteId(quote.id);
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
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
        title="Delete Quote"
        message="Are you sure you want to delete this quote? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteQuote.isPending}
      />
    </div>
  );
}
