import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  businessName: varchar('business_name', { length: 255 }).notNull()
    .default('My Business'),
  businessEmail: varchar('business_email', { length: 255 }).notNull()
    .default('hello@example.com'),
  businessPhone: varchar('business_phone', { length: 50 }),
  businessAddress: text('business_address'),
  taxId: varchar('tax_id', { length: 100 }),
  logoUrl: text('logo_url'),
  defaultCurrency: varchar('default_currency', { length: 3 })
    .notNull().default('USD'),
  defaultTaxRate: decimal('default_tax_rate', {
    precision: 5, scale: 2,
  }).notNull().default('0'),
  defaultPaymentTerms: integer('default_payment_terms')
    .notNull().default(30),
  invoicePrefix: varchar('invoice_prefix', { length: 10 })
    .notNull().default('INV'),
  nextInvoiceNumber: integer('next_invoice_number')
    .notNull().default(1),
  exemptInvoicePrefix: varchar('exempt_invoice_prefix', { length: 10 })
    .notNull().default('EINV'),
  nextExemptInvoiceNumber: integer('next_exempt_invoice_number')
    .notNull().default(1),
  writeOffPrefix: varchar('write_off_prefix', { length: 10 })
    .notNull().default('WO'),
  nextWriteOffNumber: integer('next_write_off_number')
    .notNull().default(1),
  creditNotePrefix: varchar('credit_note_prefix', { length: 10 })
    .notNull().default('CN'),
  nextCreditNoteNumber: integer('next_credit_note_number')
    .notNull().default(1),
  quotePrefix: varchar('quote_prefix', { length: 10 })
    .notNull().default('QUO'),
  nextQuoteNumber: integer('next_quote_number')
    .notNull().default(1),
  jofotaraClientId: varchar('jofotara_client_id', { length: 100 }),
  jofotaraClientSecret: text('jofotara_client_secret'),
  jofotaraCompanyTin: varchar('jofotara_company_tin', { length: 50 }),
  jofotaraIncomeSourceSequence: varchar(
    'jofotara_income_source_sequence', { length: 50 },
  ),
  jofotaraInvoiceType: varchar('jofotara_invoice_type', { length: 20 })
    .notNull().default('general_sales'),
  jofotaraEnabled: boolean('jofotara_enabled').notNull().default(false),
  bankEtihadUsername: varchar('bank_etihad_username', { length: 100 }),
  bankEtihadEnabled: boolean('bank_etihad_enabled').notNull().default(false),
  paypalClientId: varchar('paypal_client_id', { length: 255 }),
  paypalClientSecret: text('paypal_client_secret'),
  paypalEnvironment: varchar('paypal_environment', { length: 10 })
    .notNull().default('sandbox'),
  paypalEnabled: boolean('paypal_enabled').notNull().default(false),
  geminiApiKey: text('gemini_api_key'),
  emailProvider: varchar('email_provider', { length: 10 })
    .notNull().default('resend'),
  resendApiKey: text('resend_api_key'),
  smtpHost: varchar('smtp_host', { length: 255 }),
  smtpPort: integer('smtp_port'),
  smtpUsername: varchar('smtp_username', { length: 255 }),
  smtpPassword: text('smtp_password'),
  smtpSecure: boolean('smtp_secure').notNull().default(true),
  filingStatus: varchar('filing_status', { length: 20 })
    .notNull().default('single'),
  personalExemption: decimal('personal_exemption', {
    precision: 10, scale: 2,
  }).notNull().default('9000'),
  familyExemption: decimal('family_exemption', {
    precision: 10, scale: 2,
  }).notNull().default('9000'),
  additionalExemptions: decimal('additional_exemptions', {
    precision: 10, scale: 2,
  }).notNull().default('0'),
  autoRemindersEnabled: boolean('auto_reminders_enabled').notNull().default(false),
  reminderDaysAfterDue: jsonb('reminder_days_after_due').$type<number[]>().default([3, 7, 14, 30]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
