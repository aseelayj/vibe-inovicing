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
  quotePrefix: varchar('quote_prefix', { length: 10 })
    .notNull().default('QUO'),
  nextQuoteNumber: integer('next_quote_number')
    .notNull().default(1),
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
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurringId: integer('recurring_id'),
  sentAt: timestamp('sent_at'),
  paidAt: timestamp('paid_at'),
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
}));

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
