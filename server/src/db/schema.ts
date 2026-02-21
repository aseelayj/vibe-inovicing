import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---- Settings ----
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  businessName: varchar('business_name', { length: 255 }).notNull()
    .default('My Business'),
  businessEmail: varchar('business_email', { length: 255 }).notNull()
    .default('hello@example.com'),
  businessPhone: varchar('business_phone', { length: 50 }),
  businessAddress: text('business_address'),
  taxId: varchar('tax_id', { length: 100 }),
  logoUrl: text('logo_url'),
  defaultCurrency: varchar('default_currency', { length: 3 })
    .notNull().default('USD'),
  defaultTaxRate: decimal('default_tax_rate', {
    precision: 5, scale: 2,
  }).notNull().default('0'),
  defaultPaymentTerms: integer('default_payment_terms')
    .notNull().default(30),
  invoicePrefix: varchar('invoice_prefix', { length: 10 })
    .notNull().default('INV'),
  nextInvoiceNumber: integer('next_invoice_number')
    .notNull().default(1),
  exemptInvoicePrefix: varchar('exempt_invoice_prefix', { length: 10 })
    .notNull().default('EINV'),
  nextExemptInvoiceNumber: integer('next_exempt_invoice_number')
    .notNull().default(1),
  quotePrefix: varchar('quote_prefix', { length: 10 })
    .notNull().default('QUO'),
  nextQuoteNumber: integer('next_quote_number')
    .notNull().default(1),
  jofotaraClientId: varchar('jofotara_client_id', { length: 100 }),
  jofotaraClientSecret: text('jofotara_client_secret'),
  jofotaraCompanyTin: varchar('jofotara_company_tin', { length: 50 }),
  jofotaraIncomeSourceSequence: varchar(
    'jofotara_income_source_sequence', { length: 50 },
  ),
  jofotaraInvoiceType: varchar('jofotara_invoice_type', { length: 20 })
    .notNull().default('general_sales'),
  jofotaraEnabled: boolean('jofotara_enabled').notNull().default(false),
  bankEtihadUsername: varchar('bank_etihad_username', { length: 100 }),
  bankEtihadEnabled: boolean('bank_etihad_enabled').notNull().default(false),
  filingStatus: varchar('filing_status', { length: 20 })
    .notNull().default('single'),
  personalExemption: decimal('personal_exemption', {
    precision: 10, scale: 2,
  }).notNull().default('9000'),
  familyExemption: decimal('family_exemption', {
    precision: 10, scale: 2,
  }).notNull().default('9000'),
  additionalExemptions: decimal('additional_exemptions', {
    precision: 10, scale: 2,
  }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---- Clients ----
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 255 }),
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }),
  taxId: varchar('tax_id', { length: 50 }),
  cityCode: varchar('city_code', { length: 10 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_clients_name').on(table.name),
  index('idx_clients_email').on(table.email),
]);

// ---- Invoices ----
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 50 })
    .notNull().unique(),
  clientId: integer('client_id').references(() => clients.id, {
    onDelete: 'set null',
  }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  issueDate: date('issue_date').notNull().defaultNow(),
  dueDate: date('due_date').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 })
    .notNull().default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 })
    .notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 })
    .notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 })
    .notNull().default('0'),
  total: decimal('total', { precision: 12, scale: 2 })
    .notNull().default('0'),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 })
    .notNull().default('0'),
  notes: text('notes'),
  terms: text('terms'),
  isTaxable: boolean('is_taxable').notNull().default(false),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurringId: integer('recurring_id'),
  sentAt: timestamp('sent_at'),
  paidAt: timestamp('paid_at'),
  jofotaraUuid: varchar('jofotara_uuid', { length: 100 }),
  jofotaraStatus: varchar('jofotara_status', { length: 30 })
    .notNull().default('not_submitted'),
  jofotaraQrCode: text('jofotara_qr_code'),
  jofotaraInvoiceNumber: varchar('jofotara_invoice_number', { length: 100 }),
  jofotaraSubmittedAt: timestamp('jofotara_submitted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_invoices_client_id').on(table.clientId),
  index('idx_invoices_status').on(table.status),
  index('idx_invoices_due_date').on(table.dueDate),
  index('idx_invoices_issue_date').on(table.issueDate),
]);

// ---- Invoice Line Items ----
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 })
    .notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---- Quotes ----
export const quotes = pgTable('quotes', {
  id: serial('id').primaryKey(),
  quoteNumber: varchar('quote_number', { length: 50 })
    .notNull().unique(),
  clientId: integer('client_id').references(() => clients.id, {
    onDelete: 'set null',
  }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  issueDate: date('issue_date').notNull().defaultNow(),
  expiryDate: date('expiry_date'),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 })
    .notNull().default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 })
    .notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 })
    .notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 })
    .notNull().default('0'),
  total: decimal('total', { precision: 12, scale: 2 })
    .notNull().default('0'),
  notes: text('notes'),
  terms: text('terms'),
  convertedInvoiceId: integer('converted_invoice_id'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_quotes_client_id').on(table.clientId),
  index('idx_quotes_status').on(table.status),
]);

// ---- Quote Line Items ----
export const quoteLineItems = pgTable('quote_line_items', {
  id: serial('id').primaryKey(),
  quoteId: integer('quote_id').notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 500 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 })
    .notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---- Payments ----
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull().defaultNow(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  reference: varchar('reference', { length: 255 }),
  bankAccountId: integer('bank_account_id')
    .references(() => bankAccounts.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_payments_invoice_id').on(table.invoiceId),
]);

// ---- Recurring Invoices ----
export const recurringInvoices = pgTable('recurring_invoices', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  frequency: varchar('frequency', { length: 20 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  nextRunDate: date('next_run_date').notNull(),
  lastRunDate: date('last_run_date'),
  isActive: boolean('is_active').notNull().default(true),
  isTaxable: boolean('is_taxable').notNull().default(false),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 })
    .notNull().default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 })
    .notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 })
    .notNull().default('0'),
  total: decimal('total', { precision: 12, scale: 2 })
    .notNull().default('0'),
  notes: text('notes'),
  terms: text('terms'),
  autoSend: boolean('auto_send').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---- Recurring Invoice Line Items ----
export const recurringInvoiceLineItems = pgTable(
  'recurring_invoice_line_items',
  {
    id: serial('id').primaryKey(),
    recurringInvoiceId: integer('recurring_invoice_id').notNull()
      .references(() => recurringInvoices.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: decimal('quantity', { precision: 10, scale: 2 })
      .notNull().default('1'),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 })
      .notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
);

// ---- Email Log ----
export const emailLog = pgTable('email_log', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .references(() => invoices.id, { onDelete: 'set null' }),
  quoteId: integer('quote_id')
    .references(() => quotes.id, { onDelete: 'set null' }),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body'),
  status: varchar('status', { length: 20 }).notNull().default('sent'),
  resendId: varchar('resend_id', { length: 255 }),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
});

// ---- Bank Accounts ----
export const bankAccounts = pgTable('bank_accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }),
  accountNumber: varchar('account_number', { length: 50 }),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  initialBalance: decimal('initial_balance', { precision: 12, scale: 2 })
    .notNull().default('0'),
  currentBalance: decimal('current_balance', { precision: 12, scale: 2 })
    .notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  bankEtihadLinked: boolean('bank_etihad_linked').notNull().default(false),
  lastSyncAt: timestamp('last_sync_at'),
  lastSyncStatus: varchar('last_sync_status', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---- Bank Sessions (for bank portal auth tokens) ----
export const bankSessions = pgTable('bank_sessions', {
  id: serial('id').primaryKey(),
  provider: varchar('provider', { length: 50 }).notNull()
    .default('bank_al_etihad'),
  token: text('token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---- Transactions ----
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  bankAccountId: integer('bank_account_id').notNull()
    .references(() => bankAccounts.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  date: date('date').notNull().defaultNow(),
  description: varchar('description', { length: 500 }).notNull(),
  notes: text('notes'),
  bankReference: varchar('bank_reference', { length: 255 }),
  bankSyncedAt: timestamp('bank_synced_at'),
  isFromBank: boolean('is_from_bank').notNull().default(false),
  taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }),
  supplierName: varchar('supplier_name', { length: 255 }),
  invoiceReference: varchar('invoice_reference', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_transactions_bank_account_id').on(table.bankAccountId),
  index('idx_transactions_type').on(table.type),
  index('idx_transactions_date').on(table.date),
  index('idx_transactions_category').on(table.category),
  index('idx_transactions_bank_reference').on(table.bankReference),
]);

// ---- Conversations ----
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull().default('New Chat'),
  pageContext: jsonb('page_context'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---- Chat Messages ----
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content'),
  toolCall: jsonb('tool_call'),
  toolResult: jsonb('tool_result'),
  actionStatus: varchar('action_status', { length: 20 }),
  attachments: jsonb('attachments'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_chat_messages_conversation').on(table.conversationId),
]);

// ---- JoFotara Submissions ----
export const jofotaraSubmissions = pgTable('jofotara_submissions', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  uuid: varchar('uuid', { length: 100 }),
  status: varchar('status', { length: 30 }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  qrCode: text('qr_code'),
  xmlContent: text('xml_content'),
  rawResponse: jsonb('raw_response'),
  errorMessage: text('error_message'),
  isCreditInvoice: boolean('is_credit_invoice').notNull().default(false),
  originalInvoiceId: varchar('original_invoice_id', { length: 100 }),
  reasonForReturn: text('reason_for_return'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_jofotara_submissions_invoice').on(table.invoiceId),
]);

// ---- Activity Log ----
export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_activity_entity').on(table.entityType, table.entityId),
  index('idx_activity_created').on(table.createdAt),
]);

// ---- Relations ----
export const clientsRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
  quotes: many(quotes),
  recurringInvoices: many(recurringInvoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  lineItems: many(invoiceLineItems),
  payments: many(payments),
  jofotaraSubmissions: many(jofotaraSubmissions),
}));

export const jofotaraSubmissionsRelations = relations(
  jofotaraSubmissions,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [jofotaraSubmissions.invoiceId],
      references: [invoices.id],
    }),
  }),
);

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
  }),
);

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  lineItems: many(quoteLineItems),
}));

export const quoteLineItemsRelations = relations(
  quoteLineItems,
  ({ one }) => ({
    quote: one(quotes, {
      fields: [quoteLineItems.quoteId],
      references: [quotes.id],
    }),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [payments.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export const recurringInvoicesRelations = relations(
  recurringInvoices,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [recurringInvoices.clientId],
      references: [clients.id],
    }),
    lineItems: many(recurringInvoiceLineItems),
  }),
);

export const recurringInvoiceLineItemsRelations = relations(
  recurringInvoiceLineItems,
  ({ one }) => ({
    recurringInvoice: one(recurringInvoices, {
      fields: [recurringInvoiceLineItems.recurringInvoiceId],
      references: [recurringInvoices.id],
    }),
  }),
);

export const bankAccountsRelations = relations(
  bankAccounts,
  ({ many }) => ({
    transactions: many(transactions),
  }),
);

export const conversationsRelations = relations(
  conversations,
  ({ many }) => ({
    messages: many(chatMessages),
  }),
);

export const chatMessagesRelations = relations(
  chatMessages,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [chatMessages.conversationId],
      references: [conversations.id],
    }),
  }),
);

export const transactionsRelations = relations(
  transactions,
  ({ one }) => ({
    bankAccount: one(bankAccounts, {
      fields: [transactions.bankAccountId],
      references: [bankAccounts.id],
    }),
  }),
);
