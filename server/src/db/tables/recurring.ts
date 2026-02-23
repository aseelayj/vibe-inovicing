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
} from 'drizzle-orm/pg-core';
import { clients } from './clients.js';

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
