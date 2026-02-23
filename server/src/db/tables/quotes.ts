import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients.js';

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
