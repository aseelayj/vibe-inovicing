/**
 * Database Schema - Barrel Export
 *
 * All table definitions are organized into domain-specific files under ./tables/.
 * This file re-exports everything so that existing imports (e.g.,
 * `import { invoices } from '../db/schema.js'`) continue to work unchanged.
 */

// Tables
export { settings } from './tables/settings.js';
export { clients } from './tables/clients.js';
export { invoices, invoiceLineItems, invoiceNumberChanges, jofotaraSubmissions } from './tables/invoices.js';
export { quotes, quoteLineItems } from './tables/quotes.js';
export { payments } from './tables/payments.js';
export { recurringInvoices, recurringInvoiceLineItems } from './tables/recurring.js';
export { emailLog, emailTemplates, emailTrackingEvents } from './tables/email.js';
export { bankAccounts, bankSessions, transactions } from './tables/banking.js';
export { conversations, chatMessages } from './tables/chat.js';
export { users, activityLog } from './tables/users.js';
export { employees, payrollRuns, payrollEntries } from './tables/payroll.js';
export {
  partnerExpenseCategories,
  partnerExpenses,
  partnerPayments,
  partnerEmployees,
  partnerSskEntries,
} from './tables/partners.js';
export { accounts, commitments, journalEntries, journalEntryLines } from './tables/accounting.js';
export { products } from './tables/products.js';

// Relations
export {
  clientsRelations,
  invoicesRelations,
  invoiceNumberChangesRelations,
  jofotaraSubmissionsRelations,
  invoiceLineItemsRelations,
  quotesRelations,
  quoteLineItemsRelations,
  paymentsRelations,
  recurringInvoicesRelations,
  recurringInvoiceLineItemsRelations,
  bankAccountsRelations,
  transactionsRelations,
  conversationsRelations,
  chatMessagesRelations,
  emailLogRelations,
  emailTrackingEventsRelations,
  usersRelations,
  activityLogRelations,
  employeesRelations,
  payrollRunsRelations,
  payrollEntriesRelations,
  partnerExpenseCategoriesRelations,
  partnerExpensesRelations,
  accountsRelations,
  journalEntriesRelations,
  journalEntryLinesRelations,
} from './tables/relations.js';
