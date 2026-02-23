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
import { clients } from './clients.js';
import { users } from './users.js';

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
  isCreditNote: boolean('is_credit_note').notNull().default(false),
  originalInvoiceId: integer('original_invoice_id'),
  creditNoteReason: text('credit_note_reason'),
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
  index('idx_invoices_original_invoice').on(table.originalInvoiceId),
]);

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

export const invoiceNumberChanges = pgTable('invoice_number_changes', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  oldNumber: varchar('old_number', { length: 50 }).notNull(),
  newNumber: varchar('new_number', { length: 50 }).notNull(),
  reason: text('reason').notNull(),
  invoiceStatus: varchar('invoice_status', { length: 20 }).notNull(),
  changedBy: integer('changed_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_inv_number_changes_invoice').on(table.invoiceId),
  index('idx_inv_number_changes_created').on(table.createdAt),
]);

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
