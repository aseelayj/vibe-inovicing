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
  index,
} from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  nameAr: varchar('name_ar', { length: 255 }),
  type: varchar('type', { length: 30 }).notNull(),
  parentId: integer('parent_id'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  balance: decimal('balance', { precision: 14, scale: 2 })
    .notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_accounts_code').on(table.code),
  index('idx_accounts_type').on(table.type),
  index('idx_accounts_parent_id').on(table.parentId),
]);

export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  entryNumber: varchar('entry_number', { length: 50 }).notNull().unique(),
  date: date('date').notNull().defaultNow(),
  description: varchar('description', { length: 500 }).notNull(),
  reference: varchar('reference', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_journal_entries_date').on(table.date),
  index('idx_journal_entries_status').on(table.status),
  index('idx_journal_entries_number').on(table.entryNumber),
]);

export const journalEntryLines = pgTable('journal_entry_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id').notNull()
    .references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').notNull()
    .references(() => accounts.id),
  description: varchar('description', { length: 500 }),
  debit: decimal('debit', { precision: 14, scale: 2 }).notNull().default('0'),
  credit: decimal('credit', { precision: 14, scale: 2 }).notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('idx_jel_journal_entry_id').on(table.journalEntryId),
  index('idx_jel_account_id').on(table.accountId),
]);

export const commitments = pgTable('commitments', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('JOD'),
  frequency: varchar('frequency', { length: 20 }).notNull().default('monthly'),
  dueDay: integer('due_day'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_commitments_category').on(table.category),
  index('idx_commitments_active').on(table.isActive),
]);
