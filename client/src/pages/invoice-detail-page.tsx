import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  Bell,
} from 'lucide-react';
import { EmailTrackingCard } from '@/components/email/email-tracking-card';
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
  useSendReminder,
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
import { api, getAuthToken } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function InvoiceDetailPage() {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: payments } = useInvoicePayments(invoice?.id);
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const sendReminder = useSendReminder();
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
  const [showReminder, setShowReminder] = useState(false);
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

  const handleSendReminder = async () => {
    try {
      await sendReminder.mutateAsync(invoice.id);
      setShowReminder(false);
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
                  {invoice.isTaxable ? tc('taxable') : tc('exempt')}
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
                      <Globe className="me-1 h-3 w-3" />
                      {invoice.jofotaraStatus === 'submitted'
                        ? t('jofotaraEInvoiced')
                        : invoice.jofotaraStatus.replace(/_/g, ' ')}
                    </Badge>
                  )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('created', { date: formatDate(invoice.createdAt) })}
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
                        {t('taxPeriod', {
                          period: period.label,
                          year: d.getFullYear(),
                        })}
                      </Link>
                    </>
                  );
                })()}
              </p>
            </div>
          </div>

          {/* Desktop actions */}
          {invoice.status !== 'written_off' && (
          <div className="hidden items-center gap-2 lg:flex">
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                {tc('edit')}
              </Button>
            </Link>
            {invoice.status === 'draft' && (
              <Button size="sm" onClick={() => setShowSend(true)}>
                <Send className="h-4 w-4" />
                {tc('send')}
              </Button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'draft' && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                onClick={() => setShowReminder(true)}
              >
                <Bell className="h-4 w-4" />
                {t('sendReminder')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const token = getAuthToken();
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
              {tc('pdf')}
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
                {t('recordPayment')}
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
                  {t('exportToJofotara')}
                </Button>
              )}
          </div>
          )}

          {/* More menu (always visible) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" className="shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Mobile-only quick actions */}
              {invoice.status !== 'written_off' && (
              <div className="lg:hidden">
                <DropdownMenuItem asChild>
                  <Link to={`/invoices/${invoice.id}/edit`}>
                    <Pencil className="h-4 w-4" />
                    {tc('edit')}
                  </Link>
                </DropdownMenuItem>
                {invoice.status === 'draft' && (
                  <DropdownMenuItem onClick={() => setShowSend(true)}>
                    <Send className="h-4 w-4" />
                    {tc('send')}
                  </DropdownMenuItem>
                )}
                {invoice.status !== 'paid' && invoice.status !== 'draft' && (
                  <DropdownMenuItem onClick={() => setShowReminder(true)}>
                    <Bell className="h-4 w-4" />
                    {t('sendReminder')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      const token = getAuthToken();
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
                  {t('downloadPdf')}
                </DropdownMenuItem>
                {remaining > 0 && (
                  <DropdownMenuItem
                    onClick={() => {
                      paymentForm.setValue('amount', remaining);
                      setShowPayment(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                    {t('recordPayment')}
                  </DropdownMenuItem>
                )}
                {settings?.jofotaraEnabled &&
                  invoice.isTaxable &&
                  invoice.jofotaraStatus !== 'submitted' && (
                    <DropdownMenuItem onClick={handleJofotaraOpen}>
                      <Globe className="h-4 w-4" />
                      {t('exportToJofotara')}
                    </DropdownMenuItem>
                  )}
                <DropdownMenuSeparator />
              </div>
              )}

              {invoice.status !== 'written_off' && INVOICE_STATUSES
                .filter((s) => s !== 'written_off')
                .map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={s === invoice.status}
                >
                  <span
                    className={cn(
                      'me-2 inline-block h-2 w-2 rounded-full',
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
                      {t('issueCreditNote')}
                    </DropdownMenuItem>
                  </>
                )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                {t('deleteInvoice')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {invoice.status === 'written_off' && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          {t('writtenOffNotice')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <Card>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('billTo')}
                  </p>
                  <p className="mt-1 font-medium">
                    {invoice.client?.name || tc('noClient')}
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
                <div className="flex flex-wrap gap-4 sm:flex-col sm:gap-3 sm:text-end">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('issueDate')}
                    </p>
                    <p className="text-sm">
                      {formatDate(invoice.issueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('dueDate')}
                    </p>
                    <p className="text-sm">
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {tc('currency')}
                    </p>
                    <p className="text-sm">{invoice.currency}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tc('lineItems')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tc('description')}</TableHead>
                    <TableHead className="text-end">{tc('qty')}</TableHead>
                    <TableHead className="text-end">
                      {tc('unitPrice')}
                    </TableHead>
                    <TableHead className="text-end">{tc('amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-end">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-end">
                        {formatCurrency(item.unitPrice, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-end font-medium">
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
                    <span className="text-muted-foreground">{tc('subtotal')}</span>
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
                        {tc('taxWithRate', { rate: invoice.taxRate })}
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
                        {tc('discount')}
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
                    <span>{tc('total')}</span>
                    <span>
                      {formatCurrency(invoice.total, invoice.currency)}
                    </span>
                  </div>
                  {invoice.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>{t('paid')}</span>
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
                        <span>{t('balanceDue')}</span>
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
                      {tc('notes')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {invoice.notes}
                    </p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {tc('termsAndConditions')}
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
              <CardTitle>{t('paymentHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!payments?.length ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t('noPaymentsRecorded')}
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
                            ` ${t('via', { method: payment.paymentMethod.replace(/_/g, ' ') })}`}
                        </p>
                        {payment.reference && (
                          <p className="text-xs text-muted-foreground">
                            {t('ref', { reference: payment.reference })}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletePaymentId(payment.id)}
                        aria-label={t('deletePayment')}
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
                    {t('jofotaraEInvoice')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {tc('status')}
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
                        {t('jofotaraUuid')}
                      </p>
                      <p className="break-all text-xs font-mono">
                        {invoice.jofotaraUuid}
                      </p>
                    </div>
                  )}
                  {invoice.jofotaraInvoiceNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t('jofotaraInvoiceNumber')}
                      </p>
                      <p className="text-sm font-medium">
                        {invoice.jofotaraInvoiceNumber}
                      </p>
                    </div>
                  )}
                  {invoice.jofotaraSubmittedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t('jofotaraSubmitted')}
                      </p>
                      <p className="text-sm">
                        {formatDate(invoice.jofotaraSubmittedAt)}
                      </p>
                    </div>
                  )}
                  {invoice.jofotaraQrCode && (
                    <div className="pt-2">
                      <p className="mb-2 text-xs text-muted-foreground">
                        {t('jofotaraQrCode')}
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
                        {t('submissionHistory', {
                          count: jofotaraSubmissions.length,
                        })}
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
                                  {t('creditNote')}
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

            <EmailTrackingCard invoiceId={invoice.id} />
        </div>
      </div>

      {/* Delete invoice dialog */}
      <Dialog
        open={showDelete}
        onOpenChange={(open) => !open && setShowDelete(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteInvoice')}</DialogTitle>
            <DialogDescription>
              {t('deleteInvoiceConfirm')}
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
              disabled={deleteInvoice.isPending}
            >
              {deleteInvoice.isPending ? tc('deleting') : tc('delete')}
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
            <DialogTitle>{t('sendInvoice')}</DialogTitle>
            <DialogDescription>
              {invoice.client?.email
                ? t('sendInvoiceConfirm', { email: invoice.client.email })
                : t('sendInvoiceConfirmGeneric')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSend(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendInvoice.isPending}
            >
              {sendInvoice.isPending ? tc('sending') : t('sendInvoice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send reminder dialog */}
      <Dialog
        open={showReminder}
        onOpenChange={(open) => !open && setShowReminder(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              {t('sendPaymentReminder')}
            </DialogTitle>
            <DialogDescription>
              {t('sendReminderConfirm', {
                email: invoice.client?.email || 'the client',
                invoice: invoice.invoiceNumber,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-700">{t('amountDue')}</span>
              <span className="font-semibold text-amber-800">
                {formatCurrency(remaining, invoice.currency)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-amber-700">{t('dueDate')}</span>
              <span className="font-medium text-amber-800">
                {formatDate(invoice.dueDate)}
              </span>
            </div>
            {(() => {
              const now = new Date();
              const dueDate = new Date(invoice.dueDate);
              const daysOverdue = Math.floor(
                (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
              );
              if (daysOverdue > 0) {
                return (
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-red-600">{t('overdueLabel')}</span>
                    <span className="font-semibold text-red-700">
                      {t('overdueDays', { count: daysOverdue })}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReminder(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={handleSendReminder}
              disabled={sendReminder.isPending}
            >
              {sendReminder.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tc('sending')}
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  {t('sendReminder')}
                </>
              )}
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
            <DialogTitle>{t('recordPayment')}</DialogTitle>
            <DialogDescription>
              {t('recordPaymentDesc', {
                invoice: invoice.invoiceNumber,
              })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={paymentForm.handleSubmit(handleRecordPayment)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="payment-amount">{t('paymentAmount')}</Label>
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
              <Label htmlFor="payment-date">{t('paymentDate')}</Label>
              <Input
                id="payment-date"
                type="date"
                {...paymentForm.register('paymentDate')}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc('paymentMethod')}</Label>
              <Select
                value={paymentForm.watch('paymentMethod')}
                onValueChange={(val) =>
                  paymentForm.setValue('paymentMethod', val)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tc('selectMethod')} />
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
                <Label>{t('depositTo')}</Label>
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
                    <SelectValue placeholder={t('selectBankAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t('noAccountDontTrack')}
                    </SelectItem>
                    {bankAccountsList.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)}>
                        {acc.name}
                        {acc.bankName ? ` -- ${acc.bankName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('depositAutoCreate')}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="payment-reference">{tc('reference')}</Label>
              <Input
                id="payment-reference"
                placeholder={t('referencePlaceholder')}
                {...paymentForm.register('reference')}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPayment(false)}
              >
                {tc('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createPayment.isPending}
              >
                {createPayment.isPending
                  ? tc('recording')
                  : t('recordPayment')}
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
            <DialogTitle>{t('deletePayment')}</DialogTitle>
            <DialogDescription>
              {t('deletePaymentConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletePaymentId(null)}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePayment}
              disabled={deletePayment.isPending}
            >
              {deletePayment.isPending ? tc('deleting') : tc('delete')}
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
              {t('exportToJofotara')}
            </DialogTitle>
            <DialogDescription>
              {t('jofotaraSubmitDesc')}
            </DialogDescription>
          </DialogHeader>

          {jofotaraStep === 'validating' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ms-2 text-sm text-muted-foreground">
                {t('validatingInvoice')}
              </span>
            </div>
          )}

          {jofotaraStep === 'errors' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">
                  {t('invoiceCannotBeSubmitted')}
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
                  {tc('close')}
                </Button>
              </DialogFooter>
            </div>
          )}

          {jofotaraStep === 'confirm' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">
                  {t('invoiceValidForSubmission')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{tc('paymentMethod')}</Label>
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
                    <SelectItem value="cash">{t('jofotaraCash')}</SelectItem>
                    <SelectItem value="receivable">
                      {t('jofotaraReceivable')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowJofotara(false)}
                >
                  {tc('cancel')}
                </Button>
                <Button
                  onClick={handleJofotaraSubmit}
                  disabled={jofotaraSubmit.isPending}
                >
                  {jofotaraSubmit.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tc('submitting')}
                    </>
                  ) : (
                    t('jofotaraSubmit')
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
            <DialogTitle>{t('issueCreditNote')}</DialogTitle>
            <DialogDescription>
              {t('issueCreditNoteDesc', {
                invoice: invoice.invoiceNumber,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-reason">{t('reasonForReturn')}</Label>
              <Textarea
                id="credit-reason"
                rows={3}
                placeholder={t('reasonPlaceholder')}
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
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleCreditNoteSubmit}
              disabled={!creditNoteReason.trim()}
            >
              {t('submitCreditNote')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
