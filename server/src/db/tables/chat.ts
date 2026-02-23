import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull().default('New Chat'),
  pageContext: jsonb('page_context'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content'),
  toolCall: jsonb('tool_call'),
  toolResult: jsonb('tool_result'),
  actionStatus: varchar('action_status', { length: 20 }),
  attachments: jsonb('attachments'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_chat_messages_conversation').on(table.conversationId),
]);
