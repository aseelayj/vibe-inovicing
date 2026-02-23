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
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const partnerExpenseCategories = pgTable('partner_expense_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  nameEn: varchar('name_en', { length: 255 }),
  defaultSplitPercent: decimal('default_split_percent', {
    precision: 5, scale: 2,
  }).notNull().default('50'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const partnerExpenses = pgTable('partner_expenses', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(
    () => partnerExpenseCategories.id, { onDelete: 'set null' },
  ),
  date: date('date').notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  splitPercent: decimal('split_percent', { precision: 5, scale: 2 }).notNull(),
  partnerShare: decimal('partner_share', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_partner_expenses_date').on(table.date),
  index('idx_partner_expenses_category').on(table.categoryId),
]);

export const partnerPayments = pgTable('partner_payments', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description: varchar('description', { length: 500 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  reference: varchar('reference', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const partnerEmployees = pgTable('partner_employees', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sskMonthlyAmount: decimal('ssk_monthly_amount', { precision: 12, scale: 2 })
    .notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const partnerSskEntries = pgTable('partner_ssk_entries', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  breakdown: jsonb('breakdown').notNull(),
  isPaid: boolean('is_paid').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_partner_ssk_year_month').on(table.year, table.month),
]);
