import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  Send,
  Trash2,
  FileText,
  Download,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  useSendQuote,
} from '@/hooks/use-quotes';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);
  const deleteQuote = useDeleteQuote();
  const convertQuote = useConvertQuote();
  const sendQuote = useSendQuote();

  const [showDelete, setShowDelete] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [convertTaxable, setConvertTaxable] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!quote) return null;

  const handleDelete = async () => {
    try {
      await deleteQuote.mutateAsync(quote.id);
      navigate('/quotes');
    } catch {
      // handled by mutation
    }
  };

  const handleConvert = async () => {
    try {
      const invoice = await convertQuote.mutateAsync({
        id: quote.id,
        isTaxable: convertTaxable,
      });
      toast.success('Quote converted to invoice');
      navigate(`/invoices/${invoice.id}`);
    } catch {
      // handled by mutation
    }
  };

  const handleSend = async () => {
    try {
      await sendQuote.mutateAsync(quote.id);
    } catch {
      // handled by mutation
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotes/${quote.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quote.quoteNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link
              to="/quotes"
              className="mt-0.5 shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {quote.quoteNumber}
                </h2>
                <Badge
                  variant="outline"
                  className={cn('capitalize', STATUS_COLORS[quote.status])}
                >
                  {quote.status?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Created {formatDate(quote.createdAt)}
              </p>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 sm:flex">
            <Link to={`/quotes/${quote.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            {quote.status === 'draft' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSend}
                disabled={sendQuote.isPending}
              >
                {sendQuote.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            )}
            {(quote.status === 'accepted' || quote.status === 'sent') &&
              !quote.convertedInvoiceId && (
                <Button size="sm" onClick={() => setShowConvert(true)}>
                  <FileText className="h-4 w-4" />
                  Convert
                </Button>
              )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
        </div>

        {/* Mobile action bar */}
        <div className="flex flex-wrap gap-2 sm:hidden">
          <Link to={`/quotes/${quote.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
          {quote.status === 'draft' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSend}
              disabled={sendQuote.isPending}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          )}
          {(quote.status === 'accepted' || quote.status === 'sent') &&
            !quote.convertedInvoiceId && (
              <Button size="sm" onClick={() => setShowConvert(true)}>
                <FileText className="h-4 w-4" />
                Convert
              </Button>
            )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <Card>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Client
                  </p>
                  <p className="mt-1 font-medium">
                    {quote.client?.name || 'No client'}
                  </p>
                  {quote.client?.email && (
                    <p className="text-sm text-muted-foreground">
                      {quote.client.email}
                    </p>
                  )}
                  {quote.client?.company && (
                    <p className="text-sm text-muted-foreground">
                      {quote.client.company}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 sm:flex-col sm:gap-3 sm:text-right">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Issue Date
                    </p>
                    <p className="text-sm">{formatDate(quote.issueDate)}</p>
                  </div>
                  {quote.expiryDate && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Expiry Date
                      </p>
                      <p className="text-sm">
                        {formatDate(quote.expiryDate)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Currency
                    </p>
                    <p className="text-sm">{quote.currency}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
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
                  {quote.lineItems?.map((item: any) => (
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
                <div className="w-64 space-y-2 pt-4">
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>
                      {formatCurrency(quote.subtotal, quote.currency)}
                    </span>
                  </div>
                  {quote.taxRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Tax ({quote.taxRate}%)
                      </span>
                      <span>
                        {formatCurrency(quote.taxAmount, quote.currency)}
                      </span>
                    </div>
                  )}
                  {quote.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-destructive">
                        -{formatCurrency(quote.discountAmount, quote.currency)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>
                      {formatCurrency(quote.total, quote.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(quote.notes || quote.terms) && (
            <Card>
              <CardContent>
                {quote.notes && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {quote.notes}
                    </p>
                  </div>
                )}
                {quote.terms && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Terms & Conditions
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {quote.terms}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {quote.convertedInvoiceId && (
            <Card>
              <CardHeader>
                <CardTitle>Converted Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  to={`/invoices/${quote.convertedInvoiceId}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  View Invoice
                </Link>
              </CardContent>
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

      <Dialog
        open={showConvert}
        onOpenChange={(open) => !open && setShowConvert(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Invoice</DialogTitle>
            <DialogDescription>
              This will create a new invoice from this quote. Choose the
              invoice type below.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Subject to Tax</Label>
              <p className="text-xs text-muted-foreground">
                {convertTaxable
                  ? 'Taxable invoice (INV) — 16% GST'
                  : 'Exempt invoice (EINV) — 0% tax'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={convertTaxable}
              onClick={() => setConvertTaxable(!convertTaxable)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                convertTaxable ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                  convertTaxable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConvert(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertQuote.isPending}
            >
              {convertQuote.isPending ? 'Converting...' : 'Convert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
