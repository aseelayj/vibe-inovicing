import { relations } from 'drizzle-orm';
import { clients } from './clients.js';
import { invoices, invoiceLineItems, invoiceNumberChanges, jofotaraSubmissions } from './invoices.js';
import { quotes, quoteLineItems } from './quotes.js';
import { payments } from './payments.js';
import { recurringInvoices, recurringInvoiceLineItems } from './recurring.js';
import { emailLog, emailTrackingEvents } from './email.js';
import { bankAccounts, transactions } from './banking.js';
import { conversations, chatMessages } from './chat.js';
import { users, activityLog } from './users.js';
import { employees, payrollRuns, payrollEntries } from './payroll.js';
import { partnerExpenseCategories, partnerExpenses } from './partners.js';
import { accounts } from './accounting.js';

// ---- Client Relations ----
export const clientsRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
  quotes: many(quotes),
  recurringInvoices: many(recurringInvoices),
}));

// ---- Invoice Relations ----
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  originalInvoice: one(invoices, {
    fields: [invoices.originalInvoiceId],
    references: [invoices.id],
    relationName: 'creditNotes',
  }),
  creditNotes: many(invoices, { relationName: 'creditNotes' }),
  lineItems: many(invoiceLineItems),
  payments: many(payments),
  jofotaraSubmissions: many(jofotaraSubmissions),
  numberChanges: many(invoiceNumberChanges),
}));

export const invoiceNumberChangesRelations = relations(
  invoiceNumberChanges,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceNumberChanges.invoiceId],
      references: [invoices.id],
    }),
    user: one(users, {
      fields: [invoiceNumberChanges.changedBy],
      references: [users.id],
    }),
  }),
);

export const jofotaraSubmissionsRelations = relations(
  jofotaraSubmissions,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [jofotaraSubmissions.invoiceId],
      references: [invoices.id],
    }),
  }),
);

export const invoiceLineItemsRelations = relations(
  invoiceLineItems,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [invoiceLineItems.invoiceId],
      references: [invoices.id],
    }),
  }),
);

// ---- Quote Relations ----
export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  lineItems: many(quoteLineItems),
}));

export const quoteLineItemsRelations = relations(
  quoteLineItems,
  ({ one }) => ({
    quote: one(quotes, {
      fields: [quoteLineItems.quoteId],
      references: [quotes.id],
    }),
  }),
);

// ---- Payment Relations ----
export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [payments.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

// ---- Recurring Relations ----
export const recurringInvoicesRelations = relations(
  recurringInvoices,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [recurringInvoices.clientId],
      references: [clients.id],
    }),
    lineItems: many(recurringInvoiceLineItems),
  }),
);

export const recurringInvoiceLineItemsRelations = relations(
  recurringInvoiceLineItems,
  ({ one }) => ({
    recurringInvoice: one(recurringInvoices, {
      fields: [recurringInvoiceLineItems.recurringInvoiceId],
      references: [recurringInvoices.id],
    }),
  }),
);

// ---- Banking Relations ----
export const bankAccountsRelations = relations(
  bankAccounts,
  ({ many }) => ({
    transactions: many(transactions),
  }),
);

export const transactionsRelations = relations(
  transactions,
  ({ one }) => ({
    bankAccount: one(bankAccounts, {
      fields: [transactions.bankAccountId],
      references: [bankAccounts.id],
    }),
  }),
);

// ---- Chat Relations ----
export const conversationsRelations = relations(
  conversations,
  ({ many }) => ({
    messages: many(chatMessages),
  }),
);

export const chatMessagesRelations = relations(
  chatMessages,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [chatMessages.conversationId],
      references: [conversations.id],
    }),
  }),
);

// ---- Email Relations ----
export const emailLogRelations = relations(emailLog, ({ many }) => ({
  trackingEvents: many(emailTrackingEvents),
}));

export const emailTrackingEventsRelations = relations(
  emailTrackingEvents,
  ({ one }) => ({
    emailLog: one(emailLog, {
      fields: [emailTrackingEvents.emailLogId],
      references: [emailLog.id],
    }),
  }),
);

// ---- User Relations ----
export const usersRelations = relations(users, ({ many }) => ({
  activityLogs: many(activityLog),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

// ---- Payroll Relations ----
export const employeesRelations = relations(employees, ({ many }) => ({
  payrollEntries: many(payrollEntries),
}));

export const payrollRunsRelations = relations(
  payrollRuns,
  ({ many }) => ({
    entries: many(payrollEntries),
  }),
);

export const payrollEntriesRelations = relations(
  payrollEntries,
  ({ one }) => ({
    payrollRun: one(payrollRuns, {
      fields: [payrollEntries.payrollRunId],
      references: [payrollRuns.id],
    }),
    employee: one(employees, {
      fields: [payrollEntries.employeeId],
      references: [employees.id],
    }),
    bankAccount: one(bankAccounts, {
      fields: [payrollEntries.bankAccountId],
      references: [bankAccounts.id],
    }),
  }),
);

// ---- Partner Relations ----
export const partnerExpenseCategoriesRelations = relations(
  partnerExpenseCategories,
  ({ many }) => ({
    expenses: many(partnerExpenses),
  }),
);

export const partnerExpensesRelations = relations(
  partnerExpenses,
  ({ one }) => ({
    category: one(partnerExpenseCategories, {
      fields: [partnerExpenses.categoryId],
      references: [partnerExpenseCategories.id],
    }),
  }),
);

// ---- Accounting Relations ----
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: 'parentChild',
  }),
  children: many(accounts, { relationName: 'parentChild' }),
}));
