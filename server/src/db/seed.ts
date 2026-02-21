import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  settings,
  clients,
  invoices,
  invoiceLineItems,
  quotes,
  quoteLineItems,
  payments,
  activityLog,
} from './schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function seed() {
  console.log('Seeding database...');

  // Settings
  const [s] = await db.insert(settings).values({
    businessName: 'Vibe Studio',
    businessEmail: 'hello@vibestudio.com',
    businessPhone: '+1 (555) 123-4567',
    businessAddress: '123 Creative Lane, San Francisco, CA 94105',
    defaultCurrency: 'USD',
    defaultTaxRate: '10',
    defaultPaymentTerms: 30,
    invoicePrefix: 'INV',
    nextInvoiceNumber: 4,
    quotePrefix: 'QUO',
    nextQuoteNumber: 3,
  }).returning();
  console.log('  Settings created');

  // Clients
  const [client1] = await db.insert(clients).values({
    name: 'John Smith',
    email: 'john@acmecorp.com',
    phone: '+1 (555) 987-6543',
    company: 'Acme Corporation',
    addressLine1: '456 Business Ave',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
  }).returning();

  const [client2] = await db.insert(clients).values({
    name: 'Sarah Johnson',
    email: 'sarah@techstart.io',
    phone: '+1 (555) 456-7890',
    company: 'TechStart Inc',
    addressLine1: '789 Innovation Blvd',
    city: 'Austin',
    state: 'TX',
    postalCode: '73301',
    country: 'US',
  }).returning();

  const [client3] = await db.insert(clients).values({
    name: 'Michael Chen',
    email: 'michael@designlab.co',
    company: 'DesignLab Co',
    addressLine1: '321 Art Street',
    city: 'Portland',
    state: 'OR',
    postalCode: '97201',
    country: 'US',
  }).returning();
  console.log('  3 clients created');

  // Invoices
  const [inv1] = await db.insert(invoices).values({
    invoiceNumber: 'INV-0001',
    clientId: client1.id,
    status: 'paid',
    issueDate: '2026-01-15',
    dueDate: '2026-02-14',
    currency: 'USD',
    subtotal: '3500.00',
    taxRate: '10',
    taxAmount: '350.00',
    total: '3850.00',
    amountPaid: '3850.00',
    notes: 'Thank you for your business!',
    paidAt: new Date('2026-02-10'),
  }).returning();

  await db.insert(invoiceLineItems).values([
    {
      invoiceId: inv1.id,
      description: 'Website Redesign - UI/UX Design',
      quantity: '1',
      unitPrice: '2000.00',
      amount: '2000.00',
      sortOrder: 0,
    },
    {
      invoiceId: inv1.id,
      description: 'Frontend Development (React)',
      quantity: '10',
      unitPrice: '150.00',
      amount: '1500.00',
      sortOrder: 1,
    },
  ]);

  const [inv2] = await db.insert(invoices).values({
    invoiceNumber: 'INV-0002',
    clientId: client2.id,
    status: 'sent',
    issueDate: '2026-02-01',
    dueDate: '2026-03-03',
    currency: 'USD',
    subtotal: '5200.00',
    taxRate: '10',
    taxAmount: '520.00',
    total: '5720.00',
    amountPaid: '0',
    sentAt: new Date('2026-02-01'),
  }).returning();

  await db.insert(invoiceLineItems).values([
    {
      invoiceId: inv2.id,
      description: 'Mobile App Development - Phase 1',
      quantity: '1',
      unitPrice: '3200.00',
      amount: '3200.00',
      sortOrder: 0,
    },
    {
      invoiceId: inv2.id,
      description: 'API Integration',
      quantity: '8',
      unitPrice: '150.00',
      amount: '1200.00',
      sortOrder: 1,
    },
    {
      invoiceId: inv2.id,
      description: 'Testing & QA',
      quantity: '4',
      unitPrice: '200.00',
      amount: '800.00',
      sortOrder: 2,
    },
  ]);

  const [inv3] = await db.insert(invoices).values({
    invoiceNumber: 'INV-0003',
    clientId: client3.id,
    status: 'overdue',
    issueDate: '2026-01-01',
    dueDate: '2026-01-31',
    currency: 'USD',
    subtotal: '1800.00',
    taxRate: '0',
    taxAmount: '0',
    total: '1800.00',
    amountPaid: '0',
  }).returning();

  await db.insert(invoiceLineItems).values([
    {
      invoiceId: inv3.id,
      description: 'Brand Identity Package',
      quantity: '1',
      unitPrice: '1800.00',
      amount: '1800.00',
      sortOrder: 0,
    },
  ]);
  console.log('  3 invoices created');

  // Payments
  await db.insert(payments).values({
    invoiceId: inv1.id,
    amount: '3850.00',
    paymentDate: '2026-02-10',
    paymentMethod: 'bank_transfer',
    reference: 'TXN-20260210-001',
  });
  console.log('  1 payment created');

  // Quotes
  const [quote1] = await db.insert(quotes).values({
    quoteNumber: 'QUO-0001',
    clientId: client2.id,
    status: 'sent',
    issueDate: '2026-02-15',
    expiryDate: '2026-03-15',
    currency: 'USD',
    subtotal: '8500.00',
    taxRate: '10',
    taxAmount: '850.00',
    total: '9350.00',
    sentAt: new Date('2026-02-15'),
  }).returning();

  await db.insert(quoteLineItems).values([
    {
      quoteId: quote1.id,
      description: 'Mobile App Development - Phase 2',
      quantity: '1',
      unitPrice: '5000.00',
      amount: '5000.00',
      sortOrder: 0,
    },
    {
      quoteId: quote1.id,
      description: 'Push Notifications System',
      quantity: '1',
      unitPrice: '2000.00',
      amount: '2000.00',
      sortOrder: 1,
    },
    {
      quoteId: quote1.id,
      description: 'Analytics Dashboard',
      quantity: '1',
      unitPrice: '1500.00',
      amount: '1500.00',
      sortOrder: 2,
    },
  ]);

  const [quote2] = await db.insert(quotes).values({
    quoteNumber: 'QUO-0002',
    clientId: client1.id,
    status: 'draft',
    issueDate: '2026-02-20',
    expiryDate: '2026-03-20',
    currency: 'USD',
    subtotal: '2400.00',
    taxRate: '10',
    taxAmount: '240.00',
    total: '2640.00',
  }).returning();

  await db.insert(quoteLineItems).values([
    {
      quoteId: quote2.id,
      description: 'SEO Optimization',
      quantity: '1',
      unitPrice: '1200.00',
      amount: '1200.00',
      sortOrder: 0,
    },
    {
      quoteId: quote2.id,
      description: 'Content Writing (10 pages)',
      quantity: '10',
      unitPrice: '120.00',
      amount: '1200.00',
      sortOrder: 1,
    },
  ]);
  console.log('  2 quotes created');

  // Activity log
  await db.insert(activityLog).values([
    {
      entityType: 'invoice',
      entityId: inv1.id,
      action: 'created',
      description: 'Invoice INV-0001 created',
    },
    {
      entityType: 'invoice',
      entityId: inv1.id,
      action: 'sent',
      description: 'Invoice INV-0001 sent to john@acmecorp.com',
    },
    {
      entityType: 'payment',
      entityId: inv1.id,
      action: 'paid',
      description: 'Payment of $3,850.00 received for INV-0001',
    },
    {
      entityType: 'invoice',
      entityId: inv2.id,
      action: 'created',
      description: 'Invoice INV-0002 created',
    },
    {
      entityType: 'invoice',
      entityId: inv2.id,
      action: 'sent',
      description: 'Invoice INV-0002 sent to sarah@techstart.io',
    },
    {
      entityType: 'client',
      entityId: client3.id,
      action: 'created',
      description: 'Client Michael Chen added',
    },
    {
      entityType: 'quote',
      entityId: quote1.id,
      action: 'created',
      description: 'Quote QUO-0001 created',
    },
  ]);
  console.log('  Activity log entries created');

  console.log('Seed complete!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
