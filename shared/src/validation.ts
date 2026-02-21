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
} from './constants';

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
  filingStatus: z.enum(FILING_STATUSES).optional(),
  personalExemption: z.number().min(0).optional(),
  familyExemption: z.number().min(0).optional(),
  additionalExemptions: z.number().min(0).max(3000).optional(),
});

// ---- Auth ----
export const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
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
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

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
