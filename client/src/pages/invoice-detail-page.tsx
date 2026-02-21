import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  ArrowLeft,
  Pencil,
  Send,
  Download,
  Trash2,
  CreditCard,
  MoreHorizontal,
  Loader2,
  Globe,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  useInvoice,
  useDeleteInvoice,
  useSendInvoice,
} from '@/hooks/use-invoices';
import {
  useInvoicePayments,
  useCreatePayment,
  useDeletePayment,
} from '@/hooks/use-payments';
import {
  useJofotaraSubmit,
  useJofotaraCreditSubmit,
  useJofotaraValidate,
  useJofotaraSubmissions,
} from '@/hooks/use-jofotara';
import { useSettings } from '@/hooks/use-settings';
import { useBankAccounts } from '@/hooks/use-bank-accounts';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_COLORS, JOFOTARA_STATUS_COLORS } from '@/lib/constants';
import { PAYMENT_METHODS, INVOICE_STATUSES, BIMONTHLY_PERIODS } from '@vibe/shared';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: payments } = useInvoicePayments(invoice?.id);
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const createPayment = useCreatePayment();
  const deletePayment = useDeletePayment();
  const { data: settings } = useSettings();
  const { data: bankAccountsList } = useBankAccounts(true);
  const jofotaraSubmit = useJofotaraSubmit();
  const jofotaraCreditSubmit = useJofotaraCreditSubmit();
  const jofotaraValidate = useJofotaraValidate();
  const { data: jofotaraSubmissions } = useJofotaraSubmissions(
    invoice?.id,
  );

  const [showDelete, setShowDelete] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(
    null,
  );
  const [showJofotara, setShowJofotara] = useState(false);
  const [jofotaraStep, setJofotaraStep] = useState<
    'validating' | 'errors' | 'confirm'
  >('validating');
  const [jofotaraErrors, setJofotaraErrors] = useState<string[]>([]);
  const [jofotaraPaymentMethod, setJofotaraPaymentMethod] = useState<
    'cash' | 'receivable'
  >('cash');
  const [showJofotaraHistory, setShowJofotaraHistory] = useState(false);
  const [showCreditNote, setShowCreditNote] = useState(false);
  const [creditNoteReason, setCreditNoteReason] = useState('');

  const paymentForm = useForm({
    defaultValues: {
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      reference: '',
      bankAccountId: null as number | null,
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
    try {
      await sendInvoice.mutateAsync(invoice.id);
      setShowSend(false);
    } catch {
      // handled
    }
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

  const handleDeletePayment = async () => {
    if (deletePaymentId === null) return;
    try {
      await deletePayment.mutateAsync(deletePaymentId);
      setDeletePaymentId(null);
    } catch {
      // handled
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/invoices/${invoice.id}/status`, {
        status: newStatus,
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['invoices', String(invoice.id)],
      });
      toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleJofotaraOpen = async () => {
    setShowJofotara(true);
    setJofotaraStep('validating');
    setJofotaraErrors([]);
    try {
      const result = await jofotaraValidate.mutateAsync(invoice.id);
      if (result.valid) {
        setJofotaraStep('confirm');
      } else {
        setJofotaraErrors(result.errors);
        setJofotaraStep('errors');
      }
    } catch {
      setJofotaraErrors(['Failed to validate invoice']);
      setJofotaraStep('errors');
    }
  };

  const handleJofotaraSubmit = async () => {
    try {
      await jofotaraSubmit.mutateAsync({
        invoiceId: invoice.id,
        paymentMethod: jofotaraPaymentMethod,
      });
      setShowJofotara(false);
    } catch {
      // handled by mutation
    }
  };

  const handleCreditNoteSubmit = async () => {
    if (!creditNoteReason.trim()) {
      toast.error('Reason for return is required');
      return;
    }
    try {
      await jofotaraCreditSubmit.mutateAsync({
        invoiceId: invoice.id,
        originalInvoiceId: invoice.id,
        reasonForReturn: creditNoteReason,
      });
      setShowCreditNote(false);
      setCreditNoteReason('');
    } catch {
      // handled by mutation
    }
  };

  const remaining = invoice.total - invoice.amountPaid;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link to="/invoices">
              <Button variant="ghost" size="icon" className="mt-0.5 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold sm:text-2xl">
                  {invoice.invoiceNumber}
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    'border-transparent',
                    invoice.isTaxable
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {invoice.isTaxable ? 'Taxable' : 'Exempt'}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    STATUS_COLORS[invoice.status],
                    'border-transparent',
                  )}
                >
                  {invoice.status.replace(/_/g, ' ')}
                </Badge>
                {invoice.jofotaraStatus &&
                  invoice.jofotaraStatus !== 'not_submitted' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      JOFOTARA_STATUS_COLORS[invoice.jofotaraStatus],
                      'border-transparent',
                    )}
                  >
                    <Globe className="mr-1 h-3 w-3" />
                    {invoice.jofotaraStatus === 'submitted'
                      ? 'E-Invoiced'
                      : invoice.jofotaraStatus.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {formatDate(invoice.createdAt)}
                {invoice.issueDate && (() => {
                  const d = new Date(invoice.issueDate);
                  const periodIdx = Math.floor(d.getMonth() / 2);
                  const period = BIMONTHLY_PERIODS[periodIdx];
                  return (
                    <>
                      {' · '}
                      <Link
                        to={`/tax-reports?tab=sales-tax&year=${d.getFullYear()}&period=${periodIdx}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {period.label} {d.getFullYear()} tax period
                      </Link>
                    </>
                  );
                })()}
              </p>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 lg:flex">
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
            {invoice.status === 'draft' && (
              <Button size="sm" onClick={() => setShowSend(true)}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(`/api/invoices/${invoice.id}/pdf`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  if (!res.ok) throw new Error('Failed to download PDF');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${invoice.invoiceNumber}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error('Failed to download PDF');
                }
              }}
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            {remaining > 0 && (
              <Button
                variant="outline"
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
            {settings?.jofotaraEnabled &&
              invoice.isTaxable &&
              invoice.jofotaraStatus !== 'submitted' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleJofotaraOpen}
              >
                <Globe className="h-4 w-4" />
                Export to JoFotara
              </Button>
            )}
          </div>

          {/* More menu (always visible) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" className="shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Mobile-only quick actions */}
              <div className="lg:hidden">
                <DropdownMenuItem asChild>
                  <Link to={`/invoices/${invoice.id}/edit`}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                {invoice.status === 'draft' && (
                  <DropdownMenuItem onClick={() => setShowSend(true)}>
                    <Send className="h-4 w-4" />
                    Send
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const res = await fetch(`/api/invoices/${invoice.id}/pdf`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      });
                      if (!res.ok) throw new Error('Failed to download PDF');
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${invoice.invoiceNumber}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      toast.error('Failed to download PDF');
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </DropdownMenuItem>
                {remaining > 0 && (
                  <DropdownMenuItem
                    onClick={() => {
                      paymentForm.setValue('amount', remaining);
                      setShowPayment(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                    Record Payment
                  </DropdownMenuItem>
                )}
                {settings?.jofotaraEnabled &&
                  invoice.isTaxable &&
                  invoice.jofotaraStatus !== 'submitted' && (
                  <DropdownMenuItem onClick={handleJofotaraOpen}>
                    <Globe className="h-4 w-4" />
                    Export to JoFotara
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </div>

              {INVOICE_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={s === invoice.status}
                >
                  <span
                    className={cn(
                      'mr-2 inline-block h-2 w-2 rounded-full',
                      STATUS_COLORS[s]?.split(' ')[0],
                    )}
                  />
                  {s.replace(/_/g, ' ').replace(/\b\w/g, (c) =>
                    c.toUpperCase(),
                  )}
                </DropdownMenuItem>
              ))}
              {settings?.jofotaraEnabled &&
                invoice.isTaxable &&
                invoice.jofotaraStatus === 'submitted' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowCreditNote(true)}
                  >
                    <Globe className="h-4 w-4" />
                    Issue Credit Note
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <Card>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bill To
                  </p>
                  <p className="mt-1 font-medium">
                    {invoice.client?.name || 'No client'}
                  </p>
                  {invoice.client?.email && (
                    <p className="text-sm text-muted-foreground">
                      {invoice.client.email}
                    </p>
                  )}
                  {invoice.client?.company && (
                    <p className="text-sm text-muted-foreground">
                      {invoice.client.company}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 sm:flex-col sm:gap-3 sm:text-right">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Issue Date
                    </p>
                    <p className="text-sm">
                      {formatDate(invoice.issueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Due Date
                    </p>
                    <p className="text-sm">
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Currency
                    </p>
                    <p className="text-sm">{invoice.currency}</p>
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
                    <TableHead className="text-right">
                      Unit Price
                    </TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
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
                <div className="w-full space-y-2 pt-4 sm:w-64">
                  <Separator />
                  <div className="flex justify-between pt-2 text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>
                      {formatCurrency(
                        invoice.subtotal,
                        invoice.currency,
                      )}
                    </span>
                  </div>
                  {invoice.taxRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Tax ({invoice.taxRate}%)
                      </span>
                      <span>
                        {formatCurrency(
                          invoice.taxAmount,
                          invoice.currency,
                        )}
                      </span>
                    </div>
                  )}
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Discount
                      </span>
                      <span className="text-destructive">
                        -
                        {formatCurrency(
                          invoice.discountAmount,
                          invoice.currency,
                        )}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between pt-2 font-bold">
                    <span>Total</span>
                    <span>
                      {formatCurrency(invoice.total, invoice.currency)}
                    </span>
                  </div>
                  {invoice.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Paid</span>
                        <span>
                          -
                          {formatCurrency(
                            invoice.amountPaid,
                            invoice.currency,
                          )}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between pt-2 font-bold text-primary">
                        <span>Balance Due</span>
                        <span>
                          {formatCurrency(remaining, invoice.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {(invoice.notes || invoice.terms) && (
            <Card>
              <CardContent>
                {invoice.notes && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {invoice.notes}
                    </p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Terms & Conditions
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {invoice.terms}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {!payments?.length ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No payments recorded
                </p>
              ) : (
                <ul className="space-y-3">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(
                            payment.amount,
                            invoice.currency,
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.paymentDate)}
                          {payment.paymentMethod &&
                            ` via ${payment.paymentMethod.replace(/_/g, ' ')}`}
                        </p>
                        {payment.reference && (
                          <p className="text-xs text-muted-foreground">
                            Ref: {payment.reference}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletePaymentId(payment.id)}
                        aria-label="Delete payment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {settings?.jofotaraEnabled &&
            invoice.jofotaraStatus !== 'not_submitted' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  JoFotara E-Invoice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Status
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      JOFOTARA_STATUS_COLORS[invoice.jofotaraStatus],
                      'border-transparent',
                    )}
                  >
                    {invoice.jofotaraStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>
                {invoice.jofotaraUuid && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      UUID
                    </p>
                    <p className="break-all text-xs font-mono">
                      {invoice.jofotaraUuid}
                    </p>
                  </div>
                )}
                {invoice.jofotaraInvoiceNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Invoice Number
                    </p>
                    <p className="text-sm font-medium">
                      {invoice.jofotaraInvoiceNumber}
                    </p>
                  </div>
                )}
                {invoice.jofotaraSubmittedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Submitted
                    </p>
                    <p className="text-sm">
                      {formatDate(invoice.jofotaraSubmittedAt)}
                    </p>
                  </div>
                )}
                {invoice.jofotaraQrCode && (
                  <div className="pt-2">
                    <p className="mb-2 text-xs text-muted-foreground">
                      QR Code
                    </p>
                    <div className="flex justify-center rounded-lg bg-white p-3">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoice.jofotaraQrCode)}`}
                        alt="JoFotara QR Code"
                        className="h-[150px] w-[150px]"
                      />
                    </div>
                  </div>
                )}

                {jofotaraSubmissions && jofotaraSubmissions.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-sm font-medium"
                      onClick={() =>
                        setShowJofotaraHistory(!showJofotaraHistory)
                      }
                    >
                      Submission History ({jofotaraSubmissions.length})
                      {showJofotaraHistory ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {showJofotaraHistory && (
                      <ul className="mt-2 space-y-2">
                        {jofotaraSubmissions.map((sub) => (
                          <li
                            key={sub.id}
                            className="rounded-lg bg-muted/50 p-2"
                          >
                            <div className="flex items-center justify-between">
                              <Badge
                                variant="outline"
                                className={cn(
                                  JOFOTARA_STATUS_COLORS[sub.status],
                                  'border-transparent text-xs',
                                )}
                              >
                                {sub.status.replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(sub.createdAt)}
                              </span>
                            </div>
                            {sub.errorMessage && (
                              <p className="mt-1 text-xs text-destructive">
                                {sub.errorMessage}
                              </p>
                            )}
                            {sub.isCreditInvoice && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Credit note
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete invoice dialog */}
      <Dialog
        open={showDelete}
        onOpenChange={(open) => !open && setShowDelete(false)}
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
            <Button
              variant="outline"
              onClick={() => setShowDelete(false)}
            >
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

      {/* Send invoice dialog */}
      <Dialog
        open={showSend}
        onOpenChange={(open) => !open && setShowSend(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to send this invoice to{' '}
              {invoice.client?.email || 'the client'}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSend(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendInvoice.isPending}
            >
              {sendInvoice.isPending ? 'Sending...' : 'Send Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog
        open={showPayment}
        onOpenChange={(open) => !open && setShowPayment(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {invoice.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={paymentForm.handleSubmit(handleRecordPayment)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                {...paymentForm.register('amount', {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment Date</Label>
              <Input
                id="payment-date"
                type="date"
                {...paymentForm.register('paymentDate')}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={paymentForm.watch('paymentMethod')}
                onValueChange={(val) =>
                  paymentForm.setValue('paymentMethod', val)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bankAccountsList && bankAccountsList.length > 0 && (
              <div className="space-y-2">
                <Label>Deposit To</Label>
                <Select
                  value={
                    paymentForm.watch('bankAccountId')
                      ? String(paymentForm.watch('bankAccountId'))
                      : 'none'
                  }
                  onValueChange={(val) =>
                    paymentForm.setValue(
                      'bankAccountId',
                      val === 'none' ? null : Number(val),
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      No account (don&apos;t track)
                    </SelectItem>
                    {bankAccountsList.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name}
                        {acc.bankName ? ` — ${acc.bankName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecting an account auto-creates an income transaction
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="payment-reference">Reference</Label>
              <Input
                id="payment-reference"
                placeholder="Transaction ID, check number, etc."
                {...paymentForm.register('reference')}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPayment(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPayment.isPending}
              >
                {createPayment.isPending
                  ? 'Recording...'
                  : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete payment dialog */}
      <Dialog
        open={deletePaymentId !== null}
        onOpenChange={(open) => !open && setDeletePaymentId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this payment record? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletePaymentId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePayment}
              disabled={deletePayment.isPending}
            >
              {deletePayment.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JoFotara submit dialog */}
      <Dialog
        open={showJofotara}
        onOpenChange={(open) => !open && setShowJofotara(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Export to JoFotara
            </DialogTitle>
            <DialogDescription>
              Submit this invoice to Jordan&apos;s e-invoicing system.
            </DialogDescription>
          </DialogHeader>

          {jofotaraStep === 'validating' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Validating invoice...
              </span>
            </div>
          )}

          {jofotaraStep === 'errors' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">
                  Invoice cannot be submitted
                </p>
              </div>
              <ul className="space-y-1">
                {jofotaraErrors.map((err, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-0.5 text-destructive">-</span>
                    {err}
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowJofotara(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}

          {jofotaraStep === 'confirm' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">
                  Invoice is valid for submission
                </p>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={jofotaraPaymentMethod}
                  onValueChange={(val) =>
                    setJofotaraPaymentMethod(
                      val as 'cash' | 'receivable',
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="receivable">
                      Receivable (Credit)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowJofotara(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleJofotaraSubmit}
                  disabled={jofotaraSubmit.isPending}
                >
                  {jofotaraSubmit.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit to JoFotara'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit note dialog */}
      <Dialog
        open={showCreditNote}
        onOpenChange={(open) => !open && setShowCreditNote(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Credit Note</DialogTitle>
            <DialogDescription>
              Submit a credit note to JoFotara for invoice{' '}
              {invoice.invoiceNumber}. This will reverse the original
              e-invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-reason">Reason for Return</Label>
              <Textarea
                id="credit-reason"
                rows={3}
                placeholder="Enter the reason for issuing this credit note..."
                value={creditNoteReason}
                onChange={(e) => setCreditNoteReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreditNote(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreditNoteSubmit}
              disabled={!creditNoteReason.trim()}
            >
              Submit Credit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
