import type { FunctionDeclaration, Type } from '@google/genai';
import { eq, ne, desc, asc, and, or, ilike, sql, count, sum, gte, lte, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  clients,
  invoices,
  invoiceLineItems,
  quotes,
  quoteLineItems,
  payments,
  recurringInvoices,
  recurringInvoiceLineItems,
  bankAccounts,
  bankSessions,
  transactions,
  settings,
  activityLog,
  emailLog,
  jofotaraSubmissions,
  employees,
  payrollRuns,
  payrollEntries,
  partnerExpenseCategories,
  partnerExpenses,
  partnerPayments,
  partnerEmployees,
  partnerSskEntries,
  products,
} from '../db/schema.js';
import { generateInvoicePdf } from './pdf.service.js';
import { sendInvoiceEmail, sendPaymentReminder } from './email.service.js';
import { sendQuoteEmail } from './email.service.js';
import { generateQuotePdf } from './pdf.service.js';
import { parseTransactionsFromText } from './ai.service.js';
import { recalculateBalance } from '../routes/bank-account.routes.js';
import {
  getPayPalAccessToken,
  fetchPayPalTransactions,
  mapPayPalTransactionToLocal,
} from './paypal.service.js';
import {
  submitInvoiceToJofotara,
  submitCreditInvoice,
  preValidateInvoice,
  getSubmissionHistory,
  getSubmissionXml,
} from './jofotara/index.js';
import {
  getBimonthlyPeriod,
  getCurrentBimonthlyPeriod,
  getYearBimonthlyPeriods,
  calculateIncomeTax,
  STANDARD_WORKING_DAYS,
} from '@vibe/shared';
import {
  calculatePayrollEntry,
  recalculatePayrollRunTotals,
} from './payroll.service.js';
import * as XLSX from 'xlsx';

// ---- Read-only tool names (auto-execute, no confirmation needed) ----
export const READ_ONLY_TOOLS = new Set([
  'list_clients',
  'get_client',
  'list_invoices',
  'get_invoice',
  'list_quotes',
  'get_quote',
  'list_payments',
  'list_recurring',
  'get_recurring',
  'list_bank_accounts',
  'get_bank_account',
  'list_transactions',
  'get_transaction',
  'get_settings',
  'get_dashboard_stats',
  'get_revenue_chart',
  'navigate_to',
  'get_activity_log',
  'get_email_log',
  'validate_for_jofotara',
  'get_jofotara_submissions',
  'get_sales_tax_report',
  'get_purchases_report',
  'get_gst_summary',
  'get_income_tax_report',
  'get_profit_loss_report',
  'get_tax_deadlines',
  'generate_export_link',
  'generate_quote_template',
  'list_employees',
  'get_employee',
  'list_payroll_runs',
  'get_payroll_run',
  'get_payroll_summary',
  'list_partner_expenses',
  'list_partner_payments',
  'get_partner_balance',
  'list_partner_ssk_entries',
  'list_partner_categories',
  'list_partner_employees',
  'list_products',
  'get_aging_report',
  'get_client_statement',
]);

// ---- Gemini function declarations ----
export const chatToolDeclarations: FunctionDeclaration[] = [
  // -- Clients --
  {
    name: 'list_clients',
    description: 'Search/list clients. ALWAYS call this when a user mentions a client name to resolve their ID before creating invoices/quotes.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        search: { type: 'STRING' as Type, description: 'Search by name or email (partial match)' },
      },
    },
  },
  {
    name: 'get_client',
    description: 'Get a single client by ID with their invoices and quotes',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Client ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_client',
    description: 'Create a new client',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        name: { type: 'STRING' as Type, description: 'Client name (required)' },
        email: { type: 'STRING' as Type, description: 'Email address' },
        phone: { type: 'STRING' as Type, description: 'Phone number' },
        company: { type: 'STRING' as Type, description: 'Company name' },
        addressLine1: { type: 'STRING' as Type, description: 'Address line 1' },
        city: { type: 'STRING' as Type, description: 'City' },
        state: { type: 'STRING' as Type, description: 'State/province' },
        postalCode: { type: 'STRING' as Type, description: 'Postal code' },
        country: { type: 'STRING' as Type, description: 'Country' },
        taxId: { type: 'STRING' as Type, description: 'Tax ID / TIN (required for JoFotara invoices)' },
        cityCode: { type: 'STRING' as Type, description: 'Jordan city code (e.g. JO-AM for Amman). Used for JoFotara.' },
        notes: { type: 'STRING' as Type, description: 'Notes' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_client',
    description: 'Update an existing client',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
        name: { type: 'STRING' as Type },
        email: { type: 'STRING' as Type },
        phone: { type: 'STRING' as Type },
        company: { type: 'STRING' as Type },
        addressLine1: { type: 'STRING' as Type },
        city: { type: 'STRING' as Type },
        state: { type: 'STRING' as Type },
        postalCode: { type: 'STRING' as Type },
        country: { type: 'STRING' as Type },
        taxId: { type: 'STRING' as Type, description: 'Tax ID / TIN' },
        cityCode: { type: 'STRING' as Type, description: 'Jordan city code (e.g. JO-AM)' },
        notes: { type: 'STRING' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_client',
    description: 'Delete a client by ID',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Client ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'batch_create_clients',
    description: 'Create multiple clients at once. Use when the user wants to add several clients in a single request.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        clients: {
          type: 'ARRAY' as Type,
          description: 'List of clients to create',
          items: {
            type: 'OBJECT' as Type,
            properties: {
              name: { type: 'STRING' as Type, description: 'Client name (required)' },
              email: { type: 'STRING' as Type, description: 'Email address' },
              phone: { type: 'STRING' as Type, description: 'Phone number' },
              company: { type: 'STRING' as Type, description: 'Company name' },
              taxId: { type: 'STRING' as Type, description: 'Tax ID / TIN' },
              cityCode: { type: 'STRING' as Type, description: 'Jordan city code' },
            },
            required: ['name'],
          },
        },
      },
      required: ['clients'],
    },
  },
  {
    name: 'batch_delete_clients',
    description: 'Delete multiple clients at once. Only clients with no invoices or quotes can be deleted.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        clientIds: {
          type: 'ARRAY' as Type,
          description: 'List of client IDs to delete',
          items: { type: 'INTEGER' as Type },
        },
      },
      required: ['clientIds'],
    },
  },
  // -- Invoices --
  {
    name: 'list_invoices',
    description: 'List invoices with optional filters (status, clientId, search)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        status: { type: 'STRING' as Type, description: 'Filter by status (draft, sent, paid, overdue, etc.)' },
        clientId: { type: 'INTEGER' as Type, description: 'Filter by client ID' },
        search: { type: 'STRING' as Type, description: 'Search by invoice number or client name' },
        page: { type: 'INTEGER' as Type, description: 'Page number (default 1)' },
        pageSize: { type: 'INTEGER' as Type, description: 'Items per page (default 20)' },
      },
    },
  },
  {
    name: 'get_invoice',
    description: 'Get a single invoice by ID with line items, client, and payments',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_invoice',
    description: 'Create a new invoice with line items. Use default currency/tax from settings if not specified. If user gives a single amount, use quantity=1 and that amount as unitPrice.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        clientId: { type: 'INTEGER' as Type, description: 'Client ID (look up via list_clients first)' },
        issueDate: { type: 'STRING' as Type, description: 'Issue date YYYY-MM-DD (default: today)' },
        dueDate: { type: 'STRING' as Type, description: 'Due date YYYY-MM-DD (default: issueDate + payment terms from settings)' },
        currency: { type: 'STRING' as Type, description: 'Currency code. Omit to use default from settings.' },
        isTaxable: { type: 'BOOLEAN' as Type, description: 'Whether this invoice is taxable (default: false). If true, taxRate defaults to 16%.' },
        taxRate: { type: 'NUMBER' as Type, description: 'Tax rate %. If isTaxable=true defaults to 16, otherwise 0. User can override.' },
        discountAmount: { type: 'NUMBER' as Type, description: 'Discount amount (default: 0)' },
        notes: { type: 'STRING' as Type, description: 'Invoice notes' },
        terms: { type: 'STRING' as Type, description: 'Payment terms text' },
        isWriteOff: { type: 'BOOLEAN' as Type, description: 'If true, creates a write-off invoice (WO-XXXX) with permanent written_off status. Used for bookkeeping only.' },
        lineItems: {
          type: 'ARRAY' as Type,
          description: 'Line items. For a single amount, use quantity=1.',
          items: {
            type: 'OBJECT' as Type,
            properties: {
              description: { type: 'STRING' as Type },
              quantity: { type: 'NUMBER' as Type },
              unitPrice: { type: 'NUMBER' as Type },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['clientId', 'issueDate', 'dueDate', 'lineItems'],
    },
  },
  {
    name: 'update_invoice',
    description: 'Update an existing invoice (fields + line items)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
        clientId: { type: 'INTEGER' as Type },
        issueDate: { type: 'STRING' as Type },
        dueDate: { type: 'STRING' as Type },
        currency: { type: 'STRING' as Type },
        taxRate: { type: 'NUMBER' as Type },
        discountAmount: { type: 'NUMBER' as Type },
        notes: { type: 'STRING' as Type },
        terms: { type: 'STRING' as Type },
        lineItems: {
          type: 'ARRAY' as Type,
          items: {
            type: 'OBJECT' as Type,
            properties: {
              description: { type: 'STRING' as Type },
              quantity: { type: 'NUMBER' as Type },
              unitPrice: { type: 'NUMBER' as Type },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_invoice',
    description: 'Delete an invoice by ID',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'batch_delete_invoices',
    description: 'Delete multiple invoices at once. Use when user says "delete all draft invoices" or wants to remove several invoices.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceIds: {
          type: 'ARRAY' as Type,
          description: 'List of invoice IDs to delete',
          items: { type: 'INTEGER' as Type },
        },
      },
      required: ['invoiceIds'],
    },
  },
  {
    name: 'update_invoice_status',
    description: 'Change an invoice status (draft, sent, paid, overdue, cancelled). Cannot change status of written_off invoices.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
        status: { type: 'STRING' as Type, description: 'New status' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'send_invoice_email',
    description: 'Send an invoice to the client via email. MUST provide a thoughtful draft for the subject and body.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
        subject: { type: 'STRING' as Type, description: 'Subject line draft' },
        body: { type: 'STRING' as Type, description: 'Email message draft' },
      },
      required: ['id', 'subject', 'body'],
    },
  },
  {
    name: 'send_invoice_reminder',
    description: 'Send a payment reminder email for an invoice',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
        subject: { type: 'STRING' as Type, description: 'Subject line draft' },
        body: { type: 'STRING' as Type, description: 'Email message draft' },
      },
      required: ['id'],
    },
  },
  {
    name: 'duplicate_invoice',
    description: 'Duplicate an existing invoice with a new invoice number',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID to duplicate' },
      },
      required: ['id'],
    },
  },
  // -- Quotes --
  {
    name: 'list_quotes',
    description: 'List quotes with optional filters',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        status: { type: 'STRING' as Type },
        clientId: { type: 'INTEGER' as Type },
        search: { type: 'STRING' as Type },
      },
    },
  },
  {
    name: 'get_quote',
    description: 'Get a single quote by ID with line items and client',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Quote ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_quote',
    description: 'Create a new quote with line items. Use default currency from settings if not specified.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        clientId: { type: 'INTEGER' as Type, description: 'Client ID (look up via list_clients first)' },
        issueDate: { type: 'STRING' as Type, description: 'Issue date YYYY-MM-DD (default: today)' },
        expiryDate: { type: 'STRING' as Type, description: 'Expiry date YYYY-MM-DD (default: 30 days from issue)' },
        currency: { type: 'STRING' as Type, description: 'Currency code. Omit to use default from settings.' },
        taxRate: { type: 'NUMBER' as Type },
        discountAmount: { type: 'NUMBER' as Type },
        notes: { type: 'STRING' as Type },
        terms: { type: 'STRING' as Type },
        lineItems: {
          type: 'ARRAY' as Type,
          items: {
            type: 'OBJECT' as Type,
            properties: {
              description: { type: 'STRING' as Type },
              quantity: { type: 'NUMBER' as Type },
              unitPrice: { type: 'NUMBER' as Type },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['clientId', 'issueDate', 'lineItems'],
    },
  },
  {
    name: 'update_quote',
    description: 'Update an existing quote',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
        clientId: { type: 'INTEGER' as Type },
        issueDate: { type: 'STRING' as Type },
        expiryDate: { type: 'STRING' as Type },
        currency: { type: 'STRING' as Type },
        taxRate: { type: 'NUMBER' as Type },
        discountAmount: { type: 'NUMBER' as Type },
        notes: { type: 'STRING' as Type },
        terms: { type: 'STRING' as Type },
        lineItems: {
          type: 'ARRAY' as Type,
          items: {
            type: 'OBJECT' as Type,
            properties: {
              description: { type: 'STRING' as Type },
              quantity: { type: 'NUMBER' as Type },
              unitPrice: { type: 'NUMBER' as Type },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_quote',
    description: 'Delete a quote by ID',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'batch_create_quotes',
    description: 'Create multiple quotes at once. Use when the user wants to create several quotes in a single request.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        quotes: {
          type: 'ARRAY' as Type,
          description: 'List of quotes to create',
          items: {
            type: 'OBJECT' as Type,
            properties: {
              clientId: { type: 'INTEGER' as Type, description: 'Client ID' },
              issueDate: { type: 'STRING' as Type, description: 'Issue date YYYY-MM-DD' },
              expiryDate: { type: 'STRING' as Type, description: 'Expiry date YYYY-MM-DD' },
              currency: { type: 'STRING' as Type, description: 'Currency code' },
              taxRate: { type: 'NUMBER' as Type },
              notes: { type: 'STRING' as Type },
              lineItems: {
                type: 'ARRAY' as Type,
                items: {
                  type: 'OBJECT' as Type,
                  properties: {
                    description: { type: 'STRING' as Type },
                    quantity: { type: 'NUMBER' as Type },
                    unitPrice: { type: 'NUMBER' as Type },
                  },
                  required: ['description', 'quantity', 'unitPrice'],
                },
              },
            },
            required: ['clientId', 'issueDate', 'lineItems'],
          },
        },
      },
      required: ['quotes'],
    },
  },
  {
    name: 'update_quote_status',
    description: 'Change a quote status (draft, sent, accepted, rejected, expired)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Quote ID' },
        status: { type: 'STRING' as Type, description: 'New status' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'send_quote_email',
    description: 'Send a quote to the client via email',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Quote ID' },
        subject: { type: 'STRING' as Type, description: 'Subject line draft' },
        body: { type: 'STRING' as Type, description: 'Email message draft' },
      },
      required: ['id'],
    },
  },
  {
    name: 'convert_quote_to_invoice',
    description: 'Convert a quote into a new invoice',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Quote ID' },
        isTaxable: { type: 'BOOLEAN' as Type, description: 'Whether the invoice should be taxable (16% GST). Default false.' },
      },
      required: ['id'],
    },
  },
  // -- Payments --
  {
    name: 'list_payments',
    description: 'List all payments, optionally filtered by invoice',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceId: { type: 'INTEGER' as Type },
      },
    },
  },
  {
    name: 'create_payment',
    description: 'Record a payment against an invoice',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceId: { type: 'INTEGER' as Type },
        amount: { type: 'NUMBER' as Type },
        paymentDate: { type: 'STRING' as Type, description: 'YYYY-MM-DD' },
        paymentMethod: { type: 'STRING' as Type, description: 'cash, bank_transfer, credit_card, check, other' },
        reference: { type: 'STRING' as Type },
        notes: { type: 'STRING' as Type },
      },
      required: ['invoiceId', 'amount', 'paymentDate'],
    },
  },
  {
    name: 'delete_payment',
    description: 'Delete a payment record',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'batch_create_payments',
    description: 'Record multiple payments at once. Use when user wants to record several payments in a single request.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        payments: {
          type: 'ARRAY' as Type,
          description: 'List of payments to record',
          items: {
            type: 'OBJECT' as Type,
            properties: {
              invoiceId: { type: 'INTEGER' as Type, description: 'Invoice ID' },
              amount: { type: 'NUMBER' as Type, description: 'Payment amount' },
              paymentDate: { type: 'STRING' as Type, description: 'YYYY-MM-DD' },
              paymentMethod: { type: 'STRING' as Type, description: 'cash, bank_transfer, credit_card, check, other' },
              reference: { type: 'STRING' as Type },
              notes: { type: 'STRING' as Type },
            },
            required: ['invoiceId', 'amount', 'paymentDate'],
          },
        },
      },
      required: ['payments'],
    },
  },
  // -- Recurring --
  {
    name: 'list_recurring',
    description: 'List all recurring invoice templates',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {},
    },
  },
  {
    name: 'get_recurring',
    description: 'Get a recurring invoice template by ID',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_recurring',
    description: 'Create a recurring invoice template',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        clientId: { type: 'INTEGER' as Type },
        frequency: { type: 'STRING' as Type, description: 'weekly, biweekly, monthly, quarterly, yearly' },
        startDate: { type: 'STRING' as Type },
        endDate: { type: 'STRING' as Type },
        currency: { type: 'STRING' as Type },
        taxRate: { type: 'NUMBER' as Type },
        autoSend: { type: 'BOOLEAN' as Type },
        notes: { type: 'STRING' as Type },
        terms: { type: 'STRING' as Type },
        lineItems: {
          type: 'ARRAY' as Type,
          items: {
            type: 'OBJECT' as Type,
            properties: {
              description: { type: 'STRING' as Type },
              quantity: { type: 'NUMBER' as Type },
              unitPrice: { type: 'NUMBER' as Type },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['clientId', 'frequency', 'startDate', 'lineItems'],
    },
  },
  {
    name: 'update_recurring',
    description: 'Update a recurring invoice template',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
        clientId: { type: 'INTEGER' as Type },
        frequency: { type: 'STRING' as Type, description: 'weekly, biweekly, monthly, quarterly, yearly' },
        startDate: { type: 'STRING' as Type },
        endDate: { type: 'STRING' as Type },
        currency: { type: 'STRING' as Type },
        taxRate: { type: 'NUMBER' as Type },
        autoSend: { type: 'BOOLEAN' as Type },
        notes: { type: 'STRING' as Type },
        terms: { type: 'STRING' as Type },
        lineItems: {
          type: 'ARRAY' as Type,
          items: {
            type: 'OBJECT' as Type,
            properties: {
              description: { type: 'STRING' as Type },
              quantity: { type: 'NUMBER' as Type },
              unitPrice: { type: 'NUMBER' as Type },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_recurring',
    description: 'Delete a recurring invoice template',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'toggle_recurring',
    description: 'Toggle a recurring invoice active/inactive',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  // -- Bank Accounts --
  {
    name: 'list_bank_accounts',
    description: 'List all bank accounts',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        activeOnly: { type: 'BOOLEAN' as Type },
      },
    },
  },
  {
    name: 'get_bank_account',
    description: 'Get a bank account with its transactions',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_bank_account',
    description: 'Create a new bank account. Provider can be manual, paypal, or bank_al_etihad.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        name: { type: 'STRING' as Type },
        bankName: { type: 'STRING' as Type },
        accountNumber: { type: 'STRING' as Type },
        currency: { type: 'STRING' as Type },
        initialBalance: { type: 'NUMBER' as Type },
        notes: { type: 'STRING' as Type },
        provider: {
          type: 'STRING' as Type,
          description: 'Account provider: manual, paypal, or bank_al_etihad',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_bank_account',
    description: 'Update a bank account',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
        name: { type: 'STRING' as Type },
        bankName: { type: 'STRING' as Type },
        accountNumber: { type: 'STRING' as Type },
        currency: { type: 'STRING' as Type },
        initialBalance: { type: 'NUMBER' as Type },
        isActive: { type: 'BOOLEAN' as Type },
        notes: { type: 'STRING' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_bank_account',
    description: 'Delete a bank account and all its transactions',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_paypal',
    description: 'Link a bank account to PayPal for transaction syncing. PayPal API credentials must be configured in Settings first.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        bankAccountId: { type: 'INTEGER' as Type, description: 'The bank account ID to connect' },
      },
      required: ['bankAccountId'],
    },
  },
  {
    name: 'sync_bank_account',
    description: 'Sync transactions from a connected provider (e.g. PayPal) for a date range',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        bankAccountId: { type: 'INTEGER' as Type },
        fromDate: { type: 'STRING' as Type, description: 'Start date YYYY-MM-DD' },
        toDate: { type: 'STRING' as Type, description: 'End date YYYY-MM-DD' },
      },
      required: ['bankAccountId', 'fromDate', 'toDate'],
    },
  },
  // -- Transactions --
  {
    name: 'list_transactions',
    description: 'List transactions with optional filters',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        bankAccountId: { type: 'INTEGER' as Type },
        type: { type: 'STRING' as Type, description: 'income or expense' },
        category: { type: 'STRING' as Type },
        search: { type: 'STRING' as Type },
      },
    },
  },
  {
    name: 'get_transaction',
    description: 'Get a single transaction by ID',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_transaction',
    description: 'Create a new transaction',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        bankAccountId: { type: 'INTEGER' as Type },
        type: { type: 'STRING' as Type, description: 'income or expense' },
        category: { type: 'STRING' as Type },
        amount: { type: 'NUMBER' as Type },
        date: { type: 'STRING' as Type },
        description: { type: 'STRING' as Type },
        notes: { type: 'STRING' as Type },
      },
      required: ['bankAccountId', 'type', 'category', 'amount', 'date', 'description'],
    },
  },
  {
    name: 'update_transaction',
    description: 'Update an existing transaction',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
        type: { type: 'STRING' as Type },
        category: { type: 'STRING' as Type },
        amount: { type: 'NUMBER' as Type },
        date: { type: 'STRING' as Type },
        description: { type: 'STRING' as Type },
        notes: { type: 'STRING' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type },
      },
      required: ['id'],
    },
  },
  // -- Settings --
  {
    name: 'get_settings',
    description: 'Get the current business settings',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {},
    },
  },
  {
    name: 'update_settings',
    description: 'Update business settings (general, JoFotara, tax)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        businessName: { type: 'STRING' as Type },
        businessEmail: { type: 'STRING' as Type },
        businessPhone: { type: 'STRING' as Type },
        businessAddress: { type: 'STRING' as Type },
        defaultCurrency: { type: 'STRING' as Type },
        defaultTaxRate: { type: 'NUMBER' as Type },
        defaultPaymentTerms: { type: 'INTEGER' as Type },
        invoicePrefix: { type: 'STRING' as Type },
        quotePrefix: { type: 'STRING' as Type },
        jofotaraClientId: { type: 'STRING' as Type, description: 'JoFotara Client ID' },
        jofotaraClientSecret: { type: 'STRING' as Type, description: 'JoFotara Client Secret' },
        jofotaraCompanyTin: { type: 'STRING' as Type, description: 'Company TIN for JoFotara' },
        jofotaraIncomeSourceSequence: { type: 'STRING' as Type, description: 'Income source sequence number' },
        jofotaraInvoiceType: { type: 'STRING' as Type, description: 'Default JoFotara invoice type: income, general_sales, special_sales' },
        jofotaraEnabled: { type: 'BOOLEAN' as Type, description: 'Enable/disable JoFotara integration' },
        filingStatus: { type: 'STRING' as Type, description: 'Tax filing status: single or married' },
        personalExemption: { type: 'NUMBER' as Type, description: 'Personal tax exemption amount (JOD)' },
        familyExemption: { type: 'NUMBER' as Type, description: 'Family tax exemption amount (JOD)' },
        additionalExemptions: { type: 'NUMBER' as Type, description: 'Additional tax exemptions (JOD, max 3000)' },
      },
    },
  },
  // -- History / Logs --
  {
    name: 'get_activity_log',
    description: 'Get recent activity log entries. Use to answer questions like "what did I do today?" or "show recent changes".',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        entityType: { type: 'STRING' as Type, description: 'Filter by entity type (invoice, quote, client, payment, etc.)' },
        limit: { type: 'INTEGER' as Type, description: 'Number of entries to return (default 20, max 50)' },
      },
    },
  },
  {
    name: 'get_email_log',
    description: 'Get sent email history. Use to answer "when was invoice X sent?" or "show email history".',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceId: { type: 'INTEGER' as Type, description: 'Filter by invoice ID' },
        quoteId: { type: 'INTEGER' as Type, description: 'Filter by quote ID' },
        limit: { type: 'INTEGER' as Type, description: 'Number of entries to return (default 20, max 50)' },
      },
    },
  },
  // -- Batch Operations --
  {
    name: 'batch_update_invoice_status',
    description: 'Update status for multiple invoices at once. Use when user says "mark all overdue as sent" or "send all draft invoices".',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceIds: {
          type: 'ARRAY' as Type,
          description: 'List of invoice IDs to update',
          items: { type: 'INTEGER' as Type },
        },
        status: { type: 'STRING' as Type, description: 'New status for all invoices' },
      },
      required: ['invoiceIds', 'status'],
    },
  },
  // -- Import --
  {
    name: 'import_invoices_from_data',
    description: 'Import/create multiple invoices at once from parsed spreadsheet data. Use when user uploads an XLSX/CSV file with invoice data. Parse the file content first, then call this with structured data.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoices: {
          type: 'ARRAY' as Type,
          description: 'List of invoices to create',
          items: {
            type: 'OBJECT' as Type,
            properties: {
              clientName: { type: 'STRING' as Type, description: 'Client name (will be looked up or created)' },
              clientEmail: { type: 'STRING' as Type, description: 'Client email (for new clients)' },
              issueDate: { type: 'STRING' as Type, description: 'YYYY-MM-DD' },
              dueDate: { type: 'STRING' as Type, description: 'YYYY-MM-DD' },
              currency: { type: 'STRING' as Type },
              isTaxable: { type: 'BOOLEAN' as Type },
              notes: { type: 'STRING' as Type },
              lineItems: {
                type: 'ARRAY' as Type,
                items: {
                  type: 'OBJECT' as Type,
                  properties: {
                    description: { type: 'STRING' as Type },
                    quantity: { type: 'NUMBER' as Type },
                    unitPrice: { type: 'NUMBER' as Type },
                  },
                  required: ['description', 'quantity', 'unitPrice'],
                },
              },
            },
            required: ['clientName', 'issueDate', 'lineItems'],
          },
        },
      },
      required: ['invoices'],
    },
  },
  {
    name: 'import_transactions_from_text',
    description: 'Import multiple transactions from CSV/text content. The AI parses the text into structured transactions. Use when user attaches a CSV or pastes transaction data.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        bankAccountId: { type: 'INTEGER' as Type, description: 'Target bank account ID' },
        transactions: {
          type: 'ARRAY' as Type,
          description: 'Parsed transactions to import',
          items: {
            type: 'OBJECT' as Type,
            properties: {
              type: { type: 'STRING' as Type, description: 'income or expense' },
              category: { type: 'STRING' as Type },
              amount: { type: 'NUMBER' as Type },
              date: { type: 'STRING' as Type, description: 'YYYY-MM-DD' },
              description: { type: 'STRING' as Type },
            },
            required: ['type', 'category', 'amount', 'date', 'description'],
          },
        },
      },
      required: ['bankAccountId', 'transactions'],
    },
  },
  // -- Navigation --
  {
    name: 'navigate_to',
    description: 'Navigate the user to a specific page in the app. Use when user says "go to", "show me", "open", or when you want to direct them somewhere after an action.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        path: {
          type: 'STRING' as Type,
          description: 'The route path. Valid: /, /invoices, /invoices/:id, /invoices/new, /quotes, /quotes/:id, /quotes/new, /clients, /clients/:id, /clients/new, /payments, /recurring, /bank-accounts, /transactions, /settings, /payroll, /payroll/:id, /payroll/employees, /payroll/employees/:id',
        },
      },
      required: ['path'],
    },
  },
  // -- Dashboard --
  {
    name: 'get_dashboard_stats',
    description: 'Get dashboard statistics (revenue, outstanding, overdue, bank balance, etc.)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {},
    },
  },
  {
    name: 'get_revenue_chart',
    description: 'Get revenue chart data for the last 12 months',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {},
    },
  },
  // -- JoFotara (Jordan e-Invoicing) --
  {
    name: 'submit_to_jofotara',
    description: 'Submit a taxable invoice to JoFotara (Jordan e-invoicing system). Only works for taxable (INV) invoices with JOD currency. The invoice must have a client with a Tax ID (TIN).',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceId: { type: 'INTEGER' as Type, description: 'Invoice ID to submit' },
        paymentMethod: { type: 'STRING' as Type, description: 'Payment method: "cash" or "receivable"' },
        invoiceType: { type: 'STRING' as Type, description: 'JoFotara invoice type: "income", "general_sales", or "special_sales". Defaults to settings value.' },
      },
      required: ['invoiceId', 'paymentMethod'],
    },
  },
  {
    name: 'submit_credit_note',
    description: 'Submit a credit note to JoFotara referencing an original submitted invoice. Used for returns/refunds.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceId: { type: 'INTEGER' as Type, description: 'New credit invoice ID' },
        originalInvoiceId: { type: 'INTEGER' as Type, description: 'ID of the original submitted invoice' },
        reasonForReturn: { type: 'STRING' as Type, description: 'Reason for the credit/return' },
        paymentMethod: { type: 'STRING' as Type, description: '"cash" or "receivable" (default: "cash")' },
      },
      required: ['invoiceId', 'originalInvoiceId', 'reasonForReturn'],
    },
  },
  {
    name: 'validate_for_jofotara',
    description: 'Pre-validate an invoice for JoFotara submission without actually submitting. Returns list of errors if any.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceId: { type: 'INTEGER' as Type, description: 'Invoice ID to validate' },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'get_jofotara_submissions',
    description: 'Get JoFotara submission history for an invoice. Shows all submission attempts, statuses, and UUIDs.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        invoiceId: { type: 'INTEGER' as Type, description: 'Invoice ID' },
      },
      required: ['invoiceId'],
    },
  },
  // -- Tax Reports --
  {
    name: 'get_sales_tax_report',
    description: 'Get sales tax report (كشف المبيعات) for a bimonthly period. Shows taxable vs exempt sales, output tax (16% GST), and invoice breakdown.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Year (default: current year)' },
        period: { type: 'INTEGER' as Type, description: 'Bimonthly period index 0-5: 0=Jan-Feb, 1=Mar-Apr, 2=May-Jun, 3=Jul-Aug, 4=Sep-Oct, 5=Nov-Dec' },
      },
    },
  },
  {
    name: 'get_purchases_report',
    description: 'Get purchases/expenses report (كشف المشتريات) for a bimonthly period. Shows expense transactions with input tax.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Year (default: current year)' },
        period: { type: 'INTEGER' as Type, description: 'Bimonthly period index 0-5' },
      },
    },
  },
  {
    name: 'get_gst_summary',
    description: 'Get GST return summary (ملخص إقرار ضريبة المبيعات) for a bimonthly period. Shows output tax, input tax, and net tax payable for JoFotara filing.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Year (default: current year)' },
        period: { type: 'INTEGER' as Type, description: 'Bimonthly period index 0-5' },
      },
    },
  },
  {
    name: 'get_income_tax_report',
    description: 'Get annual income tax report (إقرار ضريبة الدخل). Calculates revenue, expenses, exemptions, taxable income, and tax liability using Jordan tax brackets.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Tax year (default: current year)' },
      },
    },
  },
  {
    name: 'get_profit_loss_report',
    description: 'Get profit & loss statement (قائمة الأرباح والخسائر). Shows monthly revenue vs expenses breakdown.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        startDate: { type: 'STRING' as Type, description: 'Start date YYYY-MM-DD (default: Jan 1 of current year)' },
        endDate: { type: 'STRING' as Type, description: 'End date YYYY-MM-DD (default: today)' },
      },
    },
  },
  {
    name: 'get_tax_deadlines',
    description: 'Get upcoming tax filing deadlines. Shows GST bimonthly deadlines and annual income tax deadline with days remaining.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {},
    },
  },
  // -- Generators & Exports --
  {
    name: 'generate_export_link',
    description: 'Generate a downloadable CSV file link for a specific entity type (clients, invoices, or quotes).',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        entityType: { type: 'STRING' as Type, description: 'Type of entity to export (clients, invoices, quotes, transactions)' },
      },
      required: ['entityType'],
    },
  },
  {
    name: 'generate_quote_template',
    description: 'Generate a customized draft proposal/quote text. Use this when the user asks for a template or draft for a service.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        serviceType: { type: 'STRING' as Type, description: 'Type of service (e.g. web design, consultation)' },
        clientName: { type: 'STRING' as Type, description: 'Optional name of the prospective client' }
      },
      required: ['serviceType'],
    },
  },
  // -- Employees --
  {
    name: 'list_employees',
    description: 'List employees with optional filters (search, active, role)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        search: { type: 'STRING' as Type, description: 'Search by name or email' },
        active: { type: 'STRING' as Type, description: '"true" for active only, "false" for inactive only' },
        role: { type: 'STRING' as Type, description: 'Filter by role' },
      },
    },
  },
  {
    name: 'get_employee',
    description: 'Get a single employee by ID with payroll history',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Employee ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_employee',
    description: 'Create a new employee for payroll tracking',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        name: { type: 'STRING' as Type, description: 'Employee name (required)' },
        role: { type: 'STRING' as Type, description: 'Job role (e.g. Web Developer, QA Engineer)' },
        baseSalary: { type: 'NUMBER' as Type, description: 'Monthly base salary in JOD' },
        transportAllowance: { type: 'NUMBER' as Type, description: 'Monthly transport allowance in JOD (default 0)' },
        sskEnrolled: { type: 'BOOLEAN' as Type, description: 'Whether enrolled in SSK social security' },
        hireDate: { type: 'STRING' as Type, description: 'Hire date YYYY-MM-DD' },
        email: { type: 'STRING' as Type, description: 'Email address' },
        phone: { type: 'STRING' as Type, description: 'Phone number' },
        bankAccountName: { type: 'STRING' as Type, description: 'Bank account name' },
        bankIban: { type: 'STRING' as Type, description: 'Bank IBAN' },
        notes: { type: 'STRING' as Type, description: 'Notes' },
      },
      required: ['name', 'role', 'baseSalary', 'hireDate'],
    },
  },
  {
    name: 'update_employee',
    description: 'Update an existing employee',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Employee ID' },
        name: { type: 'STRING' as Type },
        role: { type: 'STRING' as Type },
        baseSalary: { type: 'NUMBER' as Type },
        transportAllowance: { type: 'NUMBER' as Type },
        sskEnrolled: { type: 'BOOLEAN' as Type },
        endDate: { type: 'STRING' as Type, description: 'End date YYYY-MM-DD (set to deactivate)' },
        email: { type: 'STRING' as Type },
        phone: { type: 'STRING' as Type },
        notes: { type: 'STRING' as Type },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_employee',
    description: 'Delete an employee (only if no payroll entries exist)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Employee ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'batch_create_employees',
    description: 'Create multiple employees at once. Use when the user wants to add several employees in a single request.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        employees: {
          type: 'ARRAY' as Type,
          description: 'List of employees to create',
          items: {
            type: 'OBJECT' as Type,
            properties: {
              name: { type: 'STRING' as Type, description: 'Employee name (required)' },
              role: { type: 'STRING' as Type, description: 'Job role (required)' },
              baseSalary: { type: 'NUMBER' as Type, description: 'Monthly base salary in JOD (required)' },
              hireDate: { type: 'STRING' as Type, description: 'Hire date YYYY-MM-DD (required)' },
              transportAllowance: { type: 'NUMBER' as Type, description: 'Monthly transport allowance in JOD (default 0)' },
              sskEnrolled: { type: 'BOOLEAN' as Type, description: 'Whether enrolled in SSK social security' },
              email: { type: 'STRING' as Type, description: 'Email address' },
              phone: { type: 'STRING' as Type, description: 'Phone number' },
            },
            required: ['name', 'role', 'baseSalary', 'hireDate'],
          },
        },
      },
      required: ['employees'],
    },
  },
  // -- Payroll --
  {
    name: 'list_payroll_runs',
    description: 'List payroll runs with optional filters (year, status)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Filter by year' },
        status: { type: 'STRING' as Type, description: 'Filter by status (draft, finalized, paid)' },
      },
    },
  },
  {
    name: 'get_payroll_run',
    description: 'Get a payroll run by ID with all employee entries',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_payroll_summary',
    description: 'Get a summary of payroll costs for a given year — total gross, net, SSK, and company cost per month',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Year to summarize (default: current year)' },
      },
    },
  },
  {
    name: 'create_payroll_run',
    description: 'Create a new monthly payroll run. Auto-populates entries for all active employees. Use duplicateFromRunId to copy overtime, bonus, deductions from a previous run.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Year' },
        month: { type: 'INTEGER' as Type, description: 'Month (1-12)' },
        standardWorkingDays: { type: 'INTEGER' as Type, description: 'Standard working days (default 26)' },
        duplicateFromRunId: { type: 'INTEGER' as Type, description: 'Optional: ID of a previous payroll run to copy entry data from' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'update_payroll_entry',
    description: 'Update a single payroll entry (overtime, bonus, deductions). Run must be in draft status.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        runId: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
        entryId: { type: 'INTEGER' as Type, description: 'Payroll entry ID' },
        workingDays: { type: 'INTEGER' as Type },
        weekdayOvertimeHours: { type: 'NUMBER' as Type },
        weekendOvertimeHours: { type: 'NUMBER' as Type },
        bonus: { type: 'NUMBER' as Type },
        salaryDifference: { type: 'NUMBER' as Type },
        salaryAdvance: { type: 'NUMBER' as Type },
        otherDeductions: { type: 'NUMBER' as Type },
        otherDeductionsNote: { type: 'STRING' as Type },
      },
      required: ['runId', 'entryId'],
    },
  },
  {
    name: 'finalize_payroll_run',
    description: 'Finalize a payroll run (locks all entries from editing)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_payroll_payment',
    description: 'Update payment status for a payroll entry',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        runId: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
        entryId: { type: 'INTEGER' as Type, description: 'Payroll entry ID' },
        paymentStatus: { type: 'STRING' as Type, description: 'pending, paid, or on_hold' },
        paymentDate: { type: 'STRING' as Type, description: 'Payment date YYYY-MM-DD' },
        bankTrxReference: { type: 'STRING' as Type, description: 'Bank transaction reference' },
        bankAccountId: { type: 'INTEGER' as Type, description: 'Bank account ID' },
      },
      required: ['runId', 'entryId', 'paymentStatus'],
    },
  },
  {
    name: 'update_payroll_run',
    description: 'Update payroll run metadata (notes or standard working days). Only works on draft runs.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
        standardWorkingDays: { type: 'INTEGER' as Type, description: 'Standard working days for the month' },
        notes: { type: 'STRING' as Type, description: 'Notes for the payroll run' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_payroll_run',
    description: 'Delete a payroll run. Only draft runs can be deleted.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'reopen_payroll_run',
    description: 'Reopen a finalized payroll run back to draft status for editing.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'mark_all_paid',
    description: 'Mark all pending entries in a finalized payroll run as paid. Optionally create bank expense transactions.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
        bankAccountId: { type: 'INTEGER' as Type, description: 'Optional bank account ID to create expense transactions' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_employee_to_run',
    description: 'Add a missing employee to an existing draft payroll run.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        runId: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
        employeeId: { type: 'INTEGER' as Type, description: 'Employee ID to add' },
      },
      required: ['runId', 'employeeId'],
    },
  },
  {
    name: 'remove_entry_from_run',
    description: 'Remove an employee entry from a draft payroll run.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        runId: { type: 'INTEGER' as Type, description: 'Payroll run ID' },
        entryId: { type: 'INTEGER' as Type, description: 'Payroll entry ID to remove' },
      },
      required: ['runId', 'entryId'],
    },
  },
  // -- Partner Expenses --
  {
    name: 'list_partner_categories',
    description: 'List partner expense categories',
    parameters: { type: 'OBJECT' as Type, properties: {} },
  },
  {
    name: 'list_partner_expenses',
    description: 'List partner shared expenses with optional filters',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Filter by year' },
        categoryId: { type: 'INTEGER' as Type, description: 'Filter by category ID' },
        search: { type: 'STRING' as Type, description: 'Search description' },
      },
    },
  },
  {
    name: 'list_partner_payments',
    description: 'List payments received from partner (Qais)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Filter by year' },
      },
    },
  },
  {
    name: 'get_partner_balance',
    description: 'Get partner expense balance summary: total expenses + SSK - payments. Positive = partner owes money.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Filter by year (optional)' },
      },
    },
  },
  {
    name: 'list_partner_ssk_entries',
    description: 'List partner SSK contribution entries',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Filter by year' },
      },
    },
  },
  {
    name: 'list_partner_employees',
    description: 'List partner employees (for SSK tracking)',
    parameters: { type: 'OBJECT' as Type, properties: {} },
  },
  {
    name: 'create_partner_expense',
    description: 'Record a shared expense with the partner. Provide totalAmount and splitPercent OR just partnerShare directly.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        categoryId: { type: 'INTEGER' as Type, description: 'Category ID' },
        date: { type: 'STRING' as Type, description: 'Expense date YYYY-MM-DD' },
        description: { type: 'STRING' as Type, description: 'Description' },
        totalAmount: { type: 'NUMBER' as Type, description: 'Full amount paid' },
        splitPercent: { type: 'NUMBER' as Type, description: 'Partner share percentage' },
        partnerShare: { type: 'NUMBER' as Type, description: 'Calculated partner share amount' },
        notes: { type: 'STRING' as Type, description: 'Optional notes' },
      },
      required: ['date', 'description', 'totalAmount', 'splitPercent', 'partnerShare'],
    },
  },
  {
    name: 'create_partner_payment',
    description: 'Record a payment received from the partner',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        date: { type: 'STRING' as Type, description: 'Payment date YYYY-MM-DD' },
        amount: { type: 'NUMBER' as Type, description: 'Payment amount' },
        description: { type: 'STRING' as Type, description: 'Description' },
        paymentMethod: { type: 'STRING' as Type, description: 'cash, bank_transfer, check, other' },
      },
      required: ['date', 'amount'],
    },
  },
  {
    name: 'generate_partner_ssk',
    description: 'Generate partner SSK entry for a month from active partner employees',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        year: { type: 'INTEGER' as Type, description: 'Year' },
        month: { type: 'INTEGER' as Type, description: 'Month (1-12)' },
      },
      required: ['year', 'month'],
    },
  },
  // -- Product Catalog --
  {
    name: 'list_products',
    description: 'List products/services from the catalog. Use when user asks about available products, services, or pricing.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        search: { type: 'STRING' as Type, description: 'Search by name or description' },
        category: { type: 'STRING' as Type, description: 'Filter by category' },
        active: { type: 'STRING' as Type, description: 'Filter: "true" (default), "false", or "all"' },
      },
    },
  },
  {
    name: 'create_product',
    description: 'Add a new product or service to the catalog',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        name: { type: 'STRING' as Type, description: 'Product/service name (required)' },
        description: { type: 'STRING' as Type, description: 'Description' },
        unitPrice: { type: 'NUMBER' as Type, description: 'Unit price (required)' },
        currency: { type: 'STRING' as Type, description: 'Currency code (default: from settings)' },
        category: { type: 'STRING' as Type, description: 'Category for grouping' },
        type: { type: 'STRING' as Type, description: '"service" (default) or "product"' },
      },
      required: ['name', 'unitPrice'],
    },
  },
  {
    name: 'update_product',
    description: 'Update an existing product/service in the catalog',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Product ID' },
        name: { type: 'STRING' as Type },
        description: { type: 'STRING' as Type },
        unitPrice: { type: 'NUMBER' as Type },
        currency: { type: 'STRING' as Type },
        category: { type: 'STRING' as Type },
        type: { type: 'STRING' as Type },
        isActive: { type: 'BOOLEAN' as Type, description: 'Active status' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_product',
    description: 'Delete a product/service from the catalog',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Product ID' },
      },
      required: ['id'],
    },
  },
  // -- Aging Report & Client Statement --
  {
    name: 'get_aging_report',
    description: 'Get accounts receivable aging report. Shows unpaid invoices grouped by age brackets (current, 1-30, 31-60, 61-90, 90+ days overdue).',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {},
    },
  },
  {
    name: 'get_client_statement',
    description: 'Get statement of account for a specific client. Shows all invoices and payments with running balance.',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        clientId: { type: 'INTEGER' as Type, description: 'Client ID (required)' },
        startDate: { type: 'STRING' as Type, description: 'Start date YYYY-MM-DD (optional)' },
        endDate: { type: 'STRING' as Type, description: 'End date YYYY-MM-DD (optional)' },
      },
      required: ['clientId'],
    },
  },
];

// ---- Helper: calculate line item totals ----
function calculateTotals(
  lineItems: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  discountAmount: number,
) {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal - discountAmount + taxAmount;
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

// ---- Helper: generate invoice number ----
async function generateInvoiceNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  isTaxable = false,
  isWriteOff = false,
) {
  const [s] = await tx.select().from(settings).limit(1);
  if (!s) throw new Error('Settings not found');

  if (isWriteOff) {
    const num = s.nextWriteOffNumber;
    const invoiceNumber = `${s.writeOffPrefix}-${String(num).padStart(4, '0')}`;
    await tx.update(settings)
      .set({ nextWriteOffNumber: num + 1 })
      .where(eq(settings.id, s.id));
    return invoiceNumber;
  }

  const prefix = isTaxable ? s.invoicePrefix : s.exemptInvoicePrefix;
  const nextNum = isTaxable ? s.nextInvoiceNumber : s.nextExemptInvoiceNumber;
  const invoiceNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`;

  const updateData = isTaxable
    ? { nextInvoiceNumber: nextNum + 1 }
    : { nextExemptInvoiceNumber: nextNum + 1 };

  await tx.update(settings).set(updateData).where(eq(settings.id, s.id));
  return invoiceNumber;
}

// ---- Helper: generate quote number ----
async function generateQuoteNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const [s] = await tx.select().from(settings).limit(1);
  if (!s) throw new Error('Settings not found');
  const quoteNumber = `${s.quotePrefix}-${String(s.nextQuoteNumber).padStart(4, '0')}`;
  await tx.update(settings).set({ nextQuoteNumber: s.nextQuoteNumber + 1 }).where(eq(settings.id, s.id));
  return quoteNumber;
}

// ---- Tool executor map ----
export const toolExecutors: Record<
  string,
  (args: Record<string, any>, ctx?: { userId?: number }) => Promise<unknown>
> = {
  // -- Clients --
  async list_clients(args) {
    let query = db.select().from(clients).orderBy(desc(clients.createdAt));
    if (args.search) {
      const pattern = `%${args.search}%`;
      query = query.where(or(ilike(clients.name, pattern), ilike(clients.email, pattern))) as typeof query;
    }
    return await query;
  },

  async get_client(args) {
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, args.id),
      with: { invoices: true, quotes: true },
    });
    if (!client) throw new Error(`Client #${args.id} not found`);
    return client;
  },

  async create_client(args, ctx) {
    const [client] = await db.insert(clients).values({
      name: args.name,
      email: args.email || null,
      phone: args.phone || null,
      company: args.company || null,
      addressLine1: args.addressLine1 || null,
      city: args.city || null,
      state: args.state || null,
      postalCode: args.postalCode || null,
      country: args.country || null,
      taxId: args.taxId || null,
      cityCode: args.cityCode || null,
      notes: args.notes || null,
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'client', entityId: client.id,
      action: 'created', description: `Client "${client.name}" created via AI chat`,
      userId: ctx?.userId,
    });
    return client;
  },

  async update_client(args, ctx) {
    const { id, ...data } = args;
    const [updated] = await db.update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id)).returning();
    if (!updated) throw new Error(`Client #${id} not found`);
    await db.insert(activityLog).values({
      entityType: 'client', entityId: id,
      action: 'updated', description: `Client "${updated.name}" updated via AI chat`,
      userId: ctx?.userId,
    });
    return updated;
  },

  async delete_client(args, ctx) {
    // Check for related entities before deletion
    const [client] = await db.select().from(clients).where(eq(clients.id, args.id));
    if (!client) throw new Error(`Client #${args.id} not found`);

    const [invCount] = await db.select({ value: count() })
      .from(invoices).where(eq(invoices.clientId, args.id));
    const [quoteCount] = await db.select({ value: count() })
      .from(quotes).where(eq(quotes.clientId, args.id));
    const relatedInvoices = invCount?.value ?? 0;
    const relatedQuotes = quoteCount?.value ?? 0;

    if (relatedInvoices > 0 || relatedQuotes > 0) {
      throw new Error(
        `Cannot delete "${client.name}": has ${relatedInvoices} invoice(s) and ${relatedQuotes} quote(s). `
        + 'Delete or reassign those first.',
      );
    }

    const [deleted] = await db.delete(clients).where(eq(clients.id, args.id)).returning();
    await db.insert(activityLog).values({
      entityType: 'client', entityId: deleted.id,
      action: 'deleted', description: `Client "${deleted.name}" deleted via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Client "${deleted.name}" deleted` };
  },

  async batch_create_clients(args, ctx) {
    const clientList = args.clients as any[];
    if (!clientList?.length) throw new Error('No clients provided');
    const created = [];
    for (const c of clientList) {
      const [client] = await db.insert(clients).values({
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        company: c.company || null,
        taxId: c.taxId || null,
        cityCode: c.cityCode || null,
        addressLine1: c.addressLine1 || null,
        city: c.city || null,
        country: c.country || null,
      }).returning();
      await db.insert(activityLog).values({
        entityType: 'client', entityId: client.id,
        action: 'created', description: `Client "${client.name}" created via AI chat (batch)`,
        userId: ctx?.userId,
      });
      created.push(client);
    }
    return { created, count: created.length };
  },

  async batch_delete_clients(args, ctx) {
    const { clientIds } = args;
    if (!Array.isArray(clientIds) || clientIds.length === 0) throw new Error('No client IDs provided');
    const deleted: string[] = [];
    const skipped: { id: number; reason: string }[] = [];
    for (const id of clientIds) {
      const [client] = await db.select().from(clients).where(eq(clients.id, id));
      if (!client) { skipped.push({ id, reason: 'not found' }); continue; }
      const [invCount] = await db.select({ value: count() }).from(invoices).where(eq(invoices.clientId, id));
      const [quoteCount] = await db.select({ value: count() }).from(quotes).where(eq(quotes.clientId, id));
      if ((invCount?.value ?? 0) > 0 || (quoteCount?.value ?? 0) > 0) {
        skipped.push({ id, reason: `has ${invCount?.value ?? 0} invoice(s) and ${quoteCount?.value ?? 0} quote(s)` });
        continue;
      }
      await db.delete(clients).where(eq(clients.id, id));
      await db.insert(activityLog).values({
        entityType: 'client', entityId: id,
        action: 'deleted', description: `Client "${client.name}" deleted via AI chat (batch)`,
        userId: ctx?.userId,
      });
      deleted.push(client.name);
    }
    return { message: `Deleted ${deleted.length} client(s)`, deleted, skipped };
  },

  // -- Invoices --
  async list_invoices(args) {
    const conditions = [];
    if (args.status) conditions.push(eq(invoices.status, args.status));
    if (args.clientId) conditions.push(eq(invoices.clientId, args.clientId));
    if (args.search) {
      const pattern = `%${args.search}%`;
      conditions.push(or(ilike(invoices.invoiceNumber, pattern), ilike(clients.name, pattern))!);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const pageNum = Math.max(1, args.page || 1);
    const size = Math.min(100, Math.max(1, args.pageSize || 20));

    const rows = await db.select({ invoice: invoices, client: clients })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(where)
      .orderBy(desc(invoices.createdAt))
      .limit(size)
      .offset((pageNum - 1) * size);

    return rows.map((r) => ({ ...r.invoice, client: r.client }));
  },

  async get_invoice(args) {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, args.id),
      with: { client: true, lineItems: true, payments: true },
    });
    if (!invoice) throw new Error(`Invoice #${args.id} not found`);
    return invoice;
  },

  async create_invoice(args, ctx) {
    const isTaxable = args.isTaxable === true;
    const isWriteOff = args.isWriteOff === true;
    const defaultTaxRate = isTaxable ? 16 : 0;
    const taxRate = args.taxRate ?? defaultTaxRate;
    const { lineItems: items, discountAmount = 0 } = args;
    const totals = calculateTotals(items, taxRate, discountAmount);

    // Fetch default currency from settings if not provided
    let currency = args.currency;
    if (!currency) {
      const [s] = await db.select().from(settings).limit(1);
      currency = s?.defaultCurrency || 'USD';
    }

    const result = await db.transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(
        tx, isTaxable, isWriteOff,
      );
      const [inv] = await tx.insert(invoices).values({
        clientId: args.clientId || null,
        issueDate: args.issueDate,
        dueDate: args.dueDate,
        currency,
        notes: args.notes || null,
        terms: args.terms || null,
        invoiceNumber,
        isTaxable,
        taxRate: String(taxRate),
        discountAmount: String(discountAmount),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        status: isWriteOff ? 'written_off' : 'draft',
        amountPaid: isWriteOff ? '0' : undefined,
      }).returning();

      const rows = items.map((item: any, idx: number) => ({
        invoiceId: inv.id,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        amount: String(item.quantity * item.unitPrice),
        sortOrder: idx,
      }));
      await tx.insert(invoiceLineItems).values(rows);

      await tx.insert(activityLog).values({
        entityType: 'invoice', entityId: inv.id,
        action: isWriteOff ? 'written_off' : 'created',
        description: isWriteOff
          ? `Write-off invoice ${inv.invoiceNumber} created via AI chat`
          : `Invoice ${inv.invoiceNumber} created via AI chat`,
        userId: ctx?.userId,
      });
      return inv;
    });

    return await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_invoice(args, ctx) {
    const { id, lineItems: items, taxRate, discountAmount, ...data } = args;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(invoices).where(eq(invoices.id, id));
      if (!existing) throw new Error(`Invoice #${id} not found`);

      const effectiveTax = taxRate ?? parseFloat(existing.taxRate);
      const effectiveDiscount = discountAmount ?? parseFloat(existing.discountAmount);

      let updatePayload: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (taxRate !== undefined) updatePayload.taxRate = String(taxRate);
      if (discountAmount !== undefined) updatePayload.discountAmount = String(discountAmount);

      if (items?.length) {
        const totals = calculateTotals(items, effectiveTax, effectiveDiscount);
        updatePayload = { ...updatePayload, ...totals };
        await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
        const rows = items.map((item: any, idx: number) => ({
          invoiceId: id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.quantity * item.unitPrice),
          sortOrder: idx,
        }));
        await tx.insert(invoiceLineItems).values(rows);
      }

      const [updated] = await tx.update(invoices).set(updatePayload).where(eq(invoices.id, id)).returning();
      await tx.insert(activityLog).values({
        entityType: 'invoice', entityId: id,
        action: 'updated', description: `Invoice ${updated.invoiceNumber} updated via AI chat`,
        userId: ctx?.userId,
      });
      return updated;
    });

    return await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async delete_invoice(args, ctx) {
    const [deleted] = await db.delete(invoices).where(eq(invoices.id, args.id)).returning();
    if (!deleted) throw new Error(`Invoice #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'invoice', entityId: deleted.id,
      action: 'deleted', description: `Invoice ${deleted.invoiceNumber} deleted via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Invoice ${deleted.invoiceNumber} deleted` };
  },

  async batch_delete_invoices(args, ctx) {
    const { invoiceIds } = args;
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) throw new Error('No invoice IDs provided');
    if (invoiceIds.length > 50) throw new Error('Cannot delete more than 50 invoices at once');
    const deleted: string[] = [];
    const skipped: { id: number; reason: string }[] = [];
    for (const id of invoiceIds) {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
      if (!inv) { skipped.push({ id, reason: 'not found' }); continue; }
      await db.delete(invoices).where(eq(invoices.id, id));
      await db.insert(activityLog).values({
        entityType: 'invoice', entityId: id,
        action: 'deleted', description: `Invoice ${inv.invoiceNumber} deleted via AI chat (batch)`,
        userId: ctx?.userId,
      });
      deleted.push(inv.invoiceNumber);
    }
    return { message: `Deleted ${deleted.length} invoice(s)`, deleted, skipped };
  },

  async update_invoice_status(args, ctx) {
    // Block status changes on written-off invoices
    const [existing] = await db.select({ status: invoices.status })
      .from(invoices).where(eq(invoices.id, args.id));
    if (!existing) throw new Error(`Invoice #${args.id} not found`);
    if (existing.status === 'written_off') {
      throw new Error('Cannot change status of a written-off invoice');
    }

    const updateData: Record<string, unknown> = {
      status: args.status, updatedAt: new Date(),
    };
    if (args.status === 'sent') updateData.sentAt = new Date();
    if (args.status === 'paid') updateData.paidAt = new Date();

    const [updated] = await db.update(invoices)
      .set(updateData).where(eq(invoices.id, args.id)).returning();
    if (!updated) throw new Error(`Invoice #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'invoice', entityId: args.id,
      action: 'status_changed',
      description: `Invoice ${updated.invoiceNumber} status changed to "${args.status}" via AI chat`,
      userId: ctx?.userId,
    });
    return updated;
  },

  async send_invoice_email(args, ctx) {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, args.id),
      with: { client: true, lineItems: true },
    });
    if (!invoice?.client) throw new Error(`Invoice #${args.id} not found`);
    if (!invoice.client.email) throw new Error('Client has no email address');

    const [settingsRow] = await db.select().from(settings).limit(1);
    const pdfBuffer = await generateInvoicePdf({
      invoice, lineItems: invoice.lineItems,
      client: invoice.client, settings: settingsRow || {},
    });

    // Support custom drafted subject/body
    const subject = args.subject || `Invoice ${invoice.invoiceNumber}`;
    const body = args.body || `Please find your invoice ${invoice.invoiceNumber} attached.`;

    const emailResult = await sendInvoiceEmail({
      to: invoice.client.email,
      subject,
      body,
      pdfBuffer, invoiceNumber: invoice.invoiceNumber,
      businessName: settingsRow?.businessName || 'Our Company',
      clientName: invoice.client.name,
      total: invoice.total, currency: invoice.currency,
      dueDate: invoice.dueDate,
    });
    await db.update(invoices)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, args.id));
    await db.insert(emailLog).values({
      invoiceId: args.id, recipientEmail: invoice.client.email,
      subject, status: 'sent', resendId: emailResult.id,
    });
    await db.insert(activityLog).values({
      entityType: 'invoice', entityId: args.id, action: 'sent',
      description: `Invoice ${invoice.invoiceNumber} sent to ${invoice.client.email} via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.client.email}` };
  },

  async send_invoice_reminder(args, ctx) {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, args.id),
      with: { client: true },
    });
    if (!invoice?.client) throw new Error(`Invoice #${args.id} not found`);
    if (!invoice.client.email) throw new Error('Client has no email address');

    const [settingsRow] = await db.select().from(settings).limit(1);
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000));

    const subject = args.subject || `Payment Reminder: ${invoice.invoiceNumber}`;
    const body = args.body || `This is a friendly reminder about invoice ${invoice.invoiceNumber}.`;
    const emailResult = await sendPaymentReminder({
      to: invoice.client.email,
      subject,
      body,
      businessName: settingsRow?.businessName || 'Our Company',
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total, dueDate: invoice.dueDate, daysOverdue,
    });
    await db.insert(emailLog).values({
      invoiceId: args.id, recipientEmail: invoice.client.email,
      subject, status: 'sent', resendId: emailResult.id,
    });
    await db.insert(activityLog).values({
      entityType: 'invoice', entityId: args.id, action: 'reminder_sent',
      description: `Payment reminder sent for ${invoice.invoiceNumber} via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Reminder sent for invoice ${invoice.invoiceNumber}` };
  },

  async duplicate_invoice(args, ctx) {
    const original = await db.query.invoices.findFirst({
      where: eq(invoices.id, args.id),
      with: { lineItems: true },
    });
    if (!original) throw new Error(`Invoice #${args.id} not found`);

    const result = await db.transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(
        tx, original.isTaxable,
      );
      const [dup] = await tx.insert(invoices).values({
        invoiceNumber,
        clientId: original.clientId,
        status: 'draft',
        isTaxable: original.isTaxable,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: original.dueDate,
        currency: original.currency,
        subtotal: original.subtotal,
        taxRate: original.taxRate,
        taxAmount: original.taxAmount,
        discountAmount: original.discountAmount,
        total: original.total,
        notes: original.notes,
        terms: original.terms,
      }).returning();

      if (original.lineItems?.length) {
        await tx.insert(invoiceLineItems).values(
          original.lineItems.map((item, idx) => ({
            invoiceId: dup.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            sortOrder: idx,
          })),
        );
      }
      await tx.insert(activityLog).values({
        entityType: 'invoice', entityId: dup.id, action: 'duplicated',
        description: `Invoice ${dup.invoiceNumber} duplicated from ${original.invoiceNumber} via AI chat`,
        userId: ctx?.userId,
      });
      return dup;
    });

    return await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  // -- Quotes --
  async list_quotes(args) {
    const conditions = [];
    if (args.status) conditions.push(eq(quotes.status, args.status));
    if (args.clientId) conditions.push(eq(quotes.clientId, args.clientId));
    if (args.search) {
      const pattern = `%${args.search}%`;
      conditions.push(or(ilike(quotes.quoteNumber, pattern), ilike(clients.name, pattern))!);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select({ quote: quotes, client: clients })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(where)
      .orderBy(desc(quotes.createdAt))
      .limit(50);
    return rows.map((r) => ({ ...r.quote, client: r.client }));
  },

  async get_quote(args) {
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, args.id),
      with: { client: true, lineItems: true },
    });
    if (!quote) throw new Error(`Quote #${args.id} not found`);
    return quote;
  },

  async create_quote(args, ctx) {
    const { lineItems: items, taxRate = 0, discountAmount = 0, ...data } = args;
    const totals = calculateTotals(items, taxRate, discountAmount);

    const result = await db.transaction(async (tx) => {
      const quoteNumber = await generateQuoteNumber(tx);
      const [q] = await tx.insert(quotes).values({
        ...data,
        quoteNumber,
        taxRate: String(taxRate),
        discountAmount: String(discountAmount),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        status: 'draft',
      }).returning();

      const rows = items.map((item: any, idx: number) => ({
        quoteId: q.id,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        amount: String(item.quantity * item.unitPrice),
        sortOrder: idx,
      }));
      await tx.insert(quoteLineItems).values(rows);

      await tx.insert(activityLog).values({
        entityType: 'quote', entityId: q.id,
        action: 'created', description: `Quote ${q.quoteNumber} created via AI chat`,
        userId: ctx?.userId,
      });
      return q;
    });

    return await db.query.quotes.findFirst({
      where: eq(quotes.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_quote(args, ctx) {
    const { id, lineItems: items, taxRate, discountAmount, ...data } = args;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(quotes).where(eq(quotes.id, id));
      if (!existing) throw new Error(`Quote #${id} not found`);

      const effectiveTax = taxRate ?? parseFloat(existing.taxRate);
      const effectiveDiscount = discountAmount ?? parseFloat(existing.discountAmount);

      let updatePayload: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (taxRate !== undefined) updatePayload.taxRate = String(taxRate);
      if (discountAmount !== undefined) updatePayload.discountAmount = String(discountAmount);

      if (items?.length) {
        const totals = calculateTotals(items, effectiveTax, effectiveDiscount);
        updatePayload = { ...updatePayload, ...totals };
        await tx.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, id));
        const rows = items.map((item: any, idx: number) => ({
          quoteId: id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.quantity * item.unitPrice),
          sortOrder: idx,
        }));
        await tx.insert(quoteLineItems).values(rows);
      }

      const [updated] = await tx.update(quotes).set(updatePayload).where(eq(quotes.id, id)).returning();
      await tx.insert(activityLog).values({
        entityType: 'quote', entityId: id,
        action: 'updated', description: `Quote ${updated.quoteNumber} updated via AI chat`,
        userId: ctx?.userId,
      });
      return updated;
    });

    return await db.query.quotes.findFirst({
      where: eq(quotes.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_quote_status(args, ctx) {
    const updateData: Record<string, unknown> = {
      status: args.status, updatedAt: new Date(),
    };
    if (args.status === 'sent') updateData.sentAt = new Date();

    const [updated] = await db.update(quotes)
      .set(updateData).where(eq(quotes.id, args.id)).returning();
    if (!updated) throw new Error(`Quote #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'quote', entityId: args.id,
      action: 'status_changed',
      description: `Quote ${updated.quoteNumber} status changed to "${args.status}" via AI chat`,
      userId: ctx?.userId,
    });
    return updated;
  },

  async delete_quote(args, ctx) {
    const [deleted] = await db.delete(quotes).where(eq(quotes.id, args.id)).returning();
    if (!deleted) throw new Error(`Quote #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'quote', entityId: deleted.id,
      action: 'deleted', description: `Quote ${deleted.quoteNumber} deleted via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Quote ${deleted.quoteNumber} deleted` };
  },

  async batch_create_quotes(args, ctx) {
    const quoteList = args.quotes as any[];
    if (!quoteList?.length) throw new Error('No quotes provided');
    if (quoteList.length > 50) throw new Error('Cannot create more than 50 quotes at once');

    const [s] = await db.select().from(settings).limit(1);
    const defaultCurrency = s?.defaultCurrency || 'USD';
    const results: { id: number; quoteNumber: string; total: string }[] = [];

    for (const q of quoteList) {
      const items = q.lineItems || [];
      const taxRate = q.taxRate ?? 0;
      const totals = calculateTotals(items, taxRate, 0);
      const currency = q.currency || defaultCurrency;
      const expiryDate = q.expiryDate || (() => {
        const d = new Date(q.issueDate);
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      })();

      const created = await db.transaction(async (tx) => {
        const quoteNumber = await generateQuoteNumber(tx);
        const [newQ] = await tx.insert(quotes).values({
          quoteNumber,
          clientId: q.clientId,
          issueDate: q.issueDate,
          expiryDate,
          currency,
          taxRate: String(taxRate),
          discountAmount: '0',
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          notes: q.notes || null,
          status: 'draft',
        }).returning();

        if (items.length > 0) {
          const rows = items.map((item: any, idx: number) => ({
            quoteId: newQ.id,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            amount: String(item.quantity * item.unitPrice),
            sortOrder: idx,
          }));
          await tx.insert(quoteLineItems).values(rows);
        }

        await tx.insert(activityLog).values({
          entityType: 'quote', entityId: newQ.id,
          action: 'created', description: `Quote ${newQ.quoteNumber} created via AI chat (batch)`,
          userId: ctx?.userId,
        });
        return newQ;
      });

      results.push({ id: created.id, quoteNumber: created.quoteNumber, total: totals.total });
    }

    return { message: `Created ${results.length} quote(s)`, quotes: results };
  },

  async send_quote_email(args, ctx) {
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, args.id),
      with: { client: true, lineItems: true },
    });
    if (!quote?.client) throw new Error(`Quote #${args.id} not found`);
    if (!quote.client.email) throw new Error('Client has no email address');

    const [settingsRow] = await db.select().from(settings).limit(1);
    const pdfBuffer = await generateQuotePdf({
      quote, lineItems: quote.lineItems,
      client: quote.client, settings: settingsRow || {},
    });
    const subject = args.subject || `Quote ${quote.quoteNumber}`;
    const body = args.body || `Please find your quote ${quote.quoteNumber} attached.`;
    const emailResult = await sendQuoteEmail({
      to: quote.client.email,
      subject,
      body,
      pdfBuffer, quoteNumber: quote.quoteNumber,
      businessName: settingsRow?.businessName || 'Our Company',
      clientName: quote.client.name,
      total: quote.total, currency: quote.currency,
      expiryDate: quote.expiryDate,
    });
    await db.update(quotes)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(quotes.id, args.id));
    await db.insert(emailLog).values({
      quoteId: args.id, recipientEmail: quote.client.email,
      subject, status: 'sent', resendId: emailResult.id,
    });
    await db.insert(activityLog).values({
      entityType: 'quote', entityId: args.id, action: 'sent',
      description: `Quote ${quote.quoteNumber} sent to ${quote.client.email} via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Quote ${quote.quoteNumber} sent to ${quote.client.email}` };
  },

  async convert_quote_to_invoice(args, ctx) {
    const quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, args.id),
      with: { lineItems: true },
    });
    if (!quote) throw new Error(`Quote #${args.id} not found`);
    if (quote.status === 'converted') throw new Error('Quote already converted');

    const isTaxable = args.isTaxable === true;
    const result = await db.transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(tx, isTaxable);
      const [settingsRow] = await tx.select().from(settings).limit(1);
      const paymentTerms = settingsRow?.defaultPaymentTerms ?? 30;
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      const taxRate = isTaxable ? 16 : 0;
      const quoteItems = quote.lineItems || [];
      const subtotal = quoteItems.reduce(
        (s, i) => s + parseFloat(i.quantity) * parseFloat(i.unitPrice), 0,
      );
      const disc = parseFloat(quote.discountAmount);
      const taxAmount = (subtotal - disc) * (taxRate / 100);
      const total = subtotal - disc + taxAmount;

      const [inv] = await tx.insert(invoices).values({
        invoiceNumber, clientId: quote.clientId, status: 'draft',
        isTaxable,
        issueDate: today.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        currency: quote.currency, subtotal: subtotal.toFixed(2),
        taxRate: String(taxRate), taxAmount: taxAmount.toFixed(2),
        discountAmount: quote.discountAmount, total: total.toFixed(2),
        notes: quote.notes, terms: quote.terms,
      }).returning();

      if (quote.lineItems?.length) {
        await tx.insert(invoiceLineItems).values(
          quote.lineItems.map((item, idx) => ({
            invoiceId: inv.id, description: item.description,
            quantity: item.quantity, unitPrice: item.unitPrice,
            amount: item.amount, sortOrder: idx,
          })),
        );
      }

      await tx.update(quotes).set({
        status: 'converted', convertedInvoiceId: inv.id, updatedAt: new Date(),
      }).where(eq(quotes.id, args.id));

      await tx.insert(activityLog).values({
        entityType: 'quote', entityId: args.id, action: 'converted',
        description: `Quote ${quote.quoteNumber} converted to invoice ${invoiceNumber} via AI chat`,
        userId: ctx?.userId,
      });
      return inv;
    });

    return await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  // -- Payments --
  async list_payments(args) {
    const conditions = [];
    if (args.invoiceId) conditions.push(eq(payments.invoiceId, args.invoiceId));
    const where = conditions.length ? and(...conditions) : undefined;

    return await db.query.payments.findMany({
      where,
      with: { invoice: true },
      orderBy: [desc(payments.createdAt)],
      limit: 50,
    });
  },

  async create_payment(args, ctx) {
    const { invoiceId, amount, paymentDate, paymentMethod, reference, notes } = args;
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error(`Invoice #${invoiceId} not found`);

    const [payment] = await db.insert(payments).values({
      invoiceId, amount: String(amount), paymentDate,
      paymentMethod: paymentMethod || null, reference: reference || null, notes: notes || null,
    }).returning();

    // Update amountPaid
    const newAmountPaid = parseFloat(invoice.amountPaid) + amount;
    const invoiceTotal = parseFloat(invoice.total);
    const newStatus = newAmountPaid >= invoiceTotal ? 'paid' : 'partially_paid';
    const updateData: Record<string, unknown> = {
      amountPaid: String(newAmountPaid.toFixed(2)),
      status: newStatus, updatedAt: new Date(),
    };
    if (newStatus === 'paid') updateData.paidAt = new Date();
    await db.update(invoices).set(updateData).where(eq(invoices.id, invoiceId));

    await db.insert(activityLog).values({
      entityType: 'payment', entityId: payment.id, action: 'created',
      description: `Payment of ${amount} recorded for invoice ${invoice.invoiceNumber} via AI chat`,
      userId: ctx?.userId,
    });
    return payment;
  },

  async delete_payment(args, ctx) {
    const [payment] = await db.select().from(payments).where(eq(payments.id, args.id));
    if (!payment) throw new Error(`Payment #${args.id} not found`);

    await db.delete(payments).where(eq(payments.id, args.id));

    // Recalculate amountPaid
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, payment.invoiceId));
    if (invoice) {
      const [sumResult] = await db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(eq(payments.invoiceId, payment.invoiceId));
      const newPaid = parseFloat(sumResult?.total ?? '0');
      const invoiceTotal = parseFloat(invoice.total);
      let newStatus = invoice.status;
      if (newPaid <= 0) newStatus = 'sent';
      else if (newPaid >= invoiceTotal) newStatus = 'paid';
      else newStatus = 'partially_paid';
      await db.update(invoices).set({
        amountPaid: String(newPaid.toFixed(2)),
        status: newStatus, updatedAt: new Date(),
      }).where(eq(invoices.id, payment.invoiceId));
    }

    await db.insert(activityLog).values({
      entityType: 'payment', entityId: args.id, action: 'deleted',
      description: `Payment deleted via AI chat`,
      userId: ctx?.userId,
    });
    return { message: 'Payment deleted' };
  },

  async batch_create_payments(args, ctx) {
    const paymentList = args.payments as any[];
    if (!paymentList?.length) throw new Error('No payments provided');
    if (paymentList.length > 50) throw new Error('Cannot record more than 50 payments at once');
    const results: { id: number; invoiceNumber: string; amount: number }[] = [];
    for (const p of paymentList) {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, p.invoiceId));
      if (!invoice) throw new Error(`Invoice #${p.invoiceId} not found`);
      const [payment] = await db.insert(payments).values({
        invoiceId: p.invoiceId,
        amount: String(p.amount),
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod || null,
        reference: p.reference || null,
        notes: p.notes || null,
      }).returning();
      const newAmountPaid = parseFloat(invoice.amountPaid) + p.amount;
      const invoiceTotal = parseFloat(invoice.total);
      const newStatus = newAmountPaid >= invoiceTotal ? 'paid' : 'partially_paid';
      const updateData: Record<string, unknown> = {
        amountPaid: String(newAmountPaid.toFixed(2)),
        status: newStatus, updatedAt: new Date(),
      };
      if (newStatus === 'paid') updateData.paidAt = new Date();
      await db.update(invoices).set(updateData).where(eq(invoices.id, p.invoiceId));
      await db.insert(activityLog).values({
        entityType: 'payment', entityId: payment.id, action: 'created',
        description: `Payment of ${p.amount} recorded for invoice ${invoice.invoiceNumber} via AI chat (batch)`,
        userId: ctx?.userId,
      });
      results.push({ id: payment.id, invoiceNumber: invoice.invoiceNumber, amount: p.amount });
    }
    return { message: `Recorded ${results.length} payment(s)`, payments: results };
  },

  // -- Recurring --
  async list_recurring() {
    return await db.query.recurringInvoices.findMany({
      with: { client: true },
      orderBy: [desc(recurringInvoices.createdAt)],
    });
  },

  async get_recurring(args) {
    const recurring = await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, args.id),
      with: { client: true, lineItems: true },
    });
    if (!recurring) throw new Error(`Recurring invoice #${args.id} not found`);
    return recurring;
  },

  async create_recurring(args, ctx) {
    const { lineItems: items, taxRate = 0 } = args;
    const totals = calculateTotals(items, taxRate, 0);

    // Fetch default currency from settings if not provided
    let currency = args.currency;
    if (!currency) {
      const [s] = await db.select().from(settings).limit(1);
      currency = s?.defaultCurrency || 'USD';
    }

    const result = await db.transaction(async (tx) => {
      const [rec] = await tx.insert(recurringInvoices).values({
        clientId: args.clientId,
        frequency: args.frequency,
        startDate: args.startDate,
        endDate: args.endDate || null,
        currency,
        autoSend: args.autoSend || false,
        notes: args.notes || null,
        terms: args.terms || null,
        taxRate: String(taxRate),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        nextRunDate: args.startDate,
      }).returning();

      const rows = items.map((item: any, idx: number) => ({
        recurringInvoiceId: rec.id,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        amount: String(item.quantity * item.unitPrice),
        sortOrder: idx,
      }));
      await tx.insert(recurringInvoiceLineItems).values(rows);

      await tx.insert(activityLog).values({
        entityType: 'recurring_invoice', entityId: rec.id,
        action: 'created', description: `Recurring invoice (${rec.frequency}) created via AI chat`,
        userId: ctx?.userId,
      });
      return rec;
    });

    return await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_recurring(args, ctx) {
    const { id, lineItems: items, taxRate, ...data } = args;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(recurringInvoices)
        .where(eq(recurringInvoices.id, id));
      if (!existing) throw new Error(`Recurring invoice #${id} not found`);

      const effectiveTax = taxRate ?? parseFloat(existing.taxRate);
      let updatePayload: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (taxRate !== undefined) updatePayload.taxRate = String(taxRate);

      if (items?.length) {
        const totals = calculateTotals(items, effectiveTax, 0);
        updatePayload = { ...updatePayload, ...totals };
        await tx.delete(recurringInvoiceLineItems)
          .where(eq(recurringInvoiceLineItems.recurringInvoiceId, id));
        const rows = items.map((item: any, idx: number) => ({
          recurringInvoiceId: id,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          amount: String(item.quantity * item.unitPrice),
          sortOrder: idx,
        }));
        await tx.insert(recurringInvoiceLineItems).values(rows);
      }

      const [updated] = await tx.update(recurringInvoices)
        .set(updatePayload).where(eq(recurringInvoices.id, id)).returning();
      await tx.insert(activityLog).values({
        entityType: 'recurring_invoice', entityId: id,
        action: 'updated', description: `Recurring invoice updated via AI chat`,
        userId: ctx?.userId,
      });
      return updated;
    });

    return await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async delete_recurring(args, ctx) {
    const [deleted] = await db.delete(recurringInvoices)
      .where(eq(recurringInvoices.id, args.id)).returning();
    if (!deleted) throw new Error(`Recurring invoice #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'recurring_invoice', entityId: deleted.id,
      action: 'deleted', description: `Recurring invoice deleted via AI chat`,
      userId: ctx?.userId,
    });
    return { message: 'Recurring invoice deleted' };
  },

  async toggle_recurring(args, ctx) {
    const [existing] = await db.select().from(recurringInvoices)
      .where(eq(recurringInvoices.id, args.id));
    if (!existing) throw new Error(`Recurring invoice #${args.id} not found`);

    const [updated] = await db.update(recurringInvoices)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(recurringInvoices.id, args.id)).returning();
    const status = updated.isActive ? 'activated' : 'deactivated';
    await db.insert(activityLog).values({
      entityType: 'recurring_invoice', entityId: args.id,
      action: status, description: `Recurring invoice ${status} via AI chat`,
      userId: ctx?.userId,
    });
    return updated;
  },

  // -- Bank Accounts --
  async list_bank_accounts(args) {
    const conditions = args.activeOnly ? eq(bankAccounts.isActive, true) : undefined;
    return await db.select().from(bankAccounts).where(conditions).orderBy(desc(bankAccounts.createdAt));
  },

  async get_bank_account(args) {
    const result = await db.query.bankAccounts.findFirst({
      where: eq(bankAccounts.id, args.id),
      with: { transactions: { orderBy: [desc(transactions.date)] } },
    });
    if (!result) throw new Error(`Bank account #${args.id} not found`);
    return result;
  },

  async create_bank_account(args, ctx) {
    const balance = args.initialBalance ?? 0;
    const [account] = await db.insert(bankAccounts).values({
      name: args.name, bankName: args.bankName, accountNumber: args.accountNumber,
      currency: args.currency || 'USD',
      initialBalance: String(balance), currentBalance: String(balance),
      notes: args.notes,
      provider: args.provider || 'manual',
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'bank_account', entityId: account.id,
      action: 'created', description: `Bank account "${args.name}" created via AI chat`,
      userId: ctx?.userId,
    });
    return account;
  },

  async update_bank_account(args) {
    const { id, ...data } = args;
    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.initialBalance !== undefined) updates.initialBalance = String(data.initialBalance);

    const result = await db.transaction(async (tx) => {
      const [account] = await tx.update(bankAccounts)
        .set(updates as any).where(eq(bankAccounts.id, id)).returning();
      if (!account) throw new Error(`Bank account #${id} not found`);
      if (data.initialBalance !== undefined) await recalculateBalance(tx, id);
      const [updated] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, id));
      return updated;
    });
    return result;
  },

  async delete_bank_account(args, ctx) {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, args.id));
    if (!account) throw new Error(`Bank account #${args.id} not found`);
    await db.delete(bankAccounts).where(eq(bankAccounts.id, args.id));
    await db.insert(activityLog).values({
      entityType: 'bank_account', entityId: args.id,
      action: 'deleted', description: `Bank account "${account.name}" deleted via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Bank account "${account.name}" deleted` };
  },

  async connect_paypal(args, ctx) {
    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, args.bankAccountId));
    if (!account) throw new Error(`Bank account #${args.bankAccountId} not found`);

    // Read credentials from settings
    const [s] = await db.select().from(settings);
    if (!s?.paypalEnabled || !s.paypalClientId || !s.paypalClientSecret) {
      throw new Error(
        'PayPal is not configured. Go to Settings to add your PayPal API credentials.',
      );
    }
    const env = (s.paypalEnvironment || 'sandbox') as 'sandbox' | 'live';

    // Validate credentials
    const { accessToken, expiresIn } = await getPayPalAccessToken(
      s.paypalClientId, s.paypalClientSecret, env,
    );

    await db.update(bankAccounts).set({
      provider: 'paypal',
      updatedAt: new Date(),
    }).where(eq(bankAccounts.id, args.bankAccountId));

    await db.delete(bankSessions).where(
      eq(bankSessions.bankAccountId, args.bankAccountId),
    );
    await db.insert(bankSessions).values({
      bankAccountId: args.bankAccountId,
      provider: 'paypal',
      token: accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      metadata: { environment: env },
    });

    await db.insert(activityLog).values({
      entityType: 'bank_account', entityId: args.bankAccountId,
      action: 'paypal_connected',
      description: `PayPal connected to "${account.name}" via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `PayPal connected to "${account.name}"` };
  },

  async sync_bank_account(args, ctx) {
    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, args.bankAccountId));
    if (!account) throw new Error(`Bank account #${args.bankAccountId} not found`);
    if (account.provider === 'manual') {
      throw new Error('Manual accounts cannot be synced');
    }

    await db.update(bankAccounts).set({
      lastSyncStatus: 'syncing', updatedAt: new Date(),
    }).where(eq(bankAccounts.id, args.bankAccountId));

    let imported = 0, skipped = 0;
    const errors: string[] = [];

    try {
      if (account.provider === 'paypal') {
        // Read credentials from settings
        const [s] = await db.select().from(settings);
        if (!s?.paypalEnabled || !s.paypalClientId || !s.paypalClientSecret) {
          throw new Error('PayPal is not configured in Settings.');
        }
        const env = (s.paypalEnvironment || 'sandbox') as 'sandbox' | 'live';

        // Get or refresh token
        const [session] = await db.select().from(bankSessions)
          .where(and(
            eq(bankSessions.bankAccountId, args.bankAccountId),
            eq(bankSessions.provider, 'paypal'),
          ));
        let accessToken: string;
        if (session && new Date(session.expiresAt) > new Date()) {
          accessToken = session.token;
        } else {
          const result = await getPayPalAccessToken(
            s.paypalClientId, s.paypalClientSecret, env,
          );
          accessToken = result.accessToken;
          if (session) {
            await db.update(bankSessions).set({
              token: accessToken,
              expiresAt: new Date(Date.now() + result.expiresIn * 1000),
            }).where(eq(bankSessions.id, session.id));
          } else {
            await db.insert(bankSessions).values({
              bankAccountId: args.bankAccountId,
              provider: 'paypal', token: accessToken,
              expiresAt: new Date(Date.now() + result.expiresIn * 1000),
            });
          }
        }

        const txns = await fetchPayPalTransactions(
          accessToken, env, args.fromDate, args.toDate,
        );

        for (const txn of txns) {
          const mapped = mapPayPalTransactionToLocal(txn);
          if (!mapped) { skipped++; continue; }

          const [existing] = await db.select({ id: transactions.id })
            .from(transactions)
            .where(and(
              eq(transactions.bankAccountId, args.bankAccountId),
              eq(transactions.bankReference, mapped.bankReference),
            ));
          if (existing) { skipped++; continue; }

          await db.insert(transactions).values({
            bankAccountId: args.bankAccountId,
            type: mapped.type, category: mapped.category,
            amount: String(mapped.amount), date: mapped.date,
            description: mapped.description, notes: mapped.notes,
            bankReference: mapped.bankReference,
            supplierName: mapped.supplierName,
            isFromBank: true, bankSyncedAt: mapped.bankSyncedAt,
          });
          imported++;
        }
      }

      await db.transaction(async (tx) => {
        await recalculateBalance(tx, args.bankAccountId);
      });
      await db.update(bankAccounts).set({
        lastSyncAt: new Date(), lastSyncStatus: 'success', updatedAt: new Date(),
      }).where(eq(bankAccounts.id, args.bankAccountId));
    } catch (err: any) {
      errors.push(err.message);
      await db.update(bankAccounts).set({
        lastSyncStatus: 'failed', updatedAt: new Date(),
      }).where(eq(bankAccounts.id, args.bankAccountId));
    }

    await db.insert(activityLog).values({
      entityType: 'bank_account', entityId: args.bankAccountId,
      action: 'synced',
      description: `Synced ${imported} transactions (${skipped} skipped) via AI chat`,
      userId: ctx?.userId,
    });
    return { imported, skipped, errors, bankAccountId: args.bankAccountId };
  },

  // -- Transactions --
  async list_transactions(args) {
    const conditions: ReturnType<typeof eq>[] = [];
    if (args.bankAccountId) conditions.push(eq(transactions.bankAccountId, args.bankAccountId));
    if (args.type) conditions.push(eq(transactions.type, args.type));
    if (args.category) conditions.push(eq(transactions.category, args.category));
    if (args.search) conditions.push(ilike(transactions.description, `%${args.search}%`));
    const where = conditions.length ? and(...conditions) : undefined;

    return await db.query.transactions.findMany({
      where,
      with: { bankAccount: true },
      orderBy: [desc(transactions.date)],
      limit: 50,
    });
  },

  async get_transaction(args) {
    const result = await db.query.transactions.findFirst({
      where: eq(transactions.id, args.id),
      with: { bankAccount: true },
    });
    if (!result) throw new Error(`Transaction #${args.id} not found`);
    return result;
  },

  async create_transaction(args, ctx) {
    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, args.bankAccountId));
    if (!account) throw new Error(`Bank account #${args.bankAccountId} not found`);

    const result = await db.transaction(async (tx) => {
      const [txn] = await tx.insert(transactions).values({
        bankAccountId: args.bankAccountId, type: args.type,
        category: args.category, amount: String(args.amount),
        date: args.date, description: args.description, notes: args.notes,
      }).returning();
      await recalculateBalance(tx, args.bankAccountId);
      await tx.insert(activityLog).values({
        entityType: 'transaction', entityId: txn.id, action: 'created',
        description: `${args.type} transaction of ${args.amount} created via AI chat`,
        userId: ctx?.userId,
      });
      return txn;
    });
    return result;
  },

  async update_transaction(args) {
    const { id, ...data } = args;
    const [existing] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!existing) throw new Error(`Transaction #${id} not found`);

    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (updates.amount !== undefined) updates.amount = String(updates.amount);

    const result = await db.transaction(async (tx) => {
      const [txn] = await tx.update(transactions)
        .set(updates as any).where(eq(transactions.id, id)).returning();
      await recalculateBalance(tx, existing.bankAccountId);
      return txn;
    });
    return result;
  },

  async delete_transaction(args, ctx) {
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, args.id));
    if (!txn) throw new Error(`Transaction #${args.id} not found`);

    await db.transaction(async (tx) => {
      await tx.delete(transactions).where(eq(transactions.id, args.id));
      await recalculateBalance(tx, txn.bankAccountId);
      await tx.insert(activityLog).values({
        entityType: 'transaction', entityId: args.id, action: 'deleted',
        description: `Transaction deleted via AI chat`,
        userId: ctx?.userId,
      });
    });
    return { message: 'Transaction deleted' };
  },

  // -- History / Logs --
  async get_activity_log(args) {
    const conditions = [];
    if (args.entityType) conditions.push(eq(activityLog.entityType, args.entityType));
    const where = conditions.length ? and(...conditions) : undefined;
    const limit = Math.min(50, Math.max(1, args.limit || 20));

    const entries = await db.select().from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);

    return entries.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      description: e.description,
      createdAt: e.createdAt,
    }));
  },

  async get_email_log(args) {
    const conditions = [];
    if (args.invoiceId) conditions.push(eq(emailLog.invoiceId, args.invoiceId));
    if (args.quoteId) conditions.push(eq(emailLog.quoteId, args.quoteId));
    const where = conditions.length ? and(...conditions) : undefined;
    const limit = Math.min(50, Math.max(1, args.limit || 20));

    const entries = await db.select().from(emailLog)
      .where(where)
      .orderBy(desc(emailLog.sentAt))
      .limit(limit);

    return entries.map((e) => ({
      id: e.id,
      invoiceId: e.invoiceId,
      quoteId: e.quoteId,
      recipientEmail: e.recipientEmail,
      subject: e.subject,
      status: e.status,
      sentAt: e.sentAt,
    }));
  },

  // -- Batch Operations --
  async batch_update_invoice_status(args, ctx) {
    const { invoiceIds, status } = args;
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      throw new Error('No invoice IDs provided');
    }
    if (invoiceIds.length > 50) {
      throw new Error('Cannot update more than 50 invoices at once');
    }

    const results: { id: number; invoiceNumber: string; status: string }[] = [];
    const skipped: number[] = [];
    for (const id of invoiceIds) {
      // Skip written-off invoices
      const [existing] = await db.select({ status: invoices.status })
        .from(invoices).where(eq(invoices.id, id));
      if (existing?.status === 'written_off') {
        skipped.push(id);
        continue;
      }

      const updateData: Record<string, unknown> = {
        status, updatedAt: new Date(),
      };
      if (status === 'sent') updateData.sentAt = new Date();
      if (status === 'paid') updateData.paidAt = new Date();

      const [updated] = await db.update(invoices)
        .set(updateData).where(eq(invoices.id, id)).returning();
      if (updated) {
        results.push({
          id: updated.id,
          invoiceNumber: updated.invoiceNumber,
          status: updated.status,
        });
        await db.insert(activityLog).values({
          entityType: 'invoice', entityId: id, action: 'status_changed',
          description: `Invoice ${updated.invoiceNumber} batch status changed to "${status}" via AI chat`,
          userId: ctx?.userId,
        });
      }
    }
    return {
      message: `Updated ${results.length} invoice(s) to "${status}"${skipped.length ? `, skipped ${skipped.length} written-off invoice(s)` : ''}`,
      invoices: results,
    };
  },

  // -- Import --
  async import_invoices_from_data(args, ctx) {
    const { invoices: invoiceList } = args;
    if (!Array.isArray(invoiceList) || invoiceList.length === 0) {
      throw new Error('No invoices to import');
    }
    if (invoiceList.length > 50) {
      throw new Error('Cannot import more than 50 invoices at once');
    }

    // Fetch defaults
    const [s] = await db.select().from(settings).limit(1);
    const defaultCurrency = s?.defaultCurrency || 'USD';
    const defaultPaymentTerms = s?.defaultPaymentTerms ?? 30;

    const results: { id: number; invoiceNumber: string; clientName: string; total: string }[] = [];

    for (const inv of invoiceList) {
      // Look up or create client
      let clientId: number | null = null;
      if (inv.clientName) {
        const [existing] = await db.select().from(clients)
          .where(ilike(clients.name, inv.clientName)).limit(1);
        if (existing) {
          clientId = existing.id;
        } else {
          // Create new client
          const [newClient] = await db.insert(clients).values({
            name: inv.clientName,
            email: inv.clientEmail || null,
          }).returning();
          clientId = newClient.id;
          await db.insert(activityLog).values({
            entityType: 'client', entityId: newClient.id,
            action: 'created',
            description: `Client "${newClient.name}" auto-created during invoice import`,
            userId: ctx?.userId,
          });
        }
      }

      const isTaxable = inv.isTaxable === true;
      const taxRate = isTaxable ? (s?.defaultTaxRate ? parseFloat(String(s.defaultTaxRate)) : 16) : 0;
      const items = inv.lineItems || [];
      const totals = calculateTotals(items, taxRate, 0);
      const currency = inv.currency || defaultCurrency;

      const issueDate = inv.issueDate;
      let dueDate = inv.dueDate;
      if (!dueDate) {
        const d = new Date(issueDate);
        d.setDate(d.getDate() + defaultPaymentTerms);
        dueDate = d.toISOString().split('T')[0];
      }

      const created = await db.transaction(async (tx) => {
        const invoiceNumber = await generateInvoiceNumber(tx, isTaxable);
        const [newInv] = await tx.insert(invoices).values({
          clientId,
          issueDate,
          dueDate,
          currency,
          notes: inv.notes || null,
          invoiceNumber,
          isTaxable,
          taxRate: String(taxRate),
          discountAmount: '0',
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          status: 'draft',
        }).returning();

        if (items.length > 0) {
          const rows = items.map((item: any, idx: number) => ({
            invoiceId: newInv.id,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            amount: String(item.quantity * item.unitPrice),
            sortOrder: idx,
          }));
          await tx.insert(invoiceLineItems).values(rows);
        }

        await tx.insert(activityLog).values({
          entityType: 'invoice', entityId: newInv.id,
          action: 'created',
          description: `Invoice ${newInv.invoiceNumber} imported via AI chat`,
          userId: ctx?.userId,
        });
        return newInv;
      });

      results.push({
        id: created.id,
        invoiceNumber: created.invoiceNumber,
        clientName: inv.clientName,
        total: totals.total,
      });
    }

    return {
      message: `Imported ${results.length} invoice(s)`,
      invoices: results,
    };
  },

  async import_transactions_from_text(args, ctx) {
    const { bankAccountId, transactions: txns } = args;
    if (!Array.isArray(txns) || txns.length === 0) {
      throw new Error('No transactions to import');
    }
    if (txns.length > 100) {
      throw new Error('Cannot import more than 100 transactions at once');
    }

    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, bankAccountId));
    if (!account) throw new Error(`Bank account #${bankAccountId} not found`);

    const result = await db.transaction(async (tx) => {
      const imported: any[] = [];
      for (const t of txns) {
        const [txn] = await tx.insert(transactions).values({
          bankAccountId,
          type: t.type,
          category: t.category,
          amount: String(t.amount),
          date: t.date,
          description: t.description,
          notes: t.notes || null,
        }).returning();
        imported.push(txn);
      }
      await recalculateBalance(tx, bankAccountId);
      await tx.insert(activityLog).values({
        entityType: 'bank_account', entityId: bankAccountId,
        action: 'import', description: `${imported.length} transactions imported via AI chat`,
        userId: ctx?.userId,
      });
      return imported;
    });
    return {
      message: `Imported ${result.length} transaction(s) to "${account.name}"`,
      count: result.length,
    };
  },

  // -- Navigation --
  async navigate_to(args) {
    return { navigate: args.path, message: `Navigating to ${args.path}` };
  },

  // -- Settings --
  async get_settings() {
    let [settingsRow] = await db.select().from(settings).limit(1);
    if (!settingsRow) {
      const [created] = await db.insert(settings).values({}).returning();
      settingsRow = created;
    }
    return settingsRow;
  },

  async update_settings(args) {
    let [settingsRow] = await db.select().from(settings).limit(1);
    if (!settingsRow) {
      const [created] = await db.insert(settings).values(args).returning();
      return created;
    }
    const updatePayload: Record<string, unknown> = { ...args, updatedAt: new Date() };
    if (args.defaultTaxRate !== undefined) updatePayload.defaultTaxRate = String(args.defaultTaxRate);
    if (args.personalExemption !== undefined) updatePayload.personalExemption = String(args.personalExemption);
    if (args.familyExemption !== undefined) updatePayload.familyExemption = String(args.familyExemption);
    if (args.additionalExemptions !== undefined) updatePayload.additionalExemptions = String(args.additionalExemptions);
    const [updated] = await db.update(settings)
      .set(updatePayload).where(eq(settings.id, settingsRow.id)).returning();
    return updated;
  },

  // -- Dashboard --
  async get_dashboard_stats() {
    const [revenueResult] = await db.select({ value: sum(invoices.total) })
      .from(invoices).where(eq(invoices.status, 'paid'));
    const totalRevenue = parseFloat(revenueResult?.value ?? '0');

    const [outstandingResult] = await db.select({
      value: sql<string>`COALESCE(SUM(CAST(${invoices.total} AS NUMERIC) - CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
    }).from(invoices).where(or(eq(invoices.status, 'sent'), eq(invoices.status, 'partially_paid')));
    const outstandingAmount = parseFloat(outstandingResult?.value ?? '0');

    const [overdueResult] = await db.select({
      value: sql<string>`COALESCE(SUM(CAST(${invoices.total} AS NUMERIC) - CAST(${invoices.amountPaid} AS NUMERIC)), 0)`,
    }).from(invoices).where(eq(invoices.status, 'overdue'));
    const overdueAmount = parseFloat(overdueResult?.value ?? '0');

    const [invoiceCountResult] = await db.select({ value: count() }).from(invoices);
    const [clientCountResult] = await db.select({ value: count() }).from(clients);

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const [paidResult] = await db.select({ value: sum(payments.amount) })
      .from(payments).where(sql`${payments.paymentDate} >= ${firstOfMonth}`);

    const [bankResult] = await db.select({ value: sum(bankAccounts.currentBalance) })
      .from(bankAccounts).where(eq(bankAccounts.isActive, true));

    const [expenseResult] = await db.select({ value: sum(transactions.amount) })
      .from(transactions).where(and(eq(transactions.type, 'expense'), sql`${transactions.date} >= ${firstOfMonth}`));

    return {
      totalRevenue,
      outstandingAmount,
      overdueAmount,
      totalInvoices: invoiceCountResult?.value ?? 0,
      totalClients: clientCountResult?.value ?? 0,
      paidThisMonth: parseFloat(paidResult?.value ?? '0'),
      totalBankBalance: parseFloat(bankResult?.value ?? '0'),
      monthlyExpenses: parseFloat(expenseResult?.value ?? '0'),
    };
  },

  // -- JoFotara (Jordan e-Invoicing) --
  async submit_to_jofotara(args) {
    const invoiceId = args.invoiceId;
    const [invoice] = await db.select({ isTaxable: invoices.isTaxable })
      .from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error(`Invoice #${invoiceId} not found`);
    if (!invoice.isTaxable) {
      throw new Error('Only taxable invoices (INV) can be submitted to JoFotara');
    }

    const result = await submitInvoiceToJofotara(invoiceId, {
      paymentMethod: args.paymentMethod,
      invoiceType: args.invoiceType,
    });

    if (!result.success) {
      const errorDetails = result.errors.map((e: any) => e.message).join('; ');
      throw new Error(errorDetails || 'JoFotara submission failed');
    }

    return result.submission;
  },

  async submit_credit_note(args) {
    const result = await submitCreditInvoice(args.invoiceId, {
      originalInvoiceId: args.originalInvoiceId,
      reasonForReturn: args.reasonForReturn,
      paymentMethod: args.paymentMethod || 'cash',
    });

    if (!result.success) {
      const errorDetails = result.errors.map((e: any) => e.message).join('; ');
      throw new Error(errorDetails || 'Credit note submission failed');
    }

    return result.submission;
  },

  async validate_for_jofotara(args) {
    const result = await preValidateInvoice(args.invoiceId);
    return result;
  },

  async get_jofotara_submissions(args) {
    const submissions = await getSubmissionHistory(args.invoiceId);
    return submissions;
  },

  // -- Tax Reports --
  async get_sales_tax_report(args) {
    const year = args.year;
    const periodIdx = args.period;
    let range: { startDate: string; endDate: string; label: string; deadline: string };

    if (year && periodIdx !== undefined) {
      const p = getBimonthlyPeriod(Number(year), Number(periodIdx));
      range = {
        startDate: p.startDate, endDate: p.endDate,
        label: `${p.label} ${p.year}`, deadline: p.deadlineDate,
      };
    } else {
      const p = getCurrentBimonthlyPeriod();
      range = {
        startDate: p.startDate, endDate: p.endDate,
        label: `${p.label} ${p.year}`, deadline: p.deadlineDate,
      };
    }

    const invoiceRows = await db
      .select({
        id: invoices.id, invoiceNumber: invoices.invoiceNumber,
        clientName: clients.name, issueDate: invoices.issueDate,
        subtotal: invoices.subtotal, taxAmount: invoices.taxAmount,
        total: invoices.total, isTaxable: invoices.isTaxable,
        status: invoices.status,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(
        sql`${invoices.issueDate} >= ${range.startDate}`,
        sql`${invoices.issueDate} <= ${range.endDate}`,
        sql`${invoices.status} NOT IN ('draft', 'cancelled')`,
      ))
      .orderBy(invoices.issueDate);

    let taxableSales = 0, exemptSales = 0, outputTax = 0;
    const rows = invoiceRows.map((row) => {
      const subtotal = parseFloat(String(row.subtotal));
      const tax = parseFloat(String(row.taxAmount));
      if (row.isTaxable) { taxableSales += subtotal; outputTax += tax; }
      else { exemptSales += subtotal; }
      return {
        id: row.id, invoiceNumber: row.invoiceNumber,
        clientName: row.clientName, issueDate: row.issueDate,
        subtotal, taxAmount: tax,
        total: parseFloat(String(row.total)),
        isTaxable: row.isTaxable, status: row.status,
      };
    });

    return {
      period: range, taxableSales, exemptSales,
      totalSales: taxableSales + exemptSales,
      outputTax, invoiceCount: rows.length, invoices: rows,
    };
  },

  async get_purchases_report(args) {
    const year = args.year;
    const periodIdx = args.period;
    let range: { startDate: string; endDate: string; label: string };

    if (year && periodIdx !== undefined) {
      const p = getBimonthlyPeriod(Number(year), Number(periodIdx));
      range = { startDate: p.startDate, endDate: p.endDate, label: `${p.label} ${p.year}` };
    } else {
      const p = getCurrentBimonthlyPeriod();
      range = { startDate: p.startDate, endDate: p.endDate, label: `${p.label} ${p.year}` };
    }

    const txnRows = await db.select().from(transactions)
      .where(and(
        eq(transactions.type, 'expense'),
        sql`${transactions.date} >= ${range.startDate}`,
        sql`${transactions.date} <= ${range.endDate}`,
      ))
      .orderBy(transactions.date);

    let totalPurchases = 0, inputTax = 0;
    const rows = txnRows.map((row) => {
      const amount = parseFloat(String(row.amount));
      const tax = row.taxAmount ? parseFloat(String(row.taxAmount)) : 0;
      totalPurchases += amount;
      inputTax += tax;
      return {
        id: row.id, date: row.date, description: row.description,
        supplierName: row.supplierName, category: row.category,
        amount, taxAmount: tax,
      };
    });

    return {
      period: range, totalPurchases, inputTax,
      transactionCount: rows.length, transactions: rows,
    };
  },

  async get_gst_summary(args) {
    const year = args.year;
    const periodIdx = args.period;
    let startDate: string, endDate: string, label: string, deadline: string;

    if (year && periodIdx !== undefined) {
      const p = getBimonthlyPeriod(Number(year), Number(periodIdx));
      startDate = p.startDate; endDate = p.endDate;
      label = `${p.label} ${p.year}`; deadline = p.deadlineDate;
    } else {
      const p = getCurrentBimonthlyPeriod();
      startDate = p.startDate; endDate = p.endDate;
      label = `${p.label} ${p.year}`; deadline = p.deadlineDate;
    }

    const [taxableSalesResult] = await db.select({
      subtotal: sql<string>`COALESCE(SUM(CAST(${invoices.subtotal} AS NUMERIC)), 0)`,
      tax: sql<string>`COALESCE(SUM(CAST(${invoices.taxAmount} AS NUMERIC)), 0)`,
    }).from(invoices).where(and(
      sql`${invoices.issueDate} >= ${startDate}`,
      sql`${invoices.issueDate} <= ${endDate}`,
      sql`${invoices.status} NOT IN ('draft', 'cancelled')`,
      eq(invoices.isTaxable, true),
    ));

    const [exemptSalesResult] = await db.select({
      subtotal: sql<string>`COALESCE(SUM(CAST(${invoices.subtotal} AS NUMERIC)), 0)`,
    }).from(invoices).where(and(
      sql`${invoices.issueDate} >= ${startDate}`,
      sql`${invoices.issueDate} <= ${endDate}`,
      sql`${invoices.status} NOT IN ('draft', 'cancelled')`,
      eq(invoices.isTaxable, false),
    ));

    const [purchasesResult] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
      tax: sql<string>`COALESCE(SUM(CAST(${transactions.taxAmount} AS NUMERIC)), 0)`,
    }).from(transactions).where(and(
      eq(transactions.type, 'expense'),
      sql`${transactions.date} >= ${startDate}`,
      sql`${transactions.date} <= ${endDate}`,
    ));

    const outputTax = parseFloat(taxableSalesResult?.tax ?? '0');
    const inputTax = parseFloat(purchasesResult?.tax ?? '0');

    return {
      period: { startDate, endDate, label, deadline },
      taxableSales: parseFloat(taxableSalesResult?.subtotal ?? '0'),
      exemptSales: parseFloat(exemptSalesResult?.subtotal ?? '0'),
      totalPurchases: parseFloat(purchasesResult?.total ?? '0'),
      outputTax, inputTax, netTax: outputTax - inputTax,
    };
  },

  async get_income_tax_report(args) {
    const year = Number(args.year) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [settingsRow] = await db.select().from(settings).limit(1);
    const filingStatus = settingsRow?.filingStatus ?? 'single';
    const personalExemption = parseFloat(String(settingsRow?.personalExemption ?? '9000'));
    const familyExemption = filingStatus === 'married'
      ? parseFloat(String(settingsRow?.familyExemption ?? '9000')) : 0;
    const additionalExemptions = parseFloat(String(settingsRow?.additionalExemptions ?? '0'));

    const [revenueResult] = await db.select({
      value: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)`,
    }).from(payments).where(and(
      sql`${payments.paymentDate} >= ${startDate}`,
      sql`${payments.paymentDate} <= ${endDate}`,
    ));

    const [expensesResult] = await db.select({
      value: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
    }).from(transactions).where(and(
      eq(transactions.type, 'expense'),
      sql`${transactions.date} >= ${startDate}`,
      sql`${transactions.date} <= ${endDate}`,
    ));

    const categoryRows = await db.select({
      category: transactions.category,
      total: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
    }).from(transactions).where(and(
      eq(transactions.type, 'expense'),
      sql`${transactions.date} >= ${startDate}`,
      sql`${transactions.date} <= ${endDate}`,
    )).groupBy(transactions.category)
      .orderBy(sql`SUM(CAST(${transactions.amount} AS NUMERIC)) DESC`);

    const totalRevenue = parseFloat(revenueResult?.value ?? '0');
    const totalExpenses = parseFloat(expensesResult?.value ?? '0');
    const grossProfit = totalRevenue - totalExpenses;
    const totalExemptions = personalExemption + familyExemption + additionalExemptions;
    const taxableIncome = Math.max(0, grossProfit - totalExemptions);
    const { tax: totalTax, brackets, nationalContribution } = calculateIncomeTax(taxableIncome);

    return {
      year, totalRevenue, totalExpenses, grossProfit,
      expensesByCategory: categoryRows.map((r) => ({
        category: r.category, amount: parseFloat(r.total ?? '0'),
      })),
      personalExemption, familyExemption, additionalExemptions, totalExemptions,
      taxableIncome, taxBrackets: brackets,
      totalTax, nationalContribution,
      totalLiability: totalTax + nationalContribution,
    };
  },

  async get_profit_loss_report(args) {
    const now = new Date();
    const startDate = args.startDate || `${now.getFullYear()}-01-01`;
    const endDate = args.endDate || now.toISOString().split('T')[0];

    const revenueByMonth = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', CAST(payment_date AS DATE)), 'YYYY-MM') AS month,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
      FROM payments
      WHERE payment_date >= ${startDate} AND payment_date <= ${endDate}
      GROUP BY DATE_TRUNC('month', CAST(payment_date AS DATE))
      ORDER BY month
    `);

    const expensesByMonth = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', CAST(date AS DATE)), 'YYYY-MM') AS month,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
      FROM transactions
      WHERE type = 'expense' AND date >= ${startDate} AND date <= ${endDate}
      GROUP BY DATE_TRUNC('month', CAST(date AS DATE))
      ORDER BY month
    `);

    const expensesByCat = await db.execute(sql`
      SELECT category, COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
      FROM transactions
      WHERE type = 'expense' AND date >= ${startDate} AND date <= ${endDate}
      GROUP BY category ORDER BY amount DESC
    `);

    const revenueMonths = (revenueByMonth.rows as any[]).map((r) => ({
      month: r.month, amount: parseFloat(r.amount ?? '0'),
    }));
    const totalRevenue = revenueMonths.reduce((s, r) => s + r.amount, 0);
    const expenseMonths = (expensesByMonth.rows as any[]).map((r) => ({
      month: r.month, amount: parseFloat(r.amount ?? '0'),
    }));
    const totalExpenses = expenseMonths.reduce((s, r) => s + r.amount, 0);
    const byCategory = (expensesByCat.rows as any[]).map((r) => ({
      category: r.category, amount: parseFloat(r.amount ?? '0'),
    }));

    return {
      period: { startDate, endDate },
      revenue: { total: totalRevenue, byMonth: revenueMonths },
      expenses: { total: totalExpenses, byCategory: byCategory, byMonth: expenseMonths },
      netProfit: totalRevenue - totalExpenses,
    };
  },

  async get_tax_deadlines() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const deadlines: {
      type: string; label: string; period: string;
      deadline: string; daysUntil: number;
    }[] = [];

    const currentYear = now.getFullYear();
    const periods = [
      ...getYearBimonthlyPeriods(currentYear),
      ...getYearBimonthlyPeriods(currentYear + 1),
    ];

    for (const p of periods) {
      if (p.deadlineDate >= today) {
        const daysUntil = Math.ceil(
          (new Date(p.deadlineDate).getTime() - now.getTime()) / 86400000,
        );
        deadlines.push({
          type: 'gst', label: 'GST Filing (إقرار ضريبة المبيعات)',
          period: `${p.label} ${p.year}`, deadline: p.deadlineDate, daysUntil,
        });
        if (deadlines.length >= 3) break;
      }
    }

    let incomeTaxYear = currentYear - 1;
    let incomeTaxDeadline = `${currentYear}-04-30`;
    if (today > incomeTaxDeadline) {
      incomeTaxYear = currentYear;
      incomeTaxDeadline = `${currentYear + 1}-04-30`;
    }
    const daysUntilIncomeTax = Math.ceil(
      (new Date(incomeTaxDeadline).getTime() - now.getTime()) / 86400000,
    );
    deadlines.push({
      type: 'income_tax', label: 'Annual Income Tax (إقرار ضريبة الدخل السنوي)',
      period: String(incomeTaxYear), deadline: incomeTaxDeadline, daysUntil: daysUntilIncomeTax,
    });

    deadlines.sort((a, b) => a.daysUntil - b.daysUntil);
    return deadlines;
  },

  async generate_export_link(args) {
    let data;
    switch (args.entityType) {
      case 'clients':
        data = await db.query.clients.findMany();
        break;
      case 'invoices':
        data = await db.query.invoices.findMany();
        break;
      case 'quotes':
        data = await db.query.quotes.findMany();
        break;
      case 'transactions':
        data = await db.query.transactions.findMany();
        break;
      default:
        throw new Error('Unsupported entity type');
    }

    if (!data || data.length === 0) {
      return { message: `No ${args.entityType} found to export.` };
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const csvData = XLSX.utils.sheet_to_csv(ws);
    const base64 = Buffer.from(csvData).toString('base64');
    const dataUri = `data:text/csv;base64,${base64}`;

    return {
      message: 'Here is the export link to provide.',
      markdownLink: `[Download ${args.entityType} CSV](${dataUri})`
    };
  },

  async generate_quote_template(args) {
    return {
      note: 'Output this rich markdown template to the user, adapting the placeholders as needed based on context.',
      markdownTemplate: `# Proposal for ${args.serviceType}\n\n**Prepared for:** ${args.clientName || '[Client Name]'}\n\n## Overview\n[Brief overview of the project and goals]\n\n## Scope of Work\n- [Deliverable 1]\n- [Deliverable 2]\n\n## Estimated Investment\n| Phase | Description | Cost |\n|---|---|---|\n| Phase 1 | [Description] | [Amount] |\n\n## Next Steps\n[How to proceed if accepted]\n\n*Note: Use the "Create a quote" button below to turn this into a formal quote.*`
    };
  },

  // -- Employees --
  async list_employees(args) {
    const conditions = [];
    if (args.search) {
      const pattern = `%${args.search}%`;
      conditions.push(or(ilike(employees.name, pattern), ilike(employees.email, pattern)));
    }
    if (args.active === 'true') {
      const { isNull: isNullFn } = await import('drizzle-orm');
      conditions.push(isNullFn(employees.endDate));
    } else if (args.active === 'false') {
      const { isNotNull: isNotNullFn } = await import('drizzle-orm');
      conditions.push(isNotNullFn(employees.endDate));
    }
    if (args.role) {
      conditions.push(eq(employees.role, args.role));
    }
    let query = db.select().from(employees).orderBy(desc(employees.createdAt));
    if (conditions.length === 1) {
      query = query.where(conditions[0]!) as typeof query;
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query;
  },

  async get_employee(args) {
    const emp = await db.query.employees.findFirst({
      where: eq(employees.id, args.id),
      with: { payrollEntries: true },
    });
    if (!emp) throw new Error(`Employee #${args.id} not found`);
    return emp;
  },

  async create_employee(args, ctx) {
    const [emp] = await db.insert(employees).values({
      name: args.name,
      role: args.role,
      baseSalary: String(args.baseSalary),
      transportAllowance: String(args.transportAllowance || 0),
      sskEnrolled: args.sskEnrolled ?? false,
      hireDate: args.hireDate,
      email: args.email || null,
      phone: args.phone || null,
      bankAccountName: args.bankAccountName || null,
      bankIban: args.bankIban || null,
      notes: args.notes || null,
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'employee', entityId: emp.id,
      action: 'created', description: `Employee "${emp.name}" created via AI chat`,
      userId: ctx?.userId,
    });
    return emp;
  },

  async batch_create_employees(args, ctx) {
    const employeeList = args.employees as any[];
    if (!employeeList?.length) throw new Error('No employees provided');
    const created = [];
    for (const empData of employeeList) {
      const [emp] = await db.insert(employees).values({
        name: empData.name,
        role: empData.role,
        baseSalary: String(empData.baseSalary),
        transportAllowance: String(empData.transportAllowance || 0),
        sskEnrolled: empData.sskEnrolled ?? false,
        hireDate: empData.hireDate,
        email: empData.email || null,
        phone: empData.phone || null,
        notes: empData.notes || null,
      }).returning();
      await db.insert(activityLog).values({
        entityType: 'employee', entityId: emp.id,
        action: 'created', description: `Employee "${emp.name}" created via AI chat (batch)`,
        userId: ctx?.userId,
      });
      created.push(emp);
    }
    return { created, count: created.length };
  },

  async update_employee(args, ctx) {
    const { id, ...data } = args;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.baseSalary !== undefined) updateData.baseSalary = String(data.baseSalary);
    if (data.transportAllowance !== undefined) updateData.transportAllowance = String(data.transportAllowance);
    if (data.sskEnrolled !== undefined) updateData.sskEnrolled = data.sskEnrolled;
    if (data.endDate !== undefined) updateData.endDate = data.endDate || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    const [updated] = await db.update(employees).set(updateData)
      .where(eq(employees.id, id)).returning();
    if (!updated) throw new Error(`Employee #${id} not found`);
    await db.insert(activityLog).values({
      entityType: 'employee', entityId: id,
      action: 'updated', description: `Employee "${updated.name}" updated via AI chat`,
      userId: ctx?.userId,
    });
    return updated;
  },

  async delete_employee(args, ctx) {
    const entries = await db.select({ id: payrollEntries.id })
      .from(payrollEntries).where(eq(payrollEntries.employeeId, args.id)).limit(1);
    if (entries.length > 0) throw new Error('Cannot delete employee with payroll entries');
    const [deleted] = await db.delete(employees).where(eq(employees.id, args.id)).returning();
    if (!deleted) throw new Error(`Employee #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'employee', entityId: args.id,
      action: 'deleted', description: `Employee "${deleted.name}" deleted via AI chat`,
      userId: ctx?.userId,
    });
    return { message: `Employee "${deleted.name}" deleted` };
  },

  // -- Payroll --
  async list_payroll_runs(args) {
    const conditions = [];
    if (args.year) conditions.push(eq(payrollRuns.year, args.year));
    if (args.status) conditions.push(eq(payrollRuns.status, args.status));
    let query = db.select().from(payrollRuns)
      .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query;
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query;
  },

  async get_payroll_run(args) {
    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, args.id),
      with: { entries: true },
    });
    if (!run) throw new Error(`Payroll run #${args.id} not found`);
    return run;
  },

  async get_payroll_summary(args) {
    const year = args.year || new Date().getFullYear();
    const runs = await db.select().from(payrollRuns)
      .where(eq(payrollRuns.year, year))
      .orderBy(payrollRuns.month);
    return {
      year,
      months: runs.map((r) => ({
        month: r.month,
        status: r.status,
        totalGross: parseFloat(r.totalGross || '0'),
        totalNet: parseFloat(r.totalNet || '0'),
        totalSskEmployer: parseFloat(r.totalSskEmployer || '0'),
        totalCompanyCost: parseFloat(r.totalCompanyCost || '0'),
      })),
      totals: {
        totalGross: runs.reduce((s, r) => s + parseFloat(r.totalGross || '0'), 0),
        totalNet: runs.reduce((s, r) => s + parseFloat(r.totalNet || '0'), 0),
        totalSskEmployer: runs.reduce((s, r) => s + parseFloat(r.totalSskEmployer || '0'), 0),
        totalCompanyCost: runs.reduce((s, r) => s + parseFloat(r.totalCompanyCost || '0'), 0),
      },
    };
  },

  async create_payroll_run(args, ctx) {
    const { year, month, standardWorkingDays: stdDaysArg, duplicateFromRunId } = args;
    const stdDays = stdDaysArg || STANDARD_WORKING_DAYS;

    const fullRun = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: payrollRuns.id }).from(payrollRuns)
        .where(and(eq(payrollRuns.year, year), eq(payrollRuns.month, month))).limit(1);
      if (existing.length > 0) {
        throw new Error(`Payroll run for ${year}-${String(month).padStart(2, '0')} already exists`);
      }

      const { isNull: isNullFn, lte: lteFn } = await import('drizzle-orm');
      const lastDayOfMonth = new Date(year, month, 0).toISOString().split('T')[0];
      const activeEmps = await tx.select().from(employees)
        .where(and(
          isNullFn(employees.endDate),
          lteFn(employees.hireDate, lastDayOfMonth),
        ));

      // If duplicating, fetch source entries
      let sourceEntries: typeof payrollEntries.$inferSelect[] = [];
      if (duplicateFromRunId) {
        sourceEntries = await tx.select().from(payrollEntries)
          .where(eq(payrollEntries.payrollRunId, duplicateFromRunId));
      }
      const sourceMap = new Map(sourceEntries.map((e) => [e.employeeId, e]));

      const [run] = await tx.insert(payrollRuns).values({
        year, month, standardWorkingDays: stdDays,
        entryCount: activeEmps.length,
      }).returning();

      if (activeEmps.length > 0) {
        const values = activeEmps.map((emp) => {
          const src = sourceMap.get(emp.id);
          const baseSalary = parseFloat(emp.baseSalary || '0');
          const transportAllowance = parseFloat(emp.transportAllowance || '0');
          // Only copy recurring items from source; one-time items (bonus, advance, otherDed) reset to 0
          const wdOT = src ? parseFloat(src.weekdayOvertimeHours || '0') : 0;
          const weOT = src ? parseFloat(src.weekendOvertimeHours || '0') : 0;
          const salDiff = src ? parseFloat(src.salaryDifference || '0') : 0;
          const workDays = src ? src.workingDays : stdDays;

          const calc = calculatePayrollEntry({
            baseSalary, workingDays: workDays, standardWorkingDays: stdDays,
            weekdayOvertimeHours: wdOT, weekendOvertimeHours: weOT,
            transportAllowance, bonus: 0, salaryDifference: salDiff,
            salaryAdvance: 0, otherDeductions: 0,
            sskEnrolled: emp.sskEnrolled,
          });
          return {
            payrollRunId: run.id, employeeId: emp.id,
            employeeName: emp.name, employeeRole: emp.role,
            baseSalary: String(baseSalary), sskEnrolled: emp.sskEnrolled,
            workingDays: workDays, standardWorkingDays: stdDays,
            basicSalary: String(calc.basicSalary),
            weekdayOvertimeHours: String(wdOT),
            weekdayOvertimeAmount: String(calc.weekdayOvertimeAmount),
            weekendOvertimeHours: String(weOT),
            weekendOvertimeAmount: String(calc.weekendOvertimeAmount),
            transportAllowance: String(transportAllowance),
            bonus: '0', salaryDifference: String(salDiff),
            grossSalary: String(calc.grossSalary),
            salaryAdvance: '0', otherDeductions: '0',
            sskEmployee: String(calc.sskEmployee),
            totalDeductions: String(calc.totalDeductions),
            netSalary: String(calc.netSalary), sskEmployer: String(calc.sskEmployer),
          };
        });
        await tx.insert(payrollEntries).values(values);
      }

      await recalculatePayrollRunTotals(tx, run.id);
      return await tx.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, run.id), with: { entries: true },
      });
    });

    if (fullRun) {
      const src = duplicateFromRunId ? ` (duplicated from run #${duplicateFromRunId})` : '';
      await db.insert(activityLog).values({
        entityType: 'payroll_run', entityId: fullRun.id,
        action: 'created',
        description: `Payroll ${year}-${String(month).padStart(2, '0')} created via AI chat (${fullRun.entryCount} employees)${src}`,
        userId: ctx?.userId,
      });
    }
    return fullRun;
  },

  async update_payroll_entry(args, ctx) {
    const { runId, entryId, ...data } = args;
    const run = await db.query.payrollRuns.findFirst({ where: eq(payrollRuns.id, runId) });
    if (!run) throw new Error(`Payroll run #${runId} not found`);
    if (run.status !== 'draft') throw new Error('Can only edit entries in draft runs');
    const entry = await db.query.payrollEntries.findFirst({
      where: and(eq(payrollEntries.id, entryId), eq(payrollEntries.payrollRunId, runId)),
    });
    if (!entry) throw new Error(`Entry #${entryId} not found in run #${runId}`);
    const merged = {
      baseSalary: parseFloat(entry.baseSalary || '0'),
      workingDays: data.workingDays ?? entry.workingDays,
      standardWorkingDays: entry.standardWorkingDays,
      weekdayOvertimeHours: data.weekdayOvertimeHours ?? parseFloat(entry.weekdayOvertimeHours || '0'),
      weekendOvertimeHours: data.weekendOvertimeHours ?? parseFloat(entry.weekendOvertimeHours || '0'),
      transportAllowance: parseFloat(entry.transportAllowance || '0'),
      bonus: data.bonus ?? parseFloat(entry.bonus || '0'),
      salaryDifference: data.salaryDifference ?? parseFloat(entry.salaryDifference || '0'),
      salaryAdvance: data.salaryAdvance ?? parseFloat(entry.salaryAdvance || '0'),
      otherDeductions: data.otherDeductions ?? parseFloat(entry.otherDeductions || '0'),
      sskEnrolled: entry.sskEnrolled,
    };
    const calc = calculatePayrollEntry(merged);
    const [updated] = await db.update(payrollEntries).set({
      workingDays: merged.workingDays,
      weekdayOvertimeHours: String(merged.weekdayOvertimeHours),
      weekendOvertimeHours: String(merged.weekendOvertimeHours),
      bonus: String(merged.bonus), salaryDifference: String(merged.salaryDifference),
      salaryAdvance: String(merged.salaryAdvance), otherDeductions: String(merged.otherDeductions),
      otherDeductionsNote: data.otherDeductionsNote !== undefined ? data.otherDeductionsNote : entry.otherDeductionsNote,
      basicSalary: String(calc.basicSalary), weekdayOvertimeAmount: String(calc.weekdayOvertimeAmount),
      weekendOvertimeAmount: String(calc.weekendOvertimeAmount), grossSalary: String(calc.grossSalary),
      sskEmployee: String(calc.sskEmployee), totalDeductions: String(calc.totalDeductions),
      netSalary: String(calc.netSalary), sskEmployer: String(calc.sskEmployer),
      updatedAt: new Date(),
    }).where(eq(payrollEntries.id, entryId)).returning();
    await recalculatePayrollRunTotals(db, runId);
    return updated;
  },

  async finalize_payroll_run(args, ctx) {
    const run = await db.query.payrollRuns.findFirst({ where: eq(payrollRuns.id, args.id) });
    if (!run) throw new Error(`Payroll run #${args.id} not found`);
    if (run.status !== 'draft') throw new Error('Can only finalize draft runs');
    const [updated] = await db.update(payrollRuns).set({
      status: 'finalized', finalizedAt: new Date(), updatedAt: new Date(),
    }).where(eq(payrollRuns.id, args.id)).returning();
    await db.insert(activityLog).values({
      entityType: 'payroll_run', entityId: args.id,
      action: 'finalized',
      description: `Payroll ${run.year}-${String(run.month).padStart(2, '0')} finalized via AI chat`,
      userId: ctx?.userId,
    });
    return updated;
  },

  async update_payroll_payment(args, ctx) {
    const { runId, entryId, paymentStatus, paymentDate, bankTrxReference, bankAccountId } = args;
    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, runId),
    });
    if (!run) throw new Error(`Payroll run #${runId} not found`);
    if (run.status === 'draft') {
      throw new Error('Finalize the payroll run before updating payments');
    }
    const entry = await db.query.payrollEntries.findFirst({
      where: and(eq(payrollEntries.id, entryId), eq(payrollEntries.payrollRunId, runId)),
    });
    if (!entry) throw new Error(`Entry #${entryId} not found in run #${runId}`);
    const [updated] = await db.update(payrollEntries).set({
      paymentStatus, paymentDate: paymentDate || null,
      bankTrxReference: bankTrxReference || null,
      bankAccountId: bankAccountId || null, updatedAt: new Date(),
    }).where(eq(payrollEntries.id, entryId)).returning();

    // Auto-create bank expense transaction when marking paid with a bank account
    if (paymentStatus === 'paid' && bankAccountId && entry.paymentStatus !== 'paid') {
      const netSalary = parseFloat(entry.netSalary || '0');
      if (netSalary > 0) {
        await db.transaction(async (tx) => {
          await tx.insert(transactions).values({
            bankAccountId,
            type: 'expense',
            category: 'salary',
            amount: String(netSalary),
            date: paymentDate || new Date().toISOString().split('T')[0],
            description: `Salary: ${entry.employeeName}`,
            bankReference: bankTrxReference || null,
          });
          await recalculateBalance(tx, bankAccountId);
        });
      }
    }

    // Reversal: if changing FROM 'paid' to something else, reverse the bank transaction
    if (entry.paymentStatus === 'paid' && paymentStatus !== 'paid' && entry.bankAccountId) {
      const netSalary = parseFloat(entry.netSalary || '0');
      if (netSalary > 0) {
        await db.transaction(async (tx) => {
          await tx.insert(transactions).values({
            bankAccountId: entry.bankAccountId!,
            type: 'income',
            category: 'salary',
            amount: String(netSalary),
            date: new Date().toISOString().split('T')[0],
            description: `Salary reversal: ${entry.employeeName}`,
          });
          await recalculateBalance(tx, entry.bankAccountId!);
        });
      }
    }

    return updated;
  },

  async update_payroll_run(args, ctx) {
    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, args.id),
    });
    if (!run) throw new Error(`Payroll run #${args.id} not found`);
    if (run.status !== 'draft') throw new Error('Can only update draft runs');
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (args.standardWorkingDays !== undefined) {
      updates.standardWorkingDays = args.standardWorkingDays;
    }
    if (args.notes !== undefined) updates.notes = args.notes;
    const [updated] = await db.update(payrollRuns)
      .set(updates)
      .where(eq(payrollRuns.id, args.id))
      .returning();
    return updated;
  },

  async delete_payroll_run(args, ctx) {
    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, args.id),
    });
    if (!run) throw new Error(`Payroll run #${args.id} not found`);
    if (run.status !== 'draft') {
      throw new Error('Can only delete draft runs');
    }
    await db.delete(payrollRuns).where(eq(payrollRuns.id, args.id));
    return { deleted: true, id: args.id };
  },

  async reopen_payroll_run(args, ctx) {
    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, args.id),
    });
    if (!run) throw new Error(`Payroll run #${args.id} not found`);
    if (run.status !== 'finalized') {
      throw new Error('Can only reopen finalized runs');
    }
    const [updated] = await db.update(payrollRuns)
      .set({ status: 'draft', finalizedAt: null, updatedAt: new Date() })
      .where(eq(payrollRuns.id, args.id))
      .returning();
    return updated;
  },

  async mark_all_paid(args, ctx) {
    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, args.id),
    });
    if (!run) throw new Error(`Payroll run #${args.id} not found`);
    if (run.status === 'draft') {
      throw new Error('Finalize the payroll run before marking entries paid');
    }
    const today = new Date().toISOString().split('T')[0];
    const bankAccountId = args.bankAccountId ?? null;

    const pendingEntries = await db.select()
      .from(payrollEntries)
      .where(and(
        eq(payrollEntries.payrollRunId, args.id),
        eq(payrollEntries.paymentStatus, 'pending'),
      ));

    await db.transaction(async (tx) => {
      await tx.update(payrollEntries)
        .set({
          paymentStatus: 'paid',
          paymentDate: today,
          bankAccountId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(payrollEntries.payrollRunId, args.id),
          eq(payrollEntries.paymentStatus, 'pending'),
        ));

      if (bankAccountId) {
        for (const entry of pendingEntries) {
          const netSalary = parseFloat(entry.netSalary || '0');
          if (netSalary > 0) {
            await tx.insert(transactions).values({
              bankAccountId,
              type: 'expense',
              category: 'salary',
              amount: String(netSalary),
              date: today,
              description: `Salary: ${entry.employeeName}`,
            });
          }
        }
        await recalculateBalance(tx, bankAccountId);
      }

      const remaining = await tx.select({ id: payrollEntries.id })
        .from(payrollEntries)
        .where(and(
          eq(payrollEntries.payrollRunId, args.id),
          ne(payrollEntries.paymentStatus, 'paid'),
        ))
        .limit(1);

      if (remaining.length === 0) {
        await tx.update(payrollRuns)
          .set({ status: 'paid', updatedAt: new Date() })
          .where(eq(payrollRuns.id, args.id));
      }
    });

    return { marked: pendingEntries.length, runId: args.id };
  },

  async add_employee_to_run(args, ctx) {
    const { runId, employeeId } = args;
    const result = await db.transaction(async (tx) => {
      const run = await tx.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, runId),
      });
      if (!run) throw new Error(`Payroll run #${runId} not found`);
      if (run.status !== 'draft') throw new Error('Can only add entries to draft runs');

      const existing = await tx.select({ id: payrollEntries.id })
        .from(payrollEntries)
        .where(and(
          eq(payrollEntries.payrollRunId, runId),
          eq(payrollEntries.employeeId, employeeId),
        ))
        .limit(1);
      if (existing.length > 0) throw new Error('Employee already in this payroll run');

      const emp = await tx.query.employees.findFirst({
        where: eq(employees.id, employeeId),
      });
      if (!emp) throw new Error(`Employee #${employeeId} not found`);

      const baseSalary = parseFloat(emp.baseSalary || '0');
      const transportAllowance = parseFloat(emp.transportAllowance || '0');
      const stdDays = run.standardWorkingDays;
      const calc = calculatePayrollEntry({
        baseSalary, workingDays: stdDays, standardWorkingDays: stdDays,
        weekdayOvertimeHours: 0, weekendOvertimeHours: 0,
        transportAllowance, bonus: 0, salaryDifference: 0,
        salaryAdvance: 0, otherDeductions: 0, sskEnrolled: emp.sskEnrolled,
      });

      const [entry] = await tx.insert(payrollEntries).values({
        payrollRunId: runId, employeeId: emp.id,
        employeeName: emp.name, employeeRole: emp.role,
        baseSalary: String(baseSalary), sskEnrolled: emp.sskEnrolled,
        workingDays: stdDays, standardWorkingDays: stdDays,
        basicSalary: String(calc.basicSalary),
        weekdayOvertimeHours: '0', weekdayOvertimeAmount: '0',
        weekendOvertimeHours: '0', weekendOvertimeAmount: '0',
        transportAllowance: String(transportAllowance),
        bonus: '0', salaryDifference: '0',
        grossSalary: String(calc.grossSalary),
        salaryAdvance: '0', otherDeductions: '0',
        sskEmployee: String(calc.sskEmployee),
        totalDeductions: String(calc.totalDeductions),
        netSalary: String(calc.netSalary), sskEmployer: String(calc.sskEmployer),
      }).returning();

      const remaining = await tx.select({ id: payrollEntries.id })
        .from(payrollEntries)
        .where(eq(payrollEntries.payrollRunId, runId));
      await tx.update(payrollRuns).set({
        entryCount: remaining.length, updatedAt: new Date(),
      }).where(eq(payrollRuns.id, runId));

      await recalculatePayrollRunTotals(tx, runId);
      return entry;
    });
    return result;
  },

  async remove_entry_from_run(args, ctx) {
    const { runId, entryId } = args;
    await db.transaction(async (tx) => {
      const run = await tx.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, runId),
      });
      if (!run) throw new Error(`Payroll run #${runId} not found`);
      if (run.status !== 'draft') throw new Error('Can only remove entries from draft runs');

      const entry = await tx.query.payrollEntries.findFirst({
        where: and(
          eq(payrollEntries.id, entryId),
          eq(payrollEntries.payrollRunId, runId),
        ),
      });
      if (!entry) throw new Error(`Entry #${entryId} not found in run #${runId}`);

      await tx.delete(payrollEntries).where(eq(payrollEntries.id, entryId));

      const remaining = await tx.select({ id: payrollEntries.id })
        .from(payrollEntries)
        .where(eq(payrollEntries.payrollRunId, runId));
      await tx.update(payrollRuns).set({
        entryCount: remaining.length, updatedAt: new Date(),
      }).where(eq(payrollRuns.id, runId));

      await recalculatePayrollRunTotals(tx, runId);
    });
    return { deleted: true, entryId, runId };
  },

  async get_revenue_chart() {
    const rows = await db.execute(sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW()) - interval '11 months',
          date_trunc('month', NOW()),
          interval '1 month'
        ) AS month_start
      )
      SELECT
        TO_CHAR(m.month_start, 'Mon YYYY') AS month,
        COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) AS revenue,
        COUNT(DISTINCT p.invoice_id) AS invoice_count
      FROM months m
      LEFT JOIN payments p
        ON DATE_TRUNC('month', CAST(p.payment_date AS DATE)) = m.month_start
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `);
    return rows.rows.map((row: any) => ({
      month: row.month,
      revenue: parseFloat(row.revenue ?? '0'),
      invoiceCount: parseInt(row.invoice_count ?? '0', 10),
    }));
  },

  // -- Partner Expenses --
  async list_partner_categories() {
    return await db.select().from(partnerExpenseCategories)
      .orderBy(partnerExpenseCategories.sortOrder);
  },

  async list_partner_expenses(args) {
    const conditions = [];
    if (args.year) {
      conditions.push(gte(partnerExpenses.date, `${args.year}-01-01`));
      conditions.push(lte(partnerExpenses.date, `${args.year}-12-31`));
    }
    if (args.categoryId) {
      conditions.push(eq(partnerExpenses.categoryId, args.categoryId));
    }
    if (args.search) {
      conditions.push(ilike(partnerExpenses.description, `%${args.search}%`));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.query.partnerExpenses.findMany({
      where,
      with: { category: true },
      orderBy: desc(partnerExpenses.date),
      limit: 50,
    });
  },

  async list_partner_payments(args) {
    const conditions = [];
    if (args.year) {
      conditions.push(gte(partnerPayments.date, `${args.year}-01-01`));
      conditions.push(lte(partnerPayments.date, `${args.year}-12-31`));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(partnerPayments)
      .where(where)
      .orderBy(desc(partnerPayments.date))
      .limit(50);
  },

  async get_partner_balance(args) {
    const expConds = [];
    const payConds = [];
    const sskConds = [];
    if (args.year) {
      expConds.push(gte(partnerExpenses.date, `${args.year}-01-01`));
      expConds.push(lte(partnerExpenses.date, `${args.year}-12-31`));
      payConds.push(gte(partnerPayments.date, `${args.year}-01-01`));
      payConds.push(lte(partnerPayments.date, `${args.year}-12-31`));
      sskConds.push(eq(partnerSskEntries.year, args.year));
    }
    const [exp] = await db.select({
      total: sql<string>`coalesce(sum(${partnerExpenses.partnerShare}), 0)`,
    }).from(partnerExpenses).where(expConds.length ? and(...expConds) : undefined);
    const [pay] = await db.select({
      total: sql<string>`coalesce(sum(${partnerPayments.amount}), 0)`,
    }).from(partnerPayments).where(payConds.length ? and(...payConds) : undefined);
    const [ssk] = await db.select({
      total: sql<string>`coalesce(sum(${partnerSskEntries.totalAmount}), 0)`,
    }).from(partnerSskEntries).where(sskConds.length ? sskConds[0] : undefined);

    const totalExp = parseFloat(exp.total);
    const totalSsk = parseFloat(ssk.total);
    const totalPay = parseFloat(pay.total);
    return {
      totalExpenses: totalExp,
      totalSsk: totalSsk,
      totalPayments: totalPay,
      balance: totalExp + totalSsk - totalPay,
      summary: totalExp + totalSsk - totalPay > 0
        ? `Partner owes ${(totalExp + totalSsk - totalPay).toFixed(2)} JOD`
        : totalExp + totalSsk - totalPay < 0
          ? `Partner overpaid by ${Math.abs(totalExp + totalSsk - totalPay).toFixed(2)} JOD`
          : 'Settled',
    };
  },

  async list_partner_ssk_entries(args) {
    const where = args.year
      ? eq(partnerSskEntries.year, args.year) : undefined;
    return await db.select().from(partnerSskEntries)
      .where(where)
      .orderBy(desc(partnerSskEntries.year), desc(partnerSskEntries.month));
  },

  async list_partner_employees() {
    return await db.select().from(partnerEmployees)
      .orderBy(partnerEmployees.name);
  },

  async create_partner_expense(args, ctx) {
    const share = Math.round(args.partnerShare * 100) / 100;
    const [expense] = await db.insert(partnerExpenses).values({
      categoryId: args.categoryId ?? null,
      date: args.date,
      description: args.description,
      totalAmount: String(args.totalAmount),
      splitPercent: String(args.splitPercent),
      partnerShare: String(share),
      notes: args.notes ?? null,
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'partner_expense', entityId: expense.id,
      action: 'created',
      description: `Partner expense "${args.description}" (${share} JOD) via AI`,
      userId: ctx?.userId,
    });
    return expense;
  },

  async create_partner_payment(args, ctx) {
    const [payment] = await db.insert(partnerPayments).values({
      date: args.date,
      amount: String(args.amount),
      description: args.description ?? null,
      paymentMethod: args.paymentMethod ?? null,
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'partner_payment', entityId: payment.id,
      action: 'created',
      description: `Partner payment of ${args.amount} JOD via AI`,
      userId: ctx?.userId,
    });
    return payment;
  },

  async generate_partner_ssk(args, ctx) {
    const { year, month } = args;
    const existing = await db.select({ id: partnerSskEntries.id })
      .from(partnerSskEntries)
      .where(and(eq(partnerSskEntries.year, year), eq(partnerSskEntries.month, month)))
      .limit(1);
    if (existing.length > 0) {
      throw new Error(`SSK for ${year}-${String(month).padStart(2, '0')} already exists`);
    }
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
    const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const activeEmps = await db.select().from(partnerEmployees).where(
      and(
        lte(partnerEmployees.startDate, lastDay),
        or(isNull(partnerEmployees.endDate), gte(partnerEmployees.endDate, firstDay)),
        eq(partnerEmployees.isActive, true),
      ),
    );
    if (activeEmps.length === 0) throw new Error('No active partner employees');
    const breakdown = activeEmps.map((e) => ({
      employeeId: e.id, name: e.name,
      amount: parseFloat(e.sskMonthlyAmount || '0'),
    }));
    const total = breakdown.reduce((s, b) => s + b.amount, 0);
    const [entry] = await db.insert(partnerSskEntries).values({
      year, month, totalAmount: String(total), breakdown,
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'partner_ssk_entry', entityId: entry.id,
      action: 'generated',
      description: `Partner SSK ${year}-${String(month).padStart(2, '0')} (${total} JOD) via AI`,
      userId: ctx?.userId,
    });
    return entry;
  },

  // -- Product Catalog --
  async list_products(args) {
    let query = db.select().from(products).orderBy(desc(products.updatedAt));
    const conditions = [];
    if (args.active !== 'all') {
      conditions.push(eq(products.isActive, args.active !== 'false'));
    }
    if (args.search) {
      const pattern = `%${args.search}%`;
      conditions.push(or(ilike(products.name, pattern), ilike(products.description, pattern)));
    }
    if (args.category) {
      conditions.push(eq(products.category, args.category));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    return await query;
  },

  async create_product(args, ctx) {
    const [product] = await db.insert(products).values({
      name: args.name,
      description: args.description || null,
      unitPrice: String(args.unitPrice),
      currency: args.currency || 'USD',
      category: args.category || null,
      type: args.type || 'service',
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'product', entityId: product.id,
      action: 'created',
      description: `Product "${product.name}" created via AI`,
      userId: ctx?.userId,
    });
    return product;
  },

  async update_product(args, ctx) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.unitPrice !== undefined) updateData.unitPrice = String(args.unitPrice);
    if (args.currency !== undefined) updateData.currency = args.currency;
    if (args.category !== undefined) updateData.category = args.category;
    if (args.type !== undefined) updateData.type = args.type;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;

    const [updated] = await db.update(products)
      .set(updateData)
      .where(eq(products.id, args.id))
      .returning();
    if (!updated) throw new Error(`Product #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'product', entityId: updated.id,
      action: 'updated',
      description: `Product "${updated.name}" updated via AI`,
      userId: ctx?.userId,
    });
    return updated;
  },

  async delete_product(args, ctx) {
    const [deleted] = await db.delete(products)
      .where(eq(products.id, args.id))
      .returning();
    if (!deleted) throw new Error(`Product #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'product', entityId: deleted.id,
      action: 'deleted',
      description: `Product "${deleted.name}" deleted via AI`,
      userId: ctx?.userId,
    });
    return { message: `Product "${deleted.name}" deleted` };
  },

  // -- Aging Report --
  async get_aging_report() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const unpaidInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId,
        total: invoices.total,
        amountPaid: invoices.amountPaid,
        dueDate: invoices.dueDate,
        status: invoices.status,
        currency: invoices.currency,
      })
      .from(invoices)
      .where(
        and(
          ne(invoices.status, 'paid'),
          ne(invoices.status, 'cancelled'),
          ne(invoices.status, 'draft'),
        ),
      );

    const brackets = { current: [] as any[], '1_30': [] as any[], '31_60': [] as any[], '61_90': [] as any[], '90_plus': [] as any[] };

    for (const inv of unpaidInvoices) {
      const due = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const outstanding = parseFloat(String(inv.total)) - parseFloat(String(inv.amountPaid || '0'));
      const entry = { ...inv, daysOverdue, outstanding };

      if (daysOverdue <= 0) brackets.current.push(entry);
      else if (daysOverdue <= 30) brackets['1_30'].push(entry);
      else if (daysOverdue <= 60) brackets['31_60'].push(entry);
      else if (daysOverdue <= 90) brackets['61_90'].push(entry);
      else brackets['90_plus'].push(entry);
    }

    const sumBracket = (items: any[]) => items.reduce((s, i) => s + i.outstanding, 0);

    return {
      asOf: todayStr,
      summary: {
        current: { count: brackets.current.length, total: sumBracket(brackets.current) },
        '1_30_days': { count: brackets['1_30'].length, total: sumBracket(brackets['1_30']) },
        '31_60_days': { count: brackets['31_60'].length, total: sumBracket(brackets['31_60']) },
        '61_90_days': { count: brackets['61_90'].length, total: sumBracket(brackets['61_90']) },
        '90_plus_days': { count: brackets['90_plus'].length, total: sumBracket(brackets['90_plus']) },
      },
      totalOutstanding: sumBracket(unpaidInvoices.map(inv => ({
        outstanding: parseFloat(String(inv.total)) - parseFloat(String(inv.amountPaid || '0')),
      }))),
      invoiceCount: unpaidInvoices.length,
    };
  },

  // -- Client Statement --
  async get_client_statement(args) {
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, args.clientId),
    });
    if (!client) throw new Error(`Client #${args.clientId} not found`);

    let invoiceQuery = db
      .select()
      .from(invoices)
      .where(eq(invoices.clientId, args.clientId))
      .orderBy(asc(invoices.issueDate));

    const clientInvoices = await invoiceQuery;
    const clientPayments = await db
      .select()
      .from(payments)
      .where(sql`${payments.invoiceId} IN (SELECT id FROM invoices WHERE client_id = ${args.clientId})`)
      .orderBy(asc(payments.paymentDate));

    // Build statement entries sorted by date
    const entries: Array<{ date: string; type: string; description: string; debit: number; credit: number; balance: number }> = [];
    let runningBalance = 0;

    // Merge invoices and payments by date
    const allItems = [
      ...clientInvoices.map(inv => ({
        date: inv.issueDate,
        sortOrder: 0,
        type: 'invoice' as const,
        description: `Invoice ${inv.invoiceNumber}`,
        amount: parseFloat(String(inv.total)),
        id: inv.id,
      })),
      ...clientPayments.map(pmt => ({
        date: pmt.paymentDate,
        sortOrder: 1,
        type: 'payment' as const,
        description: `Payment (${pmt.paymentMethod || 'other'})`,
        amount: parseFloat(String(pmt.amount)),
        id: pmt.id,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder);

    for (const item of allItems) {
      if (args.startDate && item.date < args.startDate) continue;
      if (args.endDate && item.date > args.endDate) continue;

      if (item.type === 'invoice') {
        runningBalance += item.amount;
        entries.push({
          date: item.date, type: 'invoice', description: item.description,
          debit: item.amount, credit: 0, balance: runningBalance,
        });
      } else {
        runningBalance -= item.amount;
        entries.push({
          date: item.date, type: 'payment', description: item.description,
          debit: 0, credit: item.amount, balance: runningBalance,
        });
      }
    }

    return {
      client: { id: client.id, name: client.name, email: client.email },
      entries,
      closingBalance: runningBalance,
      totalInvoiced: entries.filter(e => e.type === 'invoice').reduce((s, e) => s + e.debit, 0),
      totalPaid: entries.filter(e => e.type === 'payment').reduce((s, e) => s + e.credit, 0),
    };
  },
};

// ---- Helpers to resolve entity names for better summaries ----
async function resolveClientName(clientId: unknown): Promise<string> {
  if (!clientId) return 'unknown client';
  try {
    const [c] = await db.select({ name: clients.name })
      .from(clients).where(eq(clients.id, Number(clientId)));
    return c?.name ? `"${c.name}"` : `client #${clientId}`;
  } catch { return `client #${clientId}`; }
}

async function resolveInvoiceNumber(invoiceId: unknown): Promise<string> {
  if (!invoiceId) return 'unknown invoice';
  try {
    const [inv] = await db.select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices).where(eq(invoices.id, Number(invoiceId)));
    return inv?.invoiceNumber || `invoice #${invoiceId}`;
  } catch { return `invoice #${invoiceId}`; }
}

async function resolveQuoteNumber(quoteId: unknown): Promise<string> {
  if (!quoteId) return 'unknown quote';
  try {
    const [q] = await db.select({ quoteNumber: quotes.quoteNumber })
      .from(quotes).where(eq(quotes.id, Number(quoteId)));
    return q?.quoteNumber || `quote #${quoteId}`;
  } catch { return `quote #${quoteId}`; }
}

async function resolveBankAccountName(accountId: unknown): Promise<string> {
  if (!accountId) return 'unknown account';
  try {
    const [a] = await db.select({ name: bankAccounts.name })
      .from(bankAccounts).where(eq(bankAccounts.id, Number(accountId)));
    return a?.name ? `"${a.name}"` : `account #${accountId}`;
  } catch { return `account #${accountId}`; }
}

// ---- Generate human-readable action summary ----
export async function generateActionSummary(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const summaryMap: Record<string, () => Promise<string>> = {
    create_client: async () => `Create client "${args.name}"`,
    update_client: async () => {
      const name = await resolveClientName(args.id);
      return `Update client ${name}`;
    },
    delete_client: async () => {
      const name = await resolveClientName(args.id);
      return `Delete client ${name}`;
    },
    batch_create_clients: async () => {
      const cls = args.clients as any[];
      return `Create ${cls?.length || 0} client(s)`;
    },
    batch_delete_clients: async () => {
      const ids = args.clientIds as number[];
      return `Delete ${ids?.length || 0} client(s)`;
    },
    create_invoice: async () => {
      const name = await resolveClientName(args.clientId);
      const count = (args.lineItems as any[])?.length || 0;
      return `Create invoice for ${name} with ${count} line item(s)`;
    },
    update_invoice: async () => {
      const num = await resolveInvoiceNumber(args.id);
      return `Update ${num}`;
    },
    delete_invoice: async () => {
      const num = await resolveInvoiceNumber(args.id);
      return `Delete ${num}`;
    },
    batch_delete_invoices: async () => {
      const ids = args.invoiceIds as number[];
      return `Delete ${ids?.length || 0} invoice(s)`;
    },
    update_invoice_status: async () => {
      const num = await resolveInvoiceNumber(args.id);
      return `Change ${num} status to "${args.status}"`;
    },
    send_invoice_email: async () => {
      const num = await resolveInvoiceNumber(args.id);
      return `Send ${num} via email`;
    },
    send_invoice_reminder: async () => {
      const num = await resolveInvoiceNumber(args.id);
      return `Send payment reminder for ${num}`;
    },
    duplicate_invoice: async () => {
      const num = await resolveInvoiceNumber(args.id);
      return `Duplicate ${num}`;
    },
    create_quote: async () => {
      const name = await resolveClientName(args.clientId);
      return `Create quote for ${name}`;
    },
    update_quote: async () => {
      const num = await resolveQuoteNumber(args.id);
      return `Update ${num}`;
    },
    update_quote_status: async () => {
      const num = await resolveQuoteNumber(args.id);
      return `Change ${num} status to "${args.status}"`;
    },
    delete_quote: async () => {
      const num = await resolveQuoteNumber(args.id);
      return `Delete ${num}`;
    },
    batch_create_quotes: async () => {
      const qs = args.quotes as any[];
      return `Create ${qs?.length || 0} quote(s)`;
    },
    send_quote_email: async () => {
      const num = await resolveQuoteNumber(args.id);
      return `Send ${num} via email`;
    },
    convert_quote_to_invoice: async () => {
      const num = await resolveQuoteNumber(args.id);
      return `Convert ${num} to invoice`;
    },
    create_payment: async () => {
      const num = await resolveInvoiceNumber(args.invoiceId);
      return `Record payment of ${args.amount} for ${num}`;
    },
    delete_payment: async () => `Delete payment #${args.id}`,
    batch_create_payments: async () => {
      const ps = args.payments as any[];
      return `Record ${ps?.length || 0} payment(s)`;
    },
    create_recurring: async () => {
      const name = await resolveClientName(args.clientId);
      return `Create ${args.frequency} recurring invoice for ${name}`;
    },
    update_recurring: async () => `Update recurring invoice #${args.id}`,
    delete_recurring: async () => `Delete recurring invoice #${args.id}`,
    toggle_recurring: async () => `Toggle recurring invoice #${args.id} active/inactive`,
    create_bank_account: async () => `Create bank account "${args.name}"`,
    update_bank_account: async () => {
      const name = await resolveBankAccountName(args.id);
      return `Update bank account ${name}`;
    },
    delete_bank_account: async () => {
      const name = await resolveBankAccountName(args.id);
      return `Delete bank account ${name}`;
    },
    connect_paypal: async () => {
      const name = await resolveBankAccountName(args.bankAccountId);
      return `Connect PayPal to bank account ${name} (using credentials from Settings)`;
    },
    sync_bank_account: async () => {
      const name = await resolveBankAccountName(args.bankAccountId);
      return `Sync transactions for ${name} from ${args.fromDate} to ${args.toDate}`;
    },
    create_transaction: async () => `Create ${args.type} transaction of ${args.amount}`,
    update_transaction: async () => `Update transaction #${args.id}`,
    delete_transaction: async () => `Delete transaction #${args.id}`,
    batch_update_invoice_status: async () => {
      const ids = args.invoiceIds as number[];
      return `Update ${ids?.length || 0} invoice(s) to "${args.status}"`;
    },
    import_invoices_from_data: async () => {
      const invs = args.invoices as any[];
      return `Import ${invs?.length || 0} invoice(s) from file`;
    },
    import_transactions_from_text: async () => {
      const txns = args.transactions as any[];
      const name = await resolveBankAccountName(args.bankAccountId);
      return `Import ${txns?.length || 0} transaction(s) to ${name}`;
    },
    update_settings: async () => `Update business settings`,
    create_employee: async () => `Create employee "${args.name}" (${args.role})`,
    batch_create_employees: async () => {
      const emps = args.employees as any[];
      return `Create ${emps?.length || 0} employee(s)`;
    },
    update_employee: async () => {
      const emp = await db.query.employees.findFirst({
        where: eq(employees.id, args.id as number),
      });
      return `Update employee ${emp?.name || `#${args.id}`}`;
    },
    delete_employee: async () => {
      const emp = await db.query.employees.findFirst({
        where: eq(employees.id, args.id as number),
      });
      return `Delete employee ${emp?.name || `#${args.id}`}`;
    },
    create_payroll_run: async () =>
      `Create payroll run for ${args.year}-${String(args.month).padStart(2, '0')}`,
    update_payroll_entry: async () =>
      `Update payroll entry #${args.entryId} in run #${args.runId}`,
    finalize_payroll_run: async () =>
      `Finalize payroll run #${args.id}`,
    update_payroll_payment: async () =>
      `Update payment for entry #${args.entryId} to "${args.paymentStatus}"`,
    update_payroll_run: async () =>
      `Update payroll run #${args.id}`,
    delete_payroll_run: async () =>
      `Delete payroll run #${args.id}`,
    reopen_payroll_run: async () =>
      `Reopen payroll run #${args.id} back to draft`,
    mark_all_paid: async () =>
      `Mark all pending entries in run #${args.id} as paid`,
    add_employee_to_run: async () => {
      const emp = await db.query.employees.findFirst({ where: eq(employees.id, Number(args.employeeId)) });
      return `Add ${emp?.name || `employee #${args.employeeId}`} to payroll run #${args.runId}`;
    },
    remove_entry_from_run: async () =>
      `Remove entry #${args.entryId} from payroll run #${args.runId}`,
    submit_to_jofotara: async () => {
      const num = await resolveInvoiceNumber(args.invoiceId);
      return `Submit ${num} to JoFotara (${args.paymentMethod})`;
    },
    submit_credit_note: async () => {
      const num = await resolveInvoiceNumber(args.invoiceId);
      const origNum = await resolveInvoiceNumber(args.originalInvoiceId);
      return `Submit credit note ${num} for ${origNum} to JoFotara`;
    },
    create_partner_expense: async () =>
      `Add partner expense "${args.description}" (${args.partnerShare} JOD)`,
    create_partner_payment: async () =>
      `Record partner payment of ${args.amount} JOD`,
    generate_partner_ssk: async () =>
      `Generate partner SSK for ${args.year}-${String(args.month).padStart(2, '0')}`,
    create_product: async () => `Add "${args.name}" to product catalog`,
    update_product: async () => `Update product #${args.id}`,
    delete_product: async () => `Delete product #${args.id}`,
  };
  try {
    return await (summaryMap[toolName]?.() ?? Promise.resolve(`Execute ${toolName}`));
  } catch {
    return `Execute ${toolName}`;
  }
}
