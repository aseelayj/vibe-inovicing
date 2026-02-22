import { z } from 'zod';
import {
  INVOICE_STATUSES,
  QUOTE_STATUSES,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  CURRENCIES,
  TRANSACTION_TYPES,
  TRANSACTION_CATEGORIES,
  JOFOTARA_INVOICE_TYPES,
  FILING_STATUSES,
  BANK_ACCOUNT_PROVIDERS,
  USER_ROLES,
  EMAIL_TEMPLATE_TYPES,
  PAYROLL_RUN_STATUSES,
  PAYROLL_PAYMENT_STATUSES,
  PARTNER_EXPENSE_PAYMENT_METHODS,
  ACCOUNT_TYPES,
  TRANSFER_STATUSES,
  DEPOSIT_METHODS,
  DEPOSIT_STATUSES,
  JOURNAL_ENTRY_STATUSES,
} from './constants.js';

// Helper: transform empty strings to null for optional fields
const emptyToNull = z.string().transform((v) => (v.trim() === '' ? null : v));
const optionalString = (max = 255) =>
  emptyToNull.pipe(z.string().max(max).nullable()).nullable().optional();
const optionalEmail = () =>
  emptyToNull.pipe(z.string().email().max(255).nullable()).nullable().optional();

// ---- Line Item ----
export const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Price must be non-negative'),
});

// ---- Client ----
export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: optionalEmail(),
  phone: optionalString(50),
  company: optionalString(255),
  addressLine1: optionalString(255),
  addressLine2: optionalString(255),
  city: optionalString(100),
  state: optionalString(100),
  postalCode: optionalString(20),
  country: optionalString(100),
  taxId: optionalString(50),
  cityCode: optionalString(10),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ---- Invoice ----
export const createInvoiceSchema = z.object({
  clientId: z.number().int().positive().nullable().optional(),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  currency: z.enum(CURRENCIES).default('USD'),
  taxRate: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  isTaxable: z.boolean().default(false),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  terms: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item'),
  isWriteOff: z.boolean().default(false).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(INVOICE_STATUSES),
});

// ---- Quote ----
export const createQuoteSchema = z.object({
  clientId: z.number().int().positive().nullable().optional(),
  issueDate: z.string().min(1),
  expiryDate: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  taxRate: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  terms: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item'),
});

export const updateQuoteSchema = createQuoteSchema.partial();

// ---- Payment ----
export const createPaymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z.string().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  reference: optionalString(255),
  bankAccountId: z.number().int().positive().nullable().optional(),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
});

// ---- Recurring Invoice ----
export const createRecurringSchema = z.object({
  clientId: z.number().int().positive(),
  frequency: z.enum(RECURRING_FREQUENCIES),
  startDate: z.string().min(1),
  endDate: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  taxRate: z.number().min(0).max(100).default(0),
  isTaxable: z.boolean().default(false),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  terms: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  autoSend: z.boolean().default(false),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item'),
});

// ---- Settings ----
export const updateSettingsSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  businessEmail: z.string().email().max(255).optional(),
  businessPhone: optionalString(50),
  businessAddress: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  taxId: optionalString(100),
  logoUrl: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  defaultCurrency: z.enum(CURRENCIES).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  defaultPaymentTerms: z.number().int().positive().optional(),
  invoicePrefix: z.string().max(10).optional(),
  exemptInvoicePrefix: z.string().max(10).optional(),
  quotePrefix: z.string().max(10).optional(),
  jofotaraClientId: optionalString(100),
  jofotaraClientSecret: emptyToNull.pipe(z.string().nullable())
    .nullable().optional(),
  jofotaraCompanyTin: optionalString(50),
  jofotaraIncomeSourceSequence: optionalString(50),
  jofotaraInvoiceType: z.enum(JOFOTARA_INVOICE_TYPES).optional(),
  jofotaraEnabled: z.boolean().optional(),
  bankEtihadUsername: optionalString(100),
  bankEtihadEnabled: z.boolean().optional(),
  paypalClientId: optionalString(255),
  paypalClientSecret: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  paypalEnvironment: z.enum(['sandbox', 'live']).optional(),
  paypalEnabled: z.boolean().optional(),
  geminiApiKey: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  emailProvider: z.enum(['resend', 'smtp']).optional(),
  resendApiKey: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  smtpHost: optionalString(255),
  smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
  smtpUsername: optionalString(255),
  smtpPassword: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  smtpSecure: z.boolean().optional(),
  filingStatus: z.enum(FILING_STATUSES).optional(),
  personalExemption: z.number().min(0).optional(),
  familyExemption: z.number().min(0).optional(),
  additionalExemptions: z.number().min(0).max(3000).optional(),
});

export const sendTestEmailSchema = z.object({
  to: z.string().email('Valid email is required'),
});

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

// ---- User Management ----
export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Valid email is required').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(USER_ROLES).default('accountant'),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// ---- AI ----
export const aiGenerateInvoiceSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(2000),
});

export const aiSuggestLineItemsSchema = z.object({
  clientId: z.number().int().positive(),
  partialDescription: z.string().optional(),
});

export const aiDraftEmailSchema = z.object({
  invoiceId: z.number().int().positive().optional(),
  quoteId: z.number().int().positive().optional(),
  context: z.enum(['send', 'reminder', 'followup']),
});

export const aiSearchSchema = z.object({
  query: z.string().min(1).max(500),
});

// ---- Bank Account ----
export const createBankAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(255),
  bankName: optionalString(255),
  accountNumber: optionalString(50),
  currency: z.enum(CURRENCIES).default('USD'),
  initialBalance: z.number().default(0),
  isActive: z.boolean().default(true),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  provider: z.enum(BANK_ACCOUNT_PROVIDERS).default('manual'),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

export const syncBankAccountSchema = z.object({
  fromDate: z.string().min(1, 'Start date is required'),
  toDate: z.string().min(1, 'End date is required'),
});

// ---- Transaction ----
export const createTransactionSchema = z.object({
  bankAccountId: z.number().int().positive(),
  type: z.enum(TRANSACTION_TYPES),
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z.number().positive('Amount must be positive'),
  date: z.string().min(1),
  description: z.string().min(1, 'Description is required').max(500),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  taxAmount: z.number().min(0).nullable().optional(),
  supplierName: optionalString(255),
  invoiceReference: optionalString(255),
});

export const updateTransactionSchema = createTransactionSchema.partial();

// ---- JoFotara ----
export const jofotaraSubmitSchema = z.object({
  paymentMethod: z.enum(['cash', 'receivable']),
  invoiceType: z.enum(JOFOTARA_INVOICE_TYPES).optional(),
});

export const jofotaraCreditSchema = z.object({
  originalInvoiceId: z.number().int().positive(),
  reasonForReturn: z.string().min(1, 'Reason is required').max(500),
});

export const batchCreateTransactionsSchema = z.object({
  bankAccountId: z.number().int().positive(),
  transactions: z.array(z.object({
    type: z.enum(TRANSACTION_TYPES),
    category: z.enum(TRANSACTION_CATEGORIES),
    amount: z.number().positive(),
    date: z.string().min(1),
    description: z.string().min(1).max(500),
    notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
    taxAmount: z.number().min(0).nullable().optional(),
    supplierName: optionalString(255),
    invoiceReference: optionalString(255),
  })).min(1, 'At least one transaction required'),
});

// ---- Employee ----
export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: optionalEmail(),
  phone: optionalString(50),
  role: z.string().min(1, 'Role is required').max(100),
  baseSalary: z.number().min(0, 'Salary must be non-negative'),
  transportAllowance: z.number().min(0).default(0),
  sskEnrolled: z.boolean().default(false),
  hireDate: z.string().min(1, 'Hire date is required'),
  endDate: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  bankAccountName: optionalString(255),
  bankIban: optionalString(50),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// ---- Payroll Run ----
export const createPayrollRunSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  standardWorkingDays: z.number().int().min(1).max(31).default(26),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  duplicateFromRunId: z.number().int().positive().optional(),
});

// ---- Payroll Entry ----
export const updatePayrollEntrySchema = z.object({
  workingDays: z.number().int().min(0).max(31).optional(),
  weekdayOvertimeHours: z.number().min(0).optional(),
  weekendOvertimeHours: z.number().min(0).optional(),
  bonus: z.number().min(0).optional(),
  salaryDifference: z.number().optional(),
  salaryAdvance: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).optional(),
  otherDeductionsNote: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
});

// ---- Payroll Payment ----
export const updatePayrollPaymentSchema = z.object({
  paymentStatus: z.enum(PAYROLL_PAYMENT_STATUSES),
  paymentDate: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  bankTrxReference: optionalString(255),
  bankAccountId: z.number().int().positive().nullable().optional(),
});

// ---- Email Template ----
export const updateEmailTemplateSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  headerColor: z.string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
    .nullable()
    .optional(),
});

// ---- Bank Sync ----
export const bankLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const bankOtpSchema = z.object({
  otp: z.string().min(4, 'OTP is required').max(10),
});

export const bankSyncSchema = z.object({
  bankAccountId: z.number().int().positive(),
  fromDate: z.string().min(1, 'Start date is required'),
  toDate: z.string().min(1, 'End date is required'),
});

// ---- Partner Expense Category ----
export const createPartnerExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  nameEn: optionalString(255),
  defaultSplitPercent: z.number().min(0).max(100),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const updatePartnerExpenseCategorySchema =
  createPartnerExpenseCategorySchema.partial();

// ---- Partner Expense ----
export const createPartnerExpenseSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required').max(500),
  totalAmount: z.number().min(0, 'Amount must be non-negative'),
  splitPercent: z.number().min(0).max(100),
  partnerShare: z.number().min(0, 'Partner share must be non-negative'),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
});

export const updatePartnerExpenseSchema =
  createPartnerExpenseSchema.partial();

// ---- Partner Payment ----
export const createPartnerPaymentSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  amount: z.number().positive('Amount must be positive'),
  description: optionalString(500),
  paymentMethod: z.enum(PARTNER_EXPENSE_PAYMENT_METHODS)
    .nullable().optional(),
  reference: optionalString(255),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
});

export const updatePartnerPaymentSchema =
  createPartnerPaymentSchema.partial();

// ---- Partner Employee ----
export const createPartnerEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  sskMonthlyAmount: z.number().min(0, 'Amount must be non-negative'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  isActive: z.boolean().default(true),
  notes: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
});

export const updatePartnerEmployeeSchema =
  createPartnerEmployeeSchema.partial();

// ---- Partner SSK Generation ----
export const generatePartnerSskSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const updatePartnerSskSchema = z.object({
  isPaid: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  totalAmount: z.number().positive().optional(),
});

// ---- Bank Transfer ----
export const createBankTransferSchema = z.object({
  fromAccountId: z.number().int().positive(),
  toAccountId: z.number().int().positive(),
  amount: z.number().positive('Amount must be positive'),
  date: z.string().min(1, 'Date is required'),
  reference: optionalString(255),
  description: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: 'Source and destination accounts must be different',
  path: ['toAccountId'],
});

export const updateBankTransferSchema = z.object({
  fromAccountId: z.number().int().positive().optional(),
  toAccountId: z.number().int().positive().optional(),
  amount: z.number().positive().optional(),
  date: z.string().min(1).optional(),
  reference: optionalString(255),
  description: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  status: z.enum(TRANSFER_STATUSES).optional(),
});

// ---- Bank Deposit ----
const depositItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  checkNumber: z.string().optional(),
});

export const createBankDepositSchema = z.object({
  bankAccountId: z.number().int().positive(),
  amount: z.number().positive('Amount must be positive'),
  depositDate: z.string().min(1, 'Deposit date is required'),
  depositMethod: z.enum(DEPOSIT_METHODS),
  reference: optionalString(255),
  description: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  memo: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  depositItems: z.array(depositItemSchema).nullable().optional(),
});

export const updateBankDepositSchema = z.object({
  bankAccountId: z.number().int().positive().optional(),
  amount: z.number().positive().optional(),
  depositDate: z.string().min(1).optional(),
  depositMethod: z.enum(DEPOSIT_METHODS).optional(),
  reference: optionalString(255),
  description: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  memo: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  status: z.enum(DEPOSIT_STATUSES).optional(),
  depositItems: z.array(depositItemSchema).nullable().optional(),
});

// ---- Journal Entry ----
const journalEntryLineSchema = z.object({
  accountId: z.number().int().positive(),
  description: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  debitAmount: z.number().min(0).default(0),
  creditAmount: z.number().min(0).default(0),
}).refine(
  (data) => data.debitAmount > 0 || data.creditAmount > 0,
  { message: 'Each line must have a debit or credit amount', path: ['debitAmount'] },
).refine(
  (data) => !(data.debitAmount > 0 && data.creditAmount > 0),
  { message: 'A line cannot have both debit and credit amounts', path: ['creditAmount'] },
);

export const createJournalEntrySchema = z.object({
  entryDate: z.string().min(1, 'Entry date is required'),
  reference: optionalString(255),
  description: z.string().min(1, 'Description is required').max(500),
  memo: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  lines: z.array(journalEntryLineSchema).min(2, 'At least two lines required'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((s, l) => s + (l.debitAmount || 0), 0);
    const totalCredit = data.lines.reduce((s, l) => s + (l.creditAmount || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits', path: ['lines'] },
);

export const updateJournalEntrySchema = z.object({
  entryDate: z.string().min(1).optional(),
  reference: optionalString(255),
  description: z.string().min(1).max(500).optional(),
  memo: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  lines: z.array(journalEntryLineSchema).min(2).optional(),
});

// ---- Chart of Accounts ----
export const createAccountSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(255),
  nameAr: optionalString(255),
  type: z.enum(ACCOUNT_TYPES),
  parentId: z.number().int().positive().nullable().optional(),
  description: emptyToNull.pipe(z.string().nullable()).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateAccountSchema = createAccountSchema.partial();
