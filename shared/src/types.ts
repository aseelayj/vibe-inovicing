import type {
  InvoiceStatus,
  QuoteStatus,
  PaymentMethod,
  RecurringFrequency,
  Currency,
  TransactionType,
  TransactionCategory,
  JofotaraSubmissionStatus,
  JofotaraInvoiceType,
  FilingStatus,
  BankAccountProvider,
  UserRole,
  EmailTemplateType,
  PayrollRunStatus,
  PayrollPaymentStatus,
  PartnerExpensePaymentMethod,
  AccountType,
  TransferStatus,
  DepositMethod,
  DepositStatus,
  JournalEntryStatus,
} from './constants.js';

// ---- User ----
export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Client ----
export interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxId: string | null;
  cityCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Line Item ----
export interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
}

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

// ---- Invoice ----
export interface Invoice {
  id: number;
  invoiceNumber: string;
  clientId: number | null;
  client?: Client | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  notes: string | null;
  terms: string | null;
  isTaxable: boolean;
  isRecurring: boolean;
  recurringId: number | null;
  sentAt: string | null;
  paidAt: string | null;
  jofotaraUuid: string | null;
  jofotaraStatus: JofotaraSubmissionStatus;
  jofotaraQrCode: string | null;
  jofotaraInvoiceNumber: string | null;
  jofotaraSubmittedAt: string | null;
  lineItems?: LineItem[];
  createdAt: string;
  updatedAt: string;
}

// ---- Quote ----
export interface Quote {
  id: number;
  quoteNumber: string;
  clientId: number | null;
  client?: Client | null;
  status: QuoteStatus;
  issueDate: string;
  expiryDate: string | null;
  currency: Currency;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  convertedInvoiceId: number | null;
  sentAt: string | null;
  lineItems?: LineItem[];
  createdAt: string;
  updatedAt: string;
}

// ---- Payment ----
export interface Payment {
  id: number;
  invoiceId: number;
  invoice?: Invoice;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod | null;
  reference: string | null;
  bankAccountId: number | null;
  bankAccount?: BankAccount | null;
  notes: string | null;
  createdAt: string;
}

// ---- Recurring Invoice ----
export interface RecurringInvoice {
  id: number;
  clientId: number;
  client?: Client;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  lastRunDate: string | null;
  isActive: boolean;
  isTaxable: boolean;
  currency: Currency;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  autoSend: boolean;
  lineItems?: LineItem[];
  createdAt: string;
  updatedAt: string;
}

// ---- Settings ----
export interface Settings {
  id: number;
  businessName: string;
  businessEmail: string;
  businessPhone: string | null;
  businessAddress: string | null;
  taxId: string | null;
  logoUrl: string | null;
  defaultCurrency: Currency;
  defaultTaxRate: number;
  defaultPaymentTerms: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  exemptInvoicePrefix: string;
  nextExemptInvoiceNumber: number;
  quotePrefix: string;
  nextQuoteNumber: number;
  jofotaraClientId: string | null;
  jofotaraClientSecret: string | null;
  jofotaraCompanyTin: string | null;
  jofotaraIncomeSourceSequence: string | null;
  jofotaraInvoiceType: JofotaraInvoiceType;
  jofotaraEnabled: boolean;
  bankEtihadUsername: string | null;
  bankEtihadEnabled: boolean;
  paypalClientId: string | null;
  paypalClientSecret: string | null;
  paypalEnvironment: 'sandbox' | 'live';
  paypalEnabled: boolean;
  geminiApiKey: string | null;
  emailProvider: string;
  resendApiKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean;
  filingStatus: FilingStatus;
  personalExemption: number;
  familyExemption: number;
  additionalExemptions: number;
}

// ---- JoFotara Submission ----
export interface JofotaraSubmission {
  id: number;
  invoiceId: number;
  uuid: string | null;
  status: string;
  invoiceNumber: string | null;
  qrCode: string | null;
  xmlContent: string | null;
  rawResponse: unknown;
  errorMessage: string | null;
  isCreditInvoice: boolean;
  originalInvoiceId: string | null;
  reasonForReturn: string | null;
  createdAt: string;
}

// ---- Bank Account ----
export interface BankAccount {
  id: number;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  currency: Currency;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
  notes: string | null;
  provider: BankAccountProvider;
  lastSyncAt: string | null;
  lastSyncStatus: BankSyncStatusValue | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Transaction ----
export interface Transaction {
  id: number;
  bankAccountId: number;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  date: string;
  description: string;
  notes: string | null;
  bankReference: string | null;
  bankSyncedAt: string | null;
  isFromBank: boolean;
  taxAmount: number | null;
  supplierName: string | null;
  invoiceReference: string | null;
  bankAccount?: BankAccount;
  createdAt: string;
  updatedAt: string;
}

// ---- Bank Sync ----
export type BankSyncStatusValue = 'success' | 'failed' | 'syncing';

export interface BankSyncStatus {
  connected: boolean;
  sessionActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: BankSyncStatusValue | null;
}

export interface BankSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
  bankAccountId: number;
}

export interface BankLoginResult {
  status: 'otp_required' | 'success' | 'error';
  message?: string;
}

// ---- Employee ----
export interface Employee {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  baseSalary: number;
  transportAllowance: number;
  sskEnrolled: boolean;
  hireDate: string;
  endDate: string | null;
  bankAccountName: string | null;
  bankIban: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Payroll Run ----
export interface PayrollRun {
  id: number;
  year: number;
  month: number;
  status: PayrollRunStatus;
  standardWorkingDays: number;
  entryCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalSskEmployee: number;
  totalSskEmployer: number;
  totalCompanyCost: number;
  notes: string | null;
  finalizedAt: string | null;
  entries?: PayrollEntry[];
  createdAt: string;
  updatedAt: string;
}

// ---- Payroll Entry ----
export interface PayrollEntry {
  id: number;
  payrollRunId: number;
  employeeId: number;
  employeeName: string;
  employeeRole: string;
  baseSalary: number;
  sskEnrolled: boolean;
  workingDays: number;
  standardWorkingDays: number;
  basicSalary: number;
  weekdayOvertimeHours: number;
  weekdayOvertimeAmount: number;
  weekendOvertimeHours: number;
  weekendOvertimeAmount: number;
  transportAllowance: number;
  bonus: number;
  salaryDifference: number;
  grossSalary: number;
  salaryAdvance: number;
  otherDeductions: number;
  otherDeductionsNote: string | null;
  sskEmployee: number;
  totalDeductions: number;
  netSalary: number;
  sskEmployer: number;
  paymentStatus: PayrollPaymentStatus;
  paymentDate: string | null;
  bankTrxReference: string | null;
  bankAccountId: number | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Dashboard ----
export interface DashboardStats {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  totalInvoices: number;
  totalClients: number;
  paidThisMonth: number;
  totalBankBalance: number;
  monthlyExpenses: number;
}

export interface RevenueChartData {
  month: string;
  revenue: number;
  invoiceCount: number;
}

export interface ActivityLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  description: string | null;
  userId: number | null;
  user?: { id: number; name: string } | null;
  createdAt: string;
}

// ---- Daily Summary ----
export interface DailyUserSummary {
  userId: number;
  userName: string;
  userRole: UserRole;
  activityCount: number;
  stats: {
    invoicesCreated: number;
    paymentsRecorded: number;
    clientsAdded: number;
    quotesCreated: number;
    otherActions: number;
  };
  activities: ActivityLogEntry[];
}

export interface DailySummary {
  date: string;
  totalActivities: number;
  users: DailyUserSummary[];
}

export interface AiDailySummaryResponse {
  date: string;
  summary: string;
  userSummaries: { userName: string; summary: string }[];
}

// ---- Chat ----
export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ActionStatus = 'pending' | 'confirmed' | 'rejected' | 'executed';

export interface ChatConversation {
  id: number;
  title: string;
  pageContext: PageContext | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: ChatMessageRole;
  content: string | null;
  toolCall: ChatToolCall | null;
  toolResult: ChatToolResult | null;
  actionStatus: ActionStatus | null;
  attachments: ChatAttachment[] | null;
  createdAt: string;
}

export interface ChatToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatToolResult {
  name: string;
  data: unknown;
  summary: string;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  url: string;
  size: number;
}

export interface PageContext {
  path: string;
  section: string;
  entityType?: string;
  entityId?: number;
  action?: string;
}

export type ChatSSEEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_result'; data: ChatToolResult }
  | { type: 'action_proposal'; messageId: number; toolCall: ChatToolCall; summary: string }
  | { type: 'done'; messageId: number }
  | { type: 'error'; message: string };

// ---- Email Template ----
export interface EmailTemplate {
  id: number;
  type: EmailTemplateType;
  subject: string;
  body: string;
  headerColor: string | null;
  isCustomized: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Email Tracking ----
export interface EmailTrackingEvent {
  id: number;
  emailLogId: number;
  eventType: 'open' | 'click';
  url: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface EmailLogEntry {
  id: number;
  invoiceId: number | null;
  quoteId: number | null;
  recipientEmail: string;
  subject: string;
  body: string | null;
  status: string;
  resendId: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  openCount: number;
  clickCount: number;
  sentAt: string;
  trackingEvents?: EmailTrackingEvent[];
}

// ---- API Response ----
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---- AI Types ----
export interface AiGenerateInvoiceRequest {
  prompt: string;
}

export interface AiGenerateInvoiceResponse {
  clientId: number | null;
  clientName: string;
  lineItems: LineItemInput[];
  notes: string;
  dueInDays: number;
  currency: Currency;
}

export interface AiSuggestLineItemsRequest {
  clientId: number;
  partialDescription?: string;
}

export interface AiDraftEmailRequest {
  invoiceId?: number;
  quoteId?: number;
  context: 'send' | 'reminder' | 'followup';
}

export interface AiDraftEmailResponse {
  subject: string;
  body: string;
}

// ---- Tax Reports ----
export interface SalesTaxReport {
  period: { startDate: string; endDate: string; label: string; deadline: string };
  taxableSales: number;
  exemptSales: number;
  totalSales: number;
  outputTax: number;
  invoiceCount: number;
  invoices: SalesTaxInvoiceRow[];
}

export interface SalesTaxInvoiceRow {
  id: number;
  invoiceNumber: string;
  clientName: string | null;
  issueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  isTaxable: boolean;
  status: string;
}

export interface PurchasesReport {
  period: { startDate: string; endDate: string; label: string };
  totalPurchases: number;
  inputTax: number;
  transactionCount: number;
  transactions: PurchasesTransactionRow[];
}

export interface PurchasesTransactionRow {
  id: number;
  date: string;
  description: string;
  supplierName: string | null;
  invoiceReference: string | null;
  category: string;
  amount: number;
  taxAmount: number | null;
}

export interface GstReturnSummary {
  period: { startDate: string; endDate: string; label: string; deadline: string };
  outputTax: number;
  inputTax: number;
  netTax: number;
  taxableSales: number;
  exemptSales: number;
  totalPurchases: number;
}

export interface AnnualIncomeTaxReport {
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  expensesByCategory: { category: string; amount: number }[];
  personalExemption: number;
  familyExemption: number;
  additionalExemptions: number;
  totalExemptions: number;
  taxableIncome: number;
  taxBrackets: { range: string; income: number; rate: number; tax: number }[];
  totalTax: number;
  nationalContribution: number;
  totalLiability: number;
}

export interface ProfitLossReport {
  period: { startDate: string; endDate: string };
  revenue: { total: number; byMonth: { month: string; amount: number }[] };
  expenses: {
    total: number;
    byCategory: { category: string; amount: number }[];
    byMonth: { month: string; amount: number }[];
  };
  netProfit: number;
}

export interface TaxDeadline {
  type: 'gst' | 'income_tax';
  label: string;
  period: string;
  deadline: string;
  daysUntil: number;
}

export interface DashboardTaxSummary {
  currentPeriodGst: GstReturnSummary | null;
  nextDeadlines: TaxDeadline[];
  ytdIncomeTaxEstimate: number;
  ytdRevenue: number;
  ytdExpenses: number;
}

// ---- Partner Expenses ----
export interface PartnerExpenseCategory {
  id: number;
  name: string;
  nameEn: string | null;
  defaultSplitPercent: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerExpense {
  id: number;
  categoryId: number | null;
  category?: PartnerExpenseCategory | null;
  date: string;
  description: string;
  totalAmount: number;
  splitPercent: number;
  partnerShare: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerPayment {
  id: number;
  date: string;
  amount: number;
  description: string | null;
  paymentMethod: PartnerExpensePaymentMethod | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerEmployee {
  id: number;
  name: string;
  sskMonthlyAmount: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerSskBreakdownItem {
  employeeId: number;
  name: string;
  amount: number;
}

export interface PartnerSskEntry {
  id: number;
  year: number;
  month: number;
  totalAmount: number;
  breakdown: PartnerSskBreakdownItem[];
  isPaid: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerBalanceSummary {
  totalExpenses: number;
  totalSsk: number;
  totalPayments: number;
  balance: number;
  expenseCount: number;
  sskCount: number;
  paymentCount: number;
}

// ---- Bank Transfer ----
export interface BankTransfer {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  fromAccount?: BankAccount;
  toAccount?: BankAccount;
  amount: number;
  date: string;
  reference: string | null;
  description: string | null;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
}

// ---- Bank Deposit ----
export interface BankDeposit {
  id: number;
  bankAccountId: number;
  bankAccount?: BankAccount;
  amount: number;
  depositDate: string;
  depositMethod: DepositMethod;
  reference: string | null;
  description: string | null;
  memo: string | null;
  status: DepositStatus;
  depositItems: DepositItem[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepositItem {
  description: string;
  amount: number;
  checkNumber?: string;
}

// ---- Journal Entry ----
export interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  reference: string | null;
  description: string;
  memo: string | null;
  status: JournalEntryStatus;
  totalDebit: number;
  totalCredit: number;
  lines?: JournalEntryLine[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryLine {
  id: number;
  journalEntryId: number;
  accountId: number;
  account?: Account;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
  sortOrder: number;
}

// ---- Chart of Accounts ----
export interface Account {
  id: number;
  code: string;
  name: string;
  nameAr: string | null;
  type: AccountType;
  parentId: number | null;
  parent?: Account | null;
  children?: Account[];
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  balance: number;
  createdAt: string;
  updatedAt: string;
}
