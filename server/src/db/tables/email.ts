import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { invoices } from './invoices.js';
import { quotes } from './quotes.js';

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
  openedAt: timestamp('opened_at'),
  clickedAt: timestamp('clicked_at'),
  openCount: integer('open_count').notNull().default(0),
  clickCount: integer('click_count').notNull().default(0),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
});

export const emailTemplates = pgTable('email_templates', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 20 }).notNull().unique(),
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body').notNull(),
  headerColor: varchar('header_color', { length: 7 }),
  isCustomized: boolean('is_customized').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const emailTrackingEvents = pgTable('email_tracking_events', {
  id: serial('id').primaryKey(),
  emailLogId: integer('email_log_id').notNull()
    .references(() => emailLog.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 20 }).notNull(),
  url: text('url'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_tracking_events_email_log').on(table.emailLogId),
]);
