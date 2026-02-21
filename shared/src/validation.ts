import { z } from 'zod';
import {
  INVOICE_STATUSES,
  QUOTE_STATUSES,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
  CURRENCIES,
} from './constants';

// ---- Line Item ----
export const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Price must be non-negative'),
});

// ---- Client ----
export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company: z.string().max(255).nullable().optional(),
  addressLine1: z.string().max(255).nullable().optional(),
  addressLine2: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
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
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
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
  expiryDate: z.string().nullable().optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  taxRate: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item'),
});

export const updateQuoteSchema = createQuoteSchema.partial();

// ---- Payment ----
export const createPaymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z.string().min(1),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  reference: z.string().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ---- Recurring Invoice ----
export const createRecurringSchema = z.object({
  clientId: z.number().int().positive(),
  frequency: z.enum(RECURRING_FREQUENCIES),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  currency: z.enum(CURRENCIES).default('USD'),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  autoSend: z.boolean().default(false),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item'),
});

// ---- Settings ----
export const updateSettingsSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  businessEmail: z.string().email().max(255).optional(),
  businessPhone: z.string().max(50).nullable().optional(),
  businessAddress: z.string().nullable().optional(),
  taxId: z.string().max(100).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  defaultCurrency: z.enum(CURRENCIES).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  defaultPaymentTerms: z.number().int().positive().optional(),
  invoicePrefix: z.string().max(10).optional(),
  quotePrefix: z.string().max(10).optional(),
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
