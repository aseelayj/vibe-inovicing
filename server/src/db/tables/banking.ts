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
import { accounts } from './accounting.js';

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
  provider: varchar('provider', { length: 50 }).notNull().default('manual'),
  lastSyncAt: timestamp('last_sync_at'),
  lastSyncStatus: varchar('last_sync_status', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const bankSessions = pgTable('bank_sessions', {
  id: serial('id').primaryKey(),
  bankAccountId: integer('bank_account_id')
    .references(() => bankAccounts.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull()
    .default('bank_al_etihad'),
  token: text('token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
  accountId: integer('account_id').references(() => accounts.id),
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
  index('idx_transactions_account_id').on(table.accountId),
]);
