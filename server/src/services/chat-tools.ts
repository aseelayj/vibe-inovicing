import type { FunctionDeclaration, Type } from '@google/genai';
import { eq, desc, and, or, ilike, sql, count, sum } from 'drizzle-orm';
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
  transactions,
  settings,
  activityLog,
  emailLog,
  jofotaraSubmissions,
} from '../db/schema.js';
import { generateInvoicePdf } from './pdf.service.js';
import { sendInvoiceEmail, sendPaymentReminder } from './email.service.js';
import { sendQuoteEmail } from './email.service.js';
import { generateQuotePdf } from './pdf.service.js';
import { parseTransactionsFromText } from './ai.service.js';
import { recalculateBalance } from '../routes/bank-account.routes.js';
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
} from '@vibe/shared';

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
        id: { type: 'INTEGER' as Type, description: 'Client ID' },
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
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
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
    name: 'update_invoice_status',
    description: 'Change an invoice status (draft, sent, paid, overdue, cancelled)',
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
    description: 'Send an invoice to the client via email (generates PDF, sends it)',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'send_invoice_reminder',
    description: 'Send a payment reminder email for an invoice',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        id: { type: 'INTEGER' as Type, description: 'Invoice ID' },
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
    description: 'Create a new bank account',
    parameters: {
      type: 'OBJECT' as Type,
      properties: {
        name: { type: 'STRING' as Type },
        bankName: { type: 'STRING' as Type },
        accountNumber: { type: 'STRING' as Type },
        currency: { type: 'STRING' as Type },
        initialBalance: { type: 'NUMBER' as Type },
        notes: { type: 'STRING' as Type },
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
          description: 'The route path. Valid: /, /invoices, /invoices/:id, /invoices/new, /quotes, /quotes/:id, /quotes/new, /clients, /clients/:id, /clients/new, /payments, /recurring, /bank-accounts, /transactions, /settings',
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
) {
  const [s] = await tx.select().from(settings).limit(1);
  if (!s) throw new Error('Settings not found');

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
  (args: Record<string, any>) => Promise<unknown>
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

  async create_client(args) {
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
    });
    return client;
  },

  async update_client(args) {
    const { id, ...data } = args;
    const [updated] = await db.update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id)).returning();
    if (!updated) throw new Error(`Client #${id} not found`);
    await db.insert(activityLog).values({
      entityType: 'client', entityId: id,
      action: 'updated', description: `Client "${updated.name}" updated via AI chat`,
    });
    return updated;
  },

  async delete_client(args) {
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
    });
    return { message: `Client "${deleted.name}" deleted` };
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

  async create_invoice(args) {
    const isTaxable = args.isTaxable === true;
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
      const invoiceNumber = await generateInvoiceNumber(tx, isTaxable);
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
        status: 'draft',
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
        action: 'created', description: `Invoice ${inv.invoiceNumber} created via AI chat`,
      });
      return inv;
    });

    return await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_invoice(args) {
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
      });
      return updated;
    });

    return await db.query.invoices.findFirst({
      where: eq(invoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async delete_invoice(args) {
    const [deleted] = await db.delete(invoices).where(eq(invoices.id, args.id)).returning();
    if (!deleted) throw new Error(`Invoice #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'invoice', entityId: deleted.id,
      action: 'deleted', description: `Invoice ${deleted.invoiceNumber} deleted via AI chat`,
    });
    return { message: `Invoice ${deleted.invoiceNumber} deleted` };
  },

  async update_invoice_status(args) {
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
    });
    return updated;
  },

  async send_invoice_email(args) {
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
    const emailResult = await sendInvoiceEmail({
      to: invoice.client.email,
      subject: `Invoice ${invoice.invoiceNumber}`,
      body: `Please find your invoice ${invoice.invoiceNumber} attached.`,
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
      subject: `Invoice ${invoice.invoiceNumber}`, status: 'sent', resendId: emailResult.id,
    });
    await db.insert(activityLog).values({
      entityType: 'invoice', entityId: args.id, action: 'sent',
      description: `Invoice ${invoice.invoiceNumber} sent to ${invoice.client.email} via AI chat`,
    });
    return { message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.client.email}` };
  },

  async send_invoice_reminder(args) {
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

    const emailResult = await sendPaymentReminder({
      to: invoice.client.email,
      subject: `Payment Reminder: ${invoice.invoiceNumber}`,
      body: `This is a friendly reminder about invoice ${invoice.invoiceNumber}.`,
      businessName: settingsRow?.businessName || 'Our Company',
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total, dueDate: invoice.dueDate, daysOverdue,
    });
    await db.insert(emailLog).values({
      invoiceId: args.id, recipientEmail: invoice.client.email,
      subject: `Payment Reminder: ${invoice.invoiceNumber}`, status: 'sent', resendId: emailResult.id,
    });
    await db.insert(activityLog).values({
      entityType: 'invoice', entityId: args.id, action: 'reminder_sent',
      description: `Payment reminder sent for ${invoice.invoiceNumber} via AI chat`,
    });
    return { message: `Reminder sent for invoice ${invoice.invoiceNumber}` };
  },

  async duplicate_invoice(args) {
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

  async create_quote(args) {
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
      });
      return q;
    });

    return await db.query.quotes.findFirst({
      where: eq(quotes.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_quote(args) {
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
      });
      return updated;
    });

    return await db.query.quotes.findFirst({
      where: eq(quotes.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_quote_status(args) {
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
    });
    return updated;
  },

  async delete_quote(args) {
    const [deleted] = await db.delete(quotes).where(eq(quotes.id, args.id)).returning();
    if (!deleted) throw new Error(`Quote #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'quote', entityId: deleted.id,
      action: 'deleted', description: `Quote ${deleted.quoteNumber} deleted via AI chat`,
    });
    return { message: `Quote ${deleted.quoteNumber} deleted` };
  },

  async send_quote_email(args) {
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
    const emailResult = await sendQuoteEmail({
      to: quote.client.email,
      subject: `Quote ${quote.quoteNumber}`,
      body: `Please find your quote ${quote.quoteNumber} attached.`,
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
      subject: `Quote ${quote.quoteNumber}`, status: 'sent', resendId: emailResult.id,
    });
    await db.insert(activityLog).values({
      entityType: 'quote', entityId: args.id, action: 'sent',
      description: `Quote ${quote.quoteNumber} sent to ${quote.client.email} via AI chat`,
    });
    return { message: `Quote ${quote.quoteNumber} sent to ${quote.client.email}` };
  },

  async convert_quote_to_invoice(args) {
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

  async create_payment(args) {
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
    });
    return payment;
  },

  async delete_payment(args) {
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
    });
    return { message: 'Payment deleted' };
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

  async create_recurring(args) {
    const { lineItems: items, taxRate = 0 } = args;
    const totals = calculateTotals(items, taxRate, 0);

    const result = await db.transaction(async (tx) => {
      const [rec] = await tx.insert(recurringInvoices).values({
        clientId: args.clientId,
        frequency: args.frequency,
        startDate: args.startDate,
        endDate: args.endDate || null,
        currency: args.currency || 'USD',
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
      });
      return rec;
    });

    return await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async update_recurring(args) {
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
      });
      return updated;
    });

    return await db.query.recurringInvoices.findFirst({
      where: eq(recurringInvoices.id, result.id),
      with: { client: true, lineItems: true },
    });
  },

  async delete_recurring(args) {
    const [deleted] = await db.delete(recurringInvoices)
      .where(eq(recurringInvoices.id, args.id)).returning();
    if (!deleted) throw new Error(`Recurring invoice #${args.id} not found`);
    await db.insert(activityLog).values({
      entityType: 'recurring_invoice', entityId: deleted.id,
      action: 'deleted', description: `Recurring invoice deleted via AI chat`,
    });
    return { message: 'Recurring invoice deleted' };
  },

  async toggle_recurring(args) {
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

  async create_bank_account(args) {
    const balance = args.initialBalance ?? 0;
    const [account] = await db.insert(bankAccounts).values({
      name: args.name, bankName: args.bankName, accountNumber: args.accountNumber,
      currency: args.currency || 'USD',
      initialBalance: String(balance), currentBalance: String(balance),
      notes: args.notes,
    }).returning();
    await db.insert(activityLog).values({
      entityType: 'bank_account', entityId: account.id,
      action: 'created', description: `Bank account "${args.name}" created via AI chat`,
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

  async delete_bank_account(args) {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, args.id));
    if (!account) throw new Error(`Bank account #${args.id} not found`);
    await db.delete(bankAccounts).where(eq(bankAccounts.id, args.id));
    await db.insert(activityLog).values({
      entityType: 'bank_account', entityId: args.id,
      action: 'deleted', description: `Bank account "${account.name}" deleted via AI chat`,
    });
    return { message: `Bank account "${account.name}" deleted` };
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

  async create_transaction(args) {
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

  async delete_transaction(args) {
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, args.id));
    if (!txn) throw new Error(`Transaction #${args.id} not found`);

    await db.transaction(async (tx) => {
      await tx.delete(transactions).where(eq(transactions.id, args.id));
      await recalculateBalance(tx, txn.bankAccountId);
      await tx.insert(activityLog).values({
        entityType: 'transaction', entityId: args.id, action: 'deleted',
        description: `Transaction deleted via AI chat`,
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
  async batch_update_invoice_status(args) {
    const { invoiceIds, status } = args;
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      throw new Error('No invoice IDs provided');
    }
    if (invoiceIds.length > 50) {
      throw new Error('Cannot update more than 50 invoices at once');
    }

    const results: { id: number; invoiceNumber: string; status: string }[] = [];
    for (const id of invoiceIds) {
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
        });
      }
    }
    return {
      message: `Updated ${results.length} invoice(s) to "${status}"`,
      invoices: results,
    };
  },

  // -- Import --
  async import_invoices_from_data(args) {
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

  async import_transactions_from_text(args) {
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
    submit_to_jofotara: async () => {
      const num = await resolveInvoiceNumber(args.invoiceId);
      return `Submit ${num} to JoFotara (${args.paymentMethod})`;
    },
    submit_credit_note: async () => {
      const num = await resolveInvoiceNumber(args.invoiceId);
      const origNum = await resolveInvoiceNumber(args.originalInvoiceId);
      return `Submit credit note ${num} for ${origNum} to JoFotara`;
    },
  };
  try {
    return await (summaryMap[toolName]?.() ?? Promise.resolve(`Execute ${toolName}`));
  } catch {
    return `Execute ${toolName}`;
  }
}
