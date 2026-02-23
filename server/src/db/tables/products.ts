import {
  pgTable,
  serial,
  varchar,
  decimal,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  category: varchar('category', { length: 100 }),
  type: varchar('type', { length: 20 }).notNull().default('service'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_products_name').on(table.name),
  index('idx_products_category').on(table.category),
  index('idx_products_active').on(table.isActive),
]);
