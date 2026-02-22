import { Router } from 'express';
import { eq, and, sql, sum, count } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { db } from '../db/index.js';
import {
  invoices,
  clients,
  transactions,
  payments,
  settings,
  commitments,
} from '../db/schema.js';
import {
  getBimonthlyPeriod,
  getCurrentBimonthlyPeriod,
  getYearBimonthlyPeriods,
  calculateIncomeTax,
  BIMONTHLY_PERIODS,
} from '@vibe/shared';

const router = Router();

// ---- Helper: parse date range from query ----
function parseDateRange(query: Record<string, unknown>) {
  const startDate = String(query.startDate ?? '');
  const endDate = String(query.endDate ?? '');
  if (!startDate || !endDate) return null;
  return { startDate, endDate };
}

// ---- GET /sales-tax — Sales Tax Report (كشف المبيعات) ----
router.get('/sales-tax', async (req, res, next) => {
  try {
    const { year, period: periodIdx } = req.query;
    let range: { startDate: string; endDate: string; label: string; deadline: string };

    if (year && periodIdx !== undefined) {
      const p = getBimonthlyPeriod(Number(year), Number(periodIdx));
      range = {
        startDate: p.startDate,
        endDate: p.endDate,
        label: `${p.label} ${p.year}`,
        deadline: p.deadlineDate,
      };
    } else {
      const p = getCurrentBimonthlyPeriod();
      range = {
        startDate: p.startDate,
        endDate: p.endDate,
        label: `${p.label} ${p.year}`,
        deadline: p.deadlineDate,
      };
    }

    // Get all non-draft, non-cancelled invoices in the period
    const invoiceRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientName: clients.name,
        issueDate: invoices.issueDate,
        subtotal: invoices.subtotal,
        taxAmount: invoices.taxAmount,
        total: invoices.total,
        isTaxable: invoices.isTaxable,
        status: invoices.status,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          sql`${invoices.issueDate} >= ${range.startDate}`,
          sql`${invoices.issueDate} <= ${range.endDate}`,
          sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
        ),
      )
      .orderBy(invoices.issueDate);

    let taxableSales = 0;
    let exemptSales = 0;
    let outputTax = 0;

    const rows = invoiceRows.map((row) => {
      const subtotal = parseFloat(String(row.subtotal));
      const tax = parseFloat(String(row.taxAmount));
      const total = parseFloat(String(row.total));

      if (row.isTaxable) {
        taxableSales += subtotal;
        outputTax += tax;
      } else {
        exemptSales += subtotal;
      }

      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        clientName: row.clientName,
        issueDate: row.issueDate,
        subtotal,
        taxAmount: tax,
        total,
        isTaxable: row.isTaxable,
        status: row.status,
      };
    });

    res.json({
      data: {
        period: range,
        taxableSales,
        exemptSales,
        totalSales: taxableSales + exemptSales,
        outputTax,
        invoiceCount: rows.length,
        invoices: rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /purchases — Purchases Report (كشف المشتريات) ----
router.get('/purchases', async (req, res, next) => {
  try {
    const { year, period: periodIdx } = req.query;
    let range: { startDate: string; endDate: string; label: string };

    if (year && periodIdx !== undefined) {
      const p = getBimonthlyPeriod(Number(year), Number(periodIdx));
      range = {
        startDate: p.startDate,
        endDate: p.endDate,
        label: `${p.label} ${p.year}`,
      };
    } else {
      const p = getCurrentBimonthlyPeriod();
      range = {
        startDate: p.startDate,
        endDate: p.endDate,
        label: `${p.label} ${p.year}`,
      };
    }

    const txnRows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          sql`${transactions.date} >= ${range.startDate}`,
          sql`${transactions.date} <= ${range.endDate}`,
        ),
      )
      .orderBy(transactions.date);

    let totalPurchases = 0;
    let inputTax = 0;

    const rows = txnRows.map((row) => {
      const amount = parseFloat(String(row.amount));
      const tax = row.taxAmount ? parseFloat(String(row.taxAmount)) : null;
      totalPurchases += amount;
      if (tax) inputTax += tax;

      return {
        id: row.id,
        date: row.date,
        description: row.description,
        supplierName: row.supplierName,
        invoiceReference: row.invoiceReference,
        category: row.category,
        amount,
        taxAmount: tax,
      };
    });

    res.json({
      data: {
        period: range,
        totalPurchases,
        inputTax,
        transactionCount: rows.length,
        transactions: rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /gst-summary — GST Return Summary ----
router.get('/gst-summary', async (req, res, next) => {
  try {
    const { year, period: periodIdx } = req.query;
    let startDate: string, endDate: string, label: string, deadline: string;

    if (year && periodIdx !== undefined) {
      const p = getBimonthlyPeriod(Number(year), Number(periodIdx));
      startDate = p.startDate;
      endDate = p.endDate;
      label = `${p.label} ${p.year}`;
      deadline = p.deadlineDate;
    } else {
      const p = getCurrentBimonthlyPeriod();
      startDate = p.startDate;
      endDate = p.endDate;
      label = `${p.label} ${p.year}`;
      deadline = p.deadlineDate;
    }

    // Output tax from invoices
    const [taxableSalesResult] = await db
      .select({
        subtotal: sql<string>`COALESCE(SUM(CAST(${invoices.subtotal} AS NUMERIC)), 0)`,
        tax: sql<string>`COALESCE(SUM(CAST(${invoices.taxAmount} AS NUMERIC)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          sql`${invoices.issueDate} >= ${startDate}`,
          sql`${invoices.issueDate} <= ${endDate}`,
          sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
          eq(invoices.isTaxable, true),
        ),
      );

    const [exemptSalesResult] = await db
      .select({
        subtotal: sql<string>`COALESCE(SUM(CAST(${invoices.subtotal} AS NUMERIC)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          sql`${invoices.issueDate} >= ${startDate}`,
          sql`${invoices.issueDate} <= ${endDate}`,
          sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
          eq(invoices.isTaxable, false),
        ),
      );

    // Input tax from expense transactions
    const [purchasesResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
        tax: sql<string>`COALESCE(SUM(CAST(${transactions.taxAmount} AS NUMERIC)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          sql`${transactions.date} >= ${startDate}`,
          sql`${transactions.date} <= ${endDate}`,
        ),
      );

    const outputTax = parseFloat(taxableSalesResult?.tax ?? '0');
    const inputTax = parseFloat(purchasesResult?.tax ?? '0');

    res.json({
      data: {
        period: { startDate, endDate, label, deadline },
        outputTax,
        inputTax,
        netTax: outputTax - inputTax,
        taxableSales: parseFloat(taxableSalesResult?.subtotal ?? '0'),
        exemptSales: parseFloat(exemptSalesResult?.subtotal ?? '0'),
        totalPurchases: parseFloat(purchasesResult?.total ?? '0'),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /income-tax — Annual Income Tax Report ----
router.get('/income-tax', async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get settings for exemptions
    const [settingsRow] = await db.select().from(settings).limit(1);

    const filingStatus = settingsRow?.filingStatus ?? 'single';
    const personalExemption = parseFloat(
      String(settingsRow?.personalExemption ?? '9000'),
    );
    const familyExemption = filingStatus === 'married'
      ? parseFloat(String(settingsRow?.familyExemption ?? '9000'))
      : 0;
    const additionalExemptions = parseFloat(
      String(settingsRow?.additionalExemptions ?? '0'),
    );

    // Total revenue from paid/partially paid invoices
    const [revenueResult] = await db
      .select({
        value: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)`,
      })
      .from(payments)
      .where(
        and(
          sql`${payments.paymentDate} >= ${startDate}`,
          sql`${payments.paymentDate} <= ${endDate}`,
        ),
      );

    const totalRevenue = parseFloat(revenueResult?.value ?? '0');

    // Total expenses from transactions
    const [expensesResult] = await db
      .select({
        value: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          sql`${transactions.date} >= ${startDate}`,
          sql`${transactions.date} <= ${endDate}`,
        ),
      );

    const totalExpenses = parseFloat(expensesResult?.value ?? '0');

    // Expenses by category
    const categoryRows = await db
      .select({
        category: transactions.category,
        total: sql<string>`SUM(CAST(${transactions.amount} AS NUMERIC))`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'expense'),
          sql`${transactions.date} >= ${startDate}`,
          sql`${transactions.date} <= ${endDate}`,
        ),
      )
      .groupBy(transactions.category)
      .orderBy(sql`SUM(CAST(${transactions.amount} AS NUMERIC)) DESC`);

    const expensesByCategory = categoryRows.map((row) => ({
      category: row.category,
      amount: parseFloat(row.total ?? '0'),
    }));

    const grossProfit = totalRevenue - totalExpenses;
    const totalExemptions = personalExemption + familyExemption
      + additionalExemptions;
    const taxableIncome = Math.max(0, grossProfit - totalExemptions);

    const { tax: totalTax, brackets, nationalContribution } =
      calculateIncomeTax(taxableIncome);

    res.json({
      data: {
        year,
        totalRevenue,
        totalExpenses,
        grossProfit,
        expensesByCategory,
        personalExemption,
        familyExemption,
        additionalExemptions,
        totalExemptions,
        taxableIncome,
        taxBrackets: brackets,
        totalTax,
        nationalContribution,
        totalLiability: totalTax + nationalContribution,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /profit-loss — Profit & Loss Statement ----
router.get('/profit-loss', async (req, res, next) => {
  try {
    const range = parseDateRange(req.query as Record<string, unknown>);
    const now = new Date();
    const startDate = range?.startDate
      ?? `${now.getFullYear()}-01-01`;
    const endDate = range?.endDate
      ?? now.toISOString().split('T')[0];

    // Revenue by month (from payments)
    const revenueByMonth = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', CAST(payment_date AS DATE)), 'YYYY-MM') AS month,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
      FROM payments
      WHERE payment_date >= ${startDate} AND payment_date <= ${endDate}
      GROUP BY DATE_TRUNC('month', CAST(payment_date AS DATE))
      ORDER BY month
    `);

    const revenueMonths = (revenueByMonth.rows as any[]).map((r) => ({
      month: r.month,
      amount: parseFloat(r.amount ?? '0'),
    }));
    const totalRevenue = revenueMonths.reduce((s, r) => s + r.amount, 0);

    // Expenses by month
    const expensesByMonth = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', CAST(date AS DATE)), 'YYYY-MM') AS month,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
      FROM transactions
      WHERE type = 'expense'
        AND date >= ${startDate} AND date <= ${endDate}
      GROUP BY DATE_TRUNC('month', CAST(date AS DATE))
      ORDER BY month
    `);

    const expenseMonths = (expensesByMonth.rows as any[]).map((r) => ({
      month: r.month,
      amount: parseFloat(r.amount ?? '0'),
    }));
    const totalExpenses = expenseMonths.reduce((s, r) => s + r.amount, 0);

    // Expenses by category
    const expensesByCat = await db.execute(sql`
      SELECT category,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
      FROM transactions
      WHERE type = 'expense'
        AND date >= ${startDate} AND date <= ${endDate}
      GROUP BY category
      ORDER BY amount DESC
    `);

    const byCategory = (expensesByCat.rows as any[]).map((r) => ({
      category: r.category,
      amount: parseFloat(r.amount ?? '0'),
    }));

    // Include active commitments (recurring expenses) in the P&L
    const activeCommitments = await db
      .select()
      .from(commitments)
      .where(eq(commitments.isActive, true));

    let totalCommitmentExpenses = 0;
    const commitmentsByCategory: Record<string, number> = {};

    if (activeCommitments.length > 0) {
      // Calculate how many months are in the date range
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (const c of activeCommitments) {
        const amount = parseFloat(String(c.amount));
        let multiplier = 1;

        // Calculate monthly equivalent based on frequency
        let monthlyAmount = amount;
        if (c.frequency === 'yearly') monthlyAmount = amount / 12;
        else if (c.frequency === 'quarterly') monthlyAmount = amount / 3;
        else if (c.frequency === 'weekly') monthlyAmount = amount * 4.33;
        else if (c.frequency === 'daily') monthlyAmount = amount * 30;

        // Count months in range
        const months =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()) + 1;

        const totalForPeriod = monthlyAmount * months;
        totalCommitmentExpenses += totalForPeriod;

        const cat = c.category || 'recurring';
        commitmentsByCategory[cat] =
          (commitmentsByCategory[cat] || 0) + totalForPeriod;
      }
    }

    // Merge commitment categories into byCategory
    for (const [cat, amount] of Object.entries(commitmentsByCategory)) {
      const existing = byCategory.find((b) => b.category === cat);
      if (existing) {
        existing.amount += amount;
      } else {
        byCategory.push({ category: cat, amount });
      }
    }

    const combinedExpenses = totalExpenses + totalCommitmentExpenses;

    res.json({
      data: {
        period: { startDate, endDate },
        revenue: { total: totalRevenue, byMonth: revenueMonths },
        expenses: {
          total: combinedExpenses,
          byCategory: byCategory,
          byMonth: expenseMonths,
          commitments: totalCommitmentExpenses,
        },
        netProfit: totalRevenue - combinedExpenses,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /tax-deadlines — Upcoming tax deadlines ----
router.get('/tax-deadlines', async (req, res, next) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const deadlines: {
      type: string;
      label: string;
      period: string;
      deadline: string;
      daysUntil: number;
    }[] = [];

    // Check bimonthly GST deadlines for current and next period
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
          type: 'gst',
          label: 'إقرار ضريبة المبيعات',
          period: `${p.label} ${p.year}`,
          deadline: p.deadlineDate,
          daysUntil,
        });
        if (deadlines.length >= 3) break;
      }
    }

    // Annual income tax deadline (April 30)
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
      type: 'income_tax',
      label: 'إقرار ضريبة الدخل السنوي',
      period: String(incomeTaxYear),
      deadline: incomeTaxDeadline,
      daysUntil: daysUntilIncomeTax,
    });

    // Sort by nearest deadline
    deadlines.sort((a, b) => a.daysUntil - b.daysUntil);

    res.json({ data: deadlines });
  } catch (err) {
    next(err);
  }
});

// ---- GET /export/:type — Export report as Excel ----
router.get('/export/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { year, period: periodIdx, startDate, endDate } = req.query;

    const wb = XLSX.utils.book_new();

    if (type === 'sales-tax') {
      const p = (year && periodIdx !== undefined)
        ? getBimonthlyPeriod(Number(year), Number(periodIdx))
        : getCurrentBimonthlyPeriod();

      const invoiceRows = await db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          clientName: clients.name,
          issueDate: invoices.issueDate,
          subtotal: invoices.subtotal,
          taxAmount: invoices.taxAmount,
          total: invoices.total,
          isTaxable: invoices.isTaxable,
          status: invoices.status,
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .where(
          and(
            sql`${invoices.issueDate} >= ${p.startDate}`,
            sql`${invoices.issueDate} <= ${p.endDate}`,
            sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
          ),
        )
        .orderBy(invoices.issueDate);

      const data = invoiceRows.map((row) => ({
        'رقم الفاتورة': row.invoiceNumber,
        'اسم العميل': row.clientName ?? '',
        'تاريخ الإصدار': row.issueDate,
        'المبلغ قبل الضريبة': parseFloat(String(row.subtotal)),
        'مبلغ الضريبة': parseFloat(String(row.taxAmount)),
        'المبلغ الإجمالي': parseFloat(String(row.total)),
        'خاضعة للضريبة': row.isTaxable ? 'نعم' : 'لا',
        'الحالة': row.status,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'كشف المبيعات');
    } else if (type === 'purchases') {
      const p = (year && periodIdx !== undefined)
        ? getBimonthlyPeriod(Number(year), Number(periodIdx))
        : getCurrentBimonthlyPeriod();

      const txnRows = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'expense'),
            sql`${transactions.date} >= ${p.startDate}`,
            sql`${transactions.date} <= ${p.endDate}`,
          ),
        )
        .orderBy(transactions.date);

      const data = txnRows.map((row) => ({
        'التاريخ': row.date,
        'الوصف': row.description,
        'اسم المورد': row.supplierName ?? '',
        'رقم فاتورة المورد': row.invoiceReference ?? '',
        'التصنيف': row.category,
        'المبلغ': parseFloat(String(row.amount)),
        'ضريبة المدخلات': row.taxAmount
          ? parseFloat(String(row.taxAmount)) : 0,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'كشف المشتريات');
    } else if (type === 'gst-summary') {
      const p = (year && periodIdx !== undefined)
        ? getBimonthlyPeriod(Number(year), Number(periodIdx))
        : getCurrentBimonthlyPeriod();

      // Output tax
      const [taxableSalesResult] = await db
        .select({
          subtotal: sql<string>`COALESCE(SUM(CAST(${invoices.subtotal} AS NUMERIC)), 0)`,
          tax: sql<string>`COALESCE(SUM(CAST(${invoices.taxAmount} AS NUMERIC)), 0)`,
        })
        .from(invoices)
        .where(
          and(
            sql`${invoices.issueDate} >= ${p.startDate}`,
            sql`${invoices.issueDate} <= ${p.endDate}`,
            sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
            eq(invoices.isTaxable, true),
          ),
        );

      const [exemptResult] = await db
        .select({
          subtotal: sql<string>`COALESCE(SUM(CAST(${invoices.subtotal} AS NUMERIC)), 0)`,
        })
        .from(invoices)
        .where(
          and(
            sql`${invoices.issueDate} >= ${p.startDate}`,
            sql`${invoices.issueDate} <= ${p.endDate}`,
            sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
            eq(invoices.isTaxable, false),
          ),
        );

      // Input tax
      const [purchasesResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
          tax: sql<string>`COALESCE(SUM(CAST(${transactions.taxAmount} AS NUMERIC)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'expense'),
            sql`${transactions.date} >= ${p.startDate}`,
            sql`${transactions.date} <= ${p.endDate}`,
          ),
        );

      const outputTax = parseFloat(taxableSalesResult?.tax ?? '0');
      const inputTax = parseFloat(purchasesResult?.tax ?? '0');

      const summaryData = [
        {
          'البند': 'مبيعات خاضعة للضريبة',
          'المبلغ (د.أ)': parseFloat(taxableSalesResult?.subtotal ?? '0'),
        },
        {
          'البند': 'مبيعات معفاة',
          'المبلغ (د.أ)': parseFloat(exemptResult?.subtotal ?? '0'),
        },
        {
          'البند': 'ضريبة المخرجات (16%)',
          'المبلغ (د.أ)': outputTax,
        },
        {
          'البند': 'إجمالي المشتريات',
          'المبلغ (د.أ)': parseFloat(purchasesResult?.total ?? '0'),
        },
        {
          'البند': 'ضريبة المدخلات',
          'المبلغ (د.أ)': inputTax,
        },
        {
          'البند': 'صافي الضريبة المستحقة',
          'المبلغ (د.أ)': outputTax - inputTax,
        },
      ];

      const ws = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, 'ملخص إقرار المبيعات');
    } else if (type === 'income-tax') {
      // Redirect internally by calling income-tax logic
      const yearNum = Number(year) || new Date().getFullYear();
      const sd = `${yearNum}-01-01`;
      const ed = `${yearNum}-12-31`;

      const [settingsRow] = await db.select().from(settings).limit(1);
      const filingStatus = settingsRow?.filingStatus ?? 'single';
      const personalEx = parseFloat(
        String(settingsRow?.personalExemption ?? '9000'),
      );
      const familyEx = filingStatus === 'married'
        ? parseFloat(String(settingsRow?.familyExemption ?? '9000')) : 0;
      const additionalEx = parseFloat(
        String(settingsRow?.additionalExemptions ?? '0'),
      );

      const [revResult] = await db
        .select({
          value: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS NUMERIC)), 0)`,
        })
        .from(payments)
        .where(
          and(
            sql`${payments.paymentDate} >= ${sd}`,
            sql`${payments.paymentDate} <= ${ed}`,
          ),
        );

      const [expResult] = await db
        .select({
          value: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS NUMERIC)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.type, 'expense'),
            sql`${transactions.date} >= ${sd}`,
            sql`${transactions.date} <= ${ed}`,
          ),
        );

      const totalRev = parseFloat(revResult?.value ?? '0');
      const totalExp = parseFloat(expResult?.value ?? '0');
      const grossProfit = totalRev - totalExp;
      const totalExemptions = personalEx + familyEx + additionalEx;
      const taxableIncome = Math.max(0, grossProfit - totalExemptions);
      const { tax, brackets, nationalContribution } =
        calculateIncomeTax(taxableIncome);

      const data = [
        { 'البند': 'إجمالي الإيرادات', 'المبلغ (د.أ)': totalRev },
        { 'البند': 'إجمالي المصروفات', 'المبلغ (د.أ)': totalExp },
        { 'البند': 'صافي الربح', 'المبلغ (د.أ)': grossProfit },
        { 'البند': 'الإعفاء الشخصي', 'المبلغ (د.أ)': personalEx },
        { 'البند': 'الإعفاء العائلي', 'المبلغ (د.أ)': familyEx },
        { 'البند': 'إعفاءات إضافية', 'المبلغ (د.أ)': additionalEx },
        { 'البند': 'الدخل الخاضع للضريبة', 'المبلغ (د.أ)': taxableIncome },
        { 'البند': 'ضريبة الدخل', 'المبلغ (د.أ)': tax },
        { 'البند': 'ضريبة المساهمة الوطنية', 'المبلغ (د.أ)': nationalContribution },
        { 'البند': 'إجمالي الالتزام الضريبي', 'المبلغ (د.أ)': tax + nationalContribution },
      ];

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'إقرار ضريبة الدخل');
    } else if (type === 'profit-loss') {
      const sd = String(startDate ?? `${new Date().getFullYear()}-01-01`);
      const ed = String(endDate ?? new Date().toISOString().split('T')[0]);

      // Revenue
      const revenueRows = await db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', CAST(payment_date AS DATE)), 'YYYY-MM') AS month,
          COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
        FROM payments
        WHERE payment_date >= ${sd} AND payment_date <= ${ed}
        GROUP BY DATE_TRUNC('month', CAST(payment_date AS DATE))
        ORDER BY month
      `);

      // Expenses
      const expenseRows = await db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', CAST(date AS DATE)), 'YYYY-MM') AS month,
          category,
          COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS amount
        FROM transactions
        WHERE type = 'expense' AND date >= ${sd} AND date <= ${ed}
        GROUP BY DATE_TRUNC('month', CAST(date AS DATE)), category
        ORDER BY month, category
      `);

      const plData: Record<string, unknown>[] = [];

      for (const row of revenueRows.rows as any[]) {
        plData.push({
          'الشهر': row.month,
          'النوع': 'إيرادات',
          'التصنيف': 'إيرادات',
          'المبلغ': parseFloat(row.amount ?? '0'),
        });
      }

      for (const row of expenseRows.rows as any[]) {
        plData.push({
          'الشهر': row.month,
          'النوع': 'مصروفات',
          'التصنيف': row.category,
          'المبلغ': parseFloat(row.amount ?? '0'),
        });
      }

      const ws = XLSX.utils.json_to_sheet(plData);
      XLSX.utils.book_append_sheet(wb, ws, 'قائمة الأرباح والخسائر');
    } else {
      res.status(400).json({ error: `Unknown export type: ${type}` });
      return;
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `${type}-report.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

export default router;
