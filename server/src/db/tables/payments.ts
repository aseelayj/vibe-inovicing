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
import { invoices } from './invoices.js';
import { bankAccounts } from './banking.js';

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
