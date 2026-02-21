import { Router } from 'express';
import { eq, sql, desc, and, or, count, sum } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  invoices,
  clients,
  payments,
  activityLog,
  bankAccounts,
  transactions,
  users,
} from '../db/schema.js';

const router = Router();

// GET /stats - Dashboard statistics
router.get('/stats', async (req, res, next) => {
  try {
    // Total revenue: sum of paid invoice totals
    const [revenueResult] = await db
      .select({ value: sum(invoices.total) })
      .from(invoices)
      .where(eq(invoices.status, 'paid'));

    const totalRevenue = parseFloat(revenueResult?.value ?? '0');

    // Outstanding amount: sum of (total - amountPaid) for sent/partially_paid
    const [outstandingResult] = await db
      .select({
        value: sql<string>`COALESCE(SUM(
          CAST(${invoices.total} AS NUMERIC) - CAST(${invoices.amountPaid} AS NUMERIC)
        ), 0)`,
      })
      .from(invoices)
      .where(
        or(
          eq(invoices.status, 'sent'),
          eq(invoices.status, 'partially_paid'),
        ),
      );

    const outstandingAmount = parseFloat(outstandingResult?.value ?? '0');

    // Overdue amount: sum of (total - amountPaid) for overdue
    const [overdueResult] = await db
      .select({
        value: sql<string>`COALESCE(SUM(
          CAST(${invoices.total} AS NUMERIC) - CAST(${invoices.amountPaid} AS NUMERIC)
        ), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.status, 'overdue'));

    const overdueAmount = parseFloat(overdueResult?.value ?? '0');

    // Total invoices count (exclude written-off)
    const [invoiceCountResult] = await db
      .select({ value: count() })
      .from(invoices)
      .where(sql`${invoices.status} != 'written_off'`);

    const totalInvoices = invoiceCountResult?.value ?? 0;

    // Total clients count
    const [clientCountResult] = await db
      .select({ value: count() })
      .from(clients);

    const totalClients = clientCountResult?.value ?? 0;

    // Paid this month: sum of payments this month
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];

    const [paidThisMonthResult] = await db
      .select({ value: sum(payments.amount) })
      .from(payments)
      .where(sql`${payments.paymentDate} >= ${firstOfMonthStr}`);

    const paidThisMonth = parseFloat(paidThisMonthResult?.value ?? '0');

    // Total bank balance: sum of currentBalance from active accounts
    const [bankBalanceResult] = await db
      .select({ value: sum(bankAccounts.currentBalance) })
      .from(bankAccounts)
      .where(eq(bankAccounts.isActive, true));

    const totalBankBalance = parseFloat(bankBalanceResult?.value ?? '0');

    // Monthly expenses: sum of expense transactions this month
    const [monthlyExpensesResult] = await db
      .select({ value: sum(transactions.amount) })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          sql`${transactions.date} >= ${firstOfMonthStr}`,
        ),
      );

    const monthlyExpenses = parseFloat(monthlyExpensesResult?.value ?? '0');

    res.json({
      data: {
        totalRevenue,
        outstandingAmount,
        overdueAmount,
        totalInvoices,
        totalClients,
        paidThisMonth,
        totalBankBalance,
        monthlyExpenses,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /revenue-chart - Last 12 months of revenue data
router.get('/revenue-chart', async (req, res, next) => {
  try {
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

    const data = rows.rows.map((row: any) => ({
      month: row.month,
      revenue: parseFloat(row.revenue ?? '0'),
      invoiceCount: parseInt(row.invoice_count ?? '0', 10),
    }));

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /recent-activity - Last 20 activity log entries
router.get('/recent-activity', async (req, res, next) => {
  try {
    const result = await db.select({
      id: activityLog.id,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      action: activityLog.action,
      description: activityLog.description,
      userId: activityLog.userId,
      createdAt: activityLog.createdAt,
      userName: users.name,
    }).from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(20);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
