import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  boolean,
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
