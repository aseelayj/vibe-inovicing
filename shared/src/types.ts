import type {
  InvoiceStatus,
  QuoteStatus,
  PaymentMethod,
  RecurringFrequency,
  Currency,
} from './constants';

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
  isRecurring: boolean;
  recurringId: number | null;
  sentAt: string | null;
  paidAt: string | null;
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
  quotePrefix: string;
  nextQuoteNumber: number;
}

// ---- Dashboard ----
export interface DashboardStats {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  totalInvoices: number;
  totalClients: number;
  paidThisMonth: number;
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
  createdAt: string;
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
