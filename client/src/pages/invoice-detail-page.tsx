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
  Globe,
  Bell,
  FileText,
  Undo2,
} from 'lucide-react';
import { EmailTrackingCard } from '@/components/email/email-tracking-card';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  useInvoiceNumberHistory,
  useCreateCreditNote,
} from '@/hooks/use-invoices';
import { InvoiceNumberEditor } from '@/components/invoices/invoice-number-editor';
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
import { BIMONTHLY_PERIODS } from '@vibe/shared';
import { api } from '@/lib/api-client';
import { downloadInvoicePdf } from '@/lib/download-pdf';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  PaymentHistoryCard,
  RecordPaymentDialog,
  DeletePaymentDialog,
  JofotaraCard,
  JofotaraSubmitDialog,
  CreditNoteDialog,
  DeleteInvoiceDialog,
  SendInvoiceDialog,
  SendReminderDialog,
  CreateCreditNoteDialog,
} from '@/components/invoices/invoice-detail';

export function InvoiceDetailPage() {
  const { t } = useTranslation('invoices');
  const { t: tc } = useTranslation('common');
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: numberHistory } = useInvoiceNumberHistory(id);
  const { data: payments } = useInvoicePayments(invoice?.id);
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const sendReminder = useSendReminder();
  const createPayment = useCreatePayment();
  const deletePaymentMutation = useDeletePayment();
  const { data: settings } = useSettings();
  const { data: bankAccountsList } = useBankAccounts(true);
  const jofotaraSubmit = useJofotaraSubmit();
  const jofotaraCreditSubmit = useJofotaraCreditSubmit();
  const jofotaraValidate = useJofotaraValidate();
  const { data: jofotaraSubmissions } = useJofotaraSubmissions(invoice?.id);
  const createCreditNote = useCreateCreditNote();

  const [showDelete, setShowDelete] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
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
  const [showCreateCreditNote, setShowCreateCreditNote] = useState(false);
  const [createCreditNoteReason, setCreateCreditNoteReason] = useState('');

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

  const remaining = invoice.total - invoice.amountPaid;

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
      await createPayment.mutateAsync({ invoiceId: invoice.id, ...data });
      setShowPayment(false);
      paymentForm.reset();
    } catch {
      // handled
    }
  };

  const handleDeletePayment = async () => {
    if (deletePaymentId === null) return;
    try {
      await deletePaymentMutation.mutateAsync(deletePaymentId);
      setDeletePaymentId(null);
    } catch {
      // handled
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/invoices/${invoice.id}/status`, { status: newStatus });
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

  const handleCreateCreditNote = async () => {
    if (!createCreditNoteReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    try {
      const result = await createCreditNote.mutateAsync({
        invoiceId: invoice.id,
        reason: createCreditNoteReason,
      });
      setShowCreateCreditNote(false);
      setCreateCreditNoteReason('');
      if (result?.id) {
        navigate(`/invoices/${result.id}`);
      }
    } catch {
      // handled by mutation
    }
  };

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
                <InvoiceNumberEditor invoice={invoice} />
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
                {invoice.isCreditNote && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-purple-100 text-purple-700"
                  >
                    <Undo2 className="me-1 h-3 w-3" />
                    {t('creditNote')}
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
              {invoice.isCreditNote && invoice.originalInvoice && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">{t('creditNoteFor')}{' '}</span>
                  <Link
                    to={`/invoices/${invoice.originalInvoiceId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {invoice.originalInvoice.invoiceNumber}
                  </Link>
                  {invoice.creditNoteReason && (
                    <span className="text-muted-foreground"> — {invoice.creditNoteReason}</span>
                  )}
                </p>
              )}
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
              onClick={() => downloadInvoicePdf(invoice.id, invoice.invoiceNumber)}
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
            {!invoice.isCreditNote &&
              invoice.status !== 'draft' &&
              invoice.status !== 'cancelled' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateCreditNote(true)}
                >
                  <Undo2 className="h-4 w-4" />
                  {t('createCreditNote')}
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
                  onClick={() => downloadInvoicePdf(invoice.id, invoice.invoiceNumber)}
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
                {!invoice.isCreditNote &&
                  invoice.status !== 'draft' &&
                  invoice.status !== 'cancelled' && (
                    <DropdownMenuItem onClick={() => setShowCreateCreditNote(true)}>
                      <Undo2 className="h-4 w-4" />
                      {t('createCreditNote')}
                    </DropdownMenuItem>
                  )}
                <DropdownMenuSeparator />
              </div>
              )}

              {(() => {
                const VALID_TRANSITIONS: Record<string, string[]> = {
                  draft: ['sent', 'cancelled'],
                  sent: ['paid', 'partially_paid', 'overdue', 'cancelled'],
                  viewed: ['paid', 'partially_paid', 'overdue', 'cancelled'],
                  partially_paid: ['paid', 'overdue', 'cancelled'],
                  overdue: ['paid', 'partially_paid', 'cancelled'],
                  cancelled: ['draft'],
                  paid: [],
                  written_off: [],
                };
                const allowed = VALID_TRANSITIONS[invoice.status] || [];
                return allowed.length > 0 && allowed.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleStatusChange(s)}
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
                ));
              })()}
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
          {/* Client & Dates Card */}
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
                    <p className="text-sm">{formatDate(invoice.issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('dueDate')}
                    </p>
                    <p className="text-sm">{formatDate(invoice.dueDate)}</p>
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

          {/* Line Items Card */}
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
                    <TableHead className="text-end">{tc('unitPrice')}</TableHead>
                    <TableHead className="text-end">{tc('amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-end">{item.quantity}</TableCell>
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
                    <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {invoice.taxRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tc('taxWithRate', { rate: invoice.taxRate })}
                      </span>
                      <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{tc('discount')}</span>
                      <span className="text-destructive">
                        -{formatCurrency(invoice.discountAmount, invoice.currency)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between pt-2 font-bold">
                    <span>{tc('total')}</span>
                    <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                  </div>
                  {invoice.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>{t('paid')}</span>
                        <span>-{formatCurrency(invoice.amountPaid, invoice.currency)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between pt-2 font-bold text-primary">
                        <span>{t('balanceDue')}</span>
                        <span>{formatCurrency(remaining, invoice.currency)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
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

        {/* Right sidebar */}
        <div className="space-y-6">
          <PaymentHistoryCard
            invoice={invoice}
            payments={payments}
            onDeletePayment={setDeletePaymentId}
          />

          {settings?.jofotaraEnabled &&
            invoice.jofotaraStatus !== 'not_submitted' && (
              <JofotaraCard
                invoice={invoice}
                submissions={jofotaraSubmissions}
                showHistory={showJofotaraHistory}
                onToggleHistory={() => setShowJofotaraHistory(!showJofotaraHistory)}
              />
            )}

          <EmailTrackingCard invoiceId={invoice.id} />

          {/* Linked Credit Notes */}
          {invoice.creditNotes && invoice.creditNotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Undo2 className="h-4 w-4" />
                  {t('linkedCreditNotes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {invoice.creditNotes.map((note) => (
                    <li key={note.id}>
                      <Link
                        to={`/invoices/${note.id}`}
                        className="flex items-center justify-between rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
                      >
                        <div>
                          <p className="text-sm font-medium">{note.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(note.createdAt)}
                          </p>
                          {note.creditNoteReason && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {note.creditNoteReason}
                            </p>
                          )}
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-medium text-destructive">
                            -{formatCurrency(note.total, note.currency)}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              STATUS_COLORS[note.status],
                              'border-transparent text-xs',
                            )}
                          >
                            {note.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Number Change Audit Trail */}
          {numberHistory && numberHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('numberChangeHistory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {numberHistory.map((change) => (
                    <div
                      key={change.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-muted-foreground line-through">
                            {change.oldNumber}
                          </span>
                          <span className="text-muted-foreground">&rarr;</span>
                          <span className="font-mono font-medium">
                            {change.newNumber}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {change.reason}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {change.user?.name || t('unknownUser')} &middot;{' '}
                          {formatDate(change.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <DeleteInvoiceDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={handleDelete}
        isPending={deleteInvoice.isPending}
      />
      <SendInvoiceDialog
        open={showSend}
        onOpenChange={setShowSend}
        onConfirm={handleSend}
        isPending={sendInvoice.isPending}
        clientEmail={invoice.client?.email}
      />
      <SendReminderDialog
        open={showReminder}
        onOpenChange={setShowReminder}
        onConfirm={handleSendReminder}
        isPending={sendReminder.isPending}
        invoice={invoice}
        remaining={remaining}
      />
      <RecordPaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        invoice={invoice}
        paymentForm={paymentForm}
        onSubmit={handleRecordPayment}
        isPending={createPayment.isPending}
        bankAccounts={bankAccountsList}
      />
      <DeletePaymentDialog
        open={deletePaymentId !== null}
        onOpenChange={() => setDeletePaymentId(null)}
        onConfirm={handleDeletePayment}
        isPending={deletePaymentMutation.isPending}
      />
      <JofotaraSubmitDialog
        open={showJofotara}
        onOpenChange={setShowJofotara}
        step={jofotaraStep}
        errors={jofotaraErrors}
        paymentMethod={jofotaraPaymentMethod}
        onPaymentMethodChange={setJofotaraPaymentMethod}
        onSubmit={handleJofotaraSubmit}
        isPending={jofotaraSubmit.isPending}
      />
      <CreditNoteDialog
        open={showCreditNote}
        onOpenChange={setShowCreditNote}
        invoiceNumber={invoice.invoiceNumber}
        reason={creditNoteReason}
        onReasonChange={setCreditNoteReason}
        onSubmit={handleCreditNoteSubmit}
      />
      <CreateCreditNoteDialog
        open={showCreateCreditNote}
        onOpenChange={setShowCreateCreditNote}
        invoiceNumber={invoice.invoiceNumber}
        reason={createCreditNoteReason}
        onReasonChange={setCreateCreditNoteReason}
        onSubmit={handleCreateCreditNote}
        isPending={createCreditNote.isPending}
      />
    </div>
  );
}
