import { Router } from 'express';
import {
  eq, and, desc, asc, gte, lte, ilike, or, sql, isNull,
} from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  partnerExpenseCategories,
  partnerExpenses,
  partnerPayments,
  partnerEmployees,
  partnerSskEntries,
  activityLog,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createPartnerExpenseCategorySchema,
  updatePartnerExpenseCategorySchema,
  createPartnerExpenseSchema,
  updatePartnerExpenseSchema,
  createPartnerPaymentSchema,
  updatePartnerPaymentSchema,
  createPartnerEmployeeSchema,
  updatePartnerEmployeeSchema,
  generatePartnerSskSchema,
  updatePartnerSskSchema,
  DEFAULT_PARTNER_CATEGORIES,
} from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// ===================== Categories =====================

// GET /categories
router.get('/categories', async (_req, res, next) => {
  try {
    const result = await db.select().from(partnerExpenseCategories)
      .orderBy(asc(partnerExpenseCategories.sortOrder));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /categories
router.post(
  '/categories',
  validate(createPartnerExpenseCategorySchema),
  async (req, res, next) => {
    try {
      const [cat] = await db.insert(partnerExpenseCategories)
        .values(req.body).returning();

      await db.insert(activityLog).values({
        entityType: 'partner_expense_category',
        entityId: cat.id,
        action: 'created',
        description: `Partner expense category "${cat.nameEn || cat.name}" created`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: cat });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /categories/:id
router.put(
  '/categories/:id',
  validate(updatePartnerExpenseCategorySchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const [updated] = await db.update(partnerExpenseCategories)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(partnerExpenseCategories.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /categories/:id
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    // Check for linked expenses
    const linked = await db.select({ id: partnerExpenses.id })
      .from(partnerExpenses)
      .where(eq(partnerExpenses.categoryId, id))
      .limit(1);

    if (linked.length > 0) {
      res.status(400).json({
        error: 'Cannot delete category with linked expenses. Deactivate it instead.',
      });
      return;
    }

    await db.delete(partnerExpenseCategories)
      .where(eq(partnerExpenseCategories.id, id));
    res.json({ data: { message: 'Category deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /categories/seed — idempotent
router.post('/categories/seed', async (req, res, next) => {
  try {
    const existing = await db.select({ id: partnerExpenseCategories.id })
      .from(partnerExpenseCategories).limit(1);

    if (existing.length > 0) {
      res.json({ data: { message: 'Categories already seeded', seeded: false } });
      return;
    }

    const values = DEFAULT_PARTNER_CATEGORIES.map((cat, i) => ({
      name: cat.name,
      nameEn: cat.nameEn,
      defaultSplitPercent: String(cat.defaultSplitPercent),
      sortOrder: i,
    }));

    await db.insert(partnerExpenseCategories).values(values);

    await db.insert(activityLog).values({
      entityType: 'partner_expense_category',
      entityId: 0,
      action: 'seeded',
      description: `Seeded ${values.length} default partner expense categories`,
      userId: (req as AuthRequest).userId,
    });

    const all = await db.select().from(partnerExpenseCategories)
      .orderBy(asc(partnerExpenseCategories.sortOrder));
    res.status(201).json({ data: all, seeded: true });
  } catch (err) {
    next(err);
  }
});

// ===================== Expenses =====================

// GET /expenses
router.get('/expenses', async (req, res, next) => {
  try {
    const { categoryId, year, fromDate, toDate, search, page, pageSize } =
      req.query;
    const conditions = [];

    if (categoryId && typeof categoryId === 'string') {
      const parsed = parseInt(categoryId, 10);
      if (!isNaN(parsed)) {
        conditions.push(eq(partnerExpenses.categoryId, parsed));
      }
    }

    if (year && typeof year === 'string') {
      const y = parseInt(year, 10);
      if (!isNaN(y)) {
        conditions.push(
          gte(partnerExpenses.date, `${y}-01-01`),
          lte(partnerExpenses.date, `${y}-12-31`),
        );
      }
    }

    if (fromDate && typeof fromDate === 'string') {
      conditions.push(gte(partnerExpenses.date, fromDate));
    }
    if (toDate && typeof toDate === 'string') {
      conditions.push(lte(partnerExpenses.date, toDate));
    }

    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      conditions.push(ilike(partnerExpenses.description, pattern));
    }

    const limit = Math.min(
      parseInt(String(pageSize || '50'), 10) || 50, 200,
    );
    const offset = ((parseInt(String(page || '1'), 10) || 1) - 1) * limit;

    const where = conditions.length === 1
      ? conditions[0]
      : conditions.length > 1 ? and(...conditions) : undefined;

    const result = await db.query.partnerExpenses.findMany({
      where,
      with: { category: true },
      orderBy: desc(partnerExpenses.date),
      limit,
      offset,
    });

    const [{ total }] = await db.select({
      total: sql<number>`count(*)::int`,
    }).from(partnerExpenses).where(where);

    res.json({
      data: result,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /expenses/:id
router.get('/expenses/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const expense = await db.query.partnerExpenses.findFirst({
      where: eq(partnerExpenses.id, id),
      with: { category: true },
    });

    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    res.json({ data: expense });
  } catch (err) {
    next(err);
  }
});

// POST /expenses
router.post(
  '/expenses',
  validate(createPartnerExpenseSchema),
  async (req, res, next) => {
    try {
      const data = req.body;
      // Round partner share to 2 decimals
      data.partnerShare = Math.round(data.partnerShare * 100) / 100;

      const [expense] = await db.insert(partnerExpenses)
        .values({
          categoryId: data.categoryId ?? null,
          date: data.date,
          description: data.description,
          totalAmount: String(data.totalAmount),
          splitPercent: String(data.splitPercent),
          partnerShare: String(data.partnerShare),
          notes: data.notes ?? null,
        }).returning();

      await db.insert(activityLog).values({
        entityType: 'partner_expense',
        entityId: expense.id,
        action: 'created',
        description: `Partner expense "${data.description}" created (${data.partnerShare} JOD)`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: expense });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /expenses/:id
router.put(
  '/expenses/:id',
  validate(updatePartnerExpenseSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const data = { ...req.body };
      if (data.partnerShare !== undefined) {
        data.partnerShare = Math.round(data.partnerShare * 100) / 100;
      }

      // Convert numbers to strings for decimal columns
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
      if (data.date !== undefined) updates.date = data.date;
      if (data.description !== undefined) updates.description = data.description;
      if (data.totalAmount !== undefined) {
        updates.totalAmount = String(data.totalAmount);
      }
      if (data.splitPercent !== undefined) {
        updates.splitPercent = String(data.splitPercent);
      }
      if (data.partnerShare !== undefined) {
        updates.partnerShare = String(data.partnerShare);
      }
      if (data.notes !== undefined) updates.notes = data.notes;

      const [updated] = await db.update(partnerExpenses)
        .set(updates)
        .where(eq(partnerExpenses.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /expenses/:id
router.delete('/expenses/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const expense = await db.query.partnerExpenses.findFirst({
      where: eq(partnerExpenses.id, id),
    });
    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    await db.delete(partnerExpenses).where(eq(partnerExpenses.id, id));

    await db.insert(activityLog).values({
      entityType: 'partner_expense',
      entityId: id,
      action: 'deleted',
      description: `Partner expense "${expense.description}" deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Expense deleted' } });
  } catch (err) {
    next(err);
  }
});

// ===================== Payments =====================

// GET /payments
router.get('/payments', async (req, res, next) => {
  try {
    const { year, fromDate, toDate, page, pageSize } = req.query;
    const conditions = [];

    if (year && typeof year === 'string') {
      const y = parseInt(year, 10);
      if (!isNaN(y)) {
        conditions.push(
          gte(partnerPayments.date, `${y}-01-01`),
          lte(partnerPayments.date, `${y}-12-31`),
        );
      }
    }
    if (fromDate && typeof fromDate === 'string') {
      conditions.push(gte(partnerPayments.date, fromDate));
    }
    if (toDate && typeof toDate === 'string') {
      conditions.push(lte(partnerPayments.date, toDate));
    }

    const limit = Math.min(
      parseInt(String(pageSize || '50'), 10) || 50, 200,
    );
    const offset = ((parseInt(String(page || '1'), 10) || 1) - 1) * limit;

    const where = conditions.length === 1
      ? conditions[0]
      : conditions.length > 1 ? and(...conditions) : undefined;

    const result = await db.select().from(partnerPayments)
      .where(where)
      .orderBy(desc(partnerPayments.date))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({
      total: sql<number>`count(*)::int`,
    }).from(partnerPayments).where(where);

    res.json({
      data: result,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /payments
router.post(
  '/payments',
  validate(createPartnerPaymentSchema),
  async (req, res, next) => {
    try {
      const data = req.body;
      const [payment] = await db.insert(partnerPayments)
        .values({
          date: data.date,
          amount: String(data.amount),
          description: data.description ?? null,
          paymentMethod: data.paymentMethod ?? null,
          reference: data.reference ?? null,
          notes: data.notes ?? null,
        }).returning();

      await db.insert(activityLog).values({
        entityType: 'partner_payment',
        entityId: payment.id,
        action: 'created',
        description: `Partner payment of ${data.amount} JOD received`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: payment });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /payments/:id
router.put(
  '/payments/:id',
  validate(updatePartnerPaymentSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const data = req.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.date !== undefined) updates.date = data.date;
      if (data.amount !== undefined) updates.amount = String(data.amount);
      if (data.description !== undefined) updates.description = data.description;
      if (data.paymentMethod !== undefined) {
        updates.paymentMethod = data.paymentMethod;
      }
      if (data.reference !== undefined) updates.reference = data.reference;
      if (data.notes !== undefined) updates.notes = data.notes;

      const [updated] = await db.update(partnerPayments)
        .set(updates)
        .where(eq(partnerPayments.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /payments/:id
router.delete('/payments/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const payment = await db.query.partnerPayments.findFirst({
      where: eq(partnerPayments.id, id),
    });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    await db.delete(partnerPayments).where(eq(partnerPayments.id, id));

    await db.insert(activityLog).values({
      entityType: 'partner_payment',
      entityId: id,
      action: 'deleted',
      description: `Partner payment of ${payment.amount} JOD deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Payment deleted' } });
  } catch (err) {
    next(err);
  }
});

// ===================== Partner Employees =====================

// GET /employees
router.get('/employees', async (_req, res, next) => {
  try {
    const result = await db.select().from(partnerEmployees)
      .orderBy(asc(partnerEmployees.name));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /employees
router.post(
  '/employees',
  validate(createPartnerEmployeeSchema),
  async (req, res, next) => {
    try {
      const [emp] = await db.insert(partnerEmployees)
        .values({
          name: req.body.name,
          sskMonthlyAmount: String(req.body.sskMonthlyAmount),
          startDate: req.body.startDate,
          endDate: req.body.endDate ?? null,
          isActive: req.body.isActive ?? true,
          notes: req.body.notes ?? null,
        }).returning();

      await db.insert(activityLog).values({
        entityType: 'partner_employee',
        entityId: emp.id,
        action: 'created',
        description: `Partner employee "${emp.name}" created`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: emp });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /employees/:id
router.put(
  '/employees/:id',
  validate(updatePartnerEmployeeSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const data = req.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) updates.name = data.name;
      if (data.sskMonthlyAmount !== undefined) {
        updates.sskMonthlyAmount = String(data.sskMonthlyAmount);
      }
      if (data.startDate !== undefined) updates.startDate = data.startDate;
      if (data.endDate !== undefined) updates.endDate = data.endDate;
      if (data.isActive !== undefined) updates.isActive = data.isActive;
      if (data.notes !== undefined) updates.notes = data.notes;

      const [updated] = await db.update(partnerEmployees)
        .set(updates)
        .where(eq(partnerEmployees.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /employees/:id
router.delete('/employees/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    // Check for SSK entries referencing this employee (jsonb query)
    const [ref] = await db.select({ id: partnerSskEntries.id })
      .from(partnerSskEntries)
      .where(sql`${partnerSskEntries.breakdown}::jsonb @> ${JSON.stringify([{ employeeId: id }])}::jsonb`)
      .limit(1);
    const referenced = !!ref;

    if (referenced) {
      res.status(400).json({
        error: 'Cannot delete employee with SSK entries. Deactivate instead.',
      });
      return;
    }

    const emp = await db.query.partnerEmployees.findFirst({
      where: eq(partnerEmployees.id, id),
    });
    if (!emp) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    await db.delete(partnerEmployees).where(eq(partnerEmployees.id, id));

    await db.insert(activityLog).values({
      entityType: 'partner_employee',
      entityId: id,
      action: 'deleted',
      description: `Partner employee "${emp.name}" deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Employee deleted' } });
  } catch (err) {
    next(err);
  }
});

// ===================== SSK Entries =====================

// GET /ssk
router.get('/ssk', async (req, res, next) => {
  try {
    const { year } = req.query;
    const conditions = [];

    if (year && typeof year === 'string') {
      const y = parseInt(year, 10);
      if (!isNaN(y)) conditions.push(eq(partnerSskEntries.year, y));
    }

    let query = db.select().from(partnerSskEntries)
      .orderBy(desc(partnerSskEntries.year), desc(partnerSskEntries.month));

    if (conditions.length > 0) {
      query = query.where(conditions[0]) as typeof query;
    }

    const result = await query;
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /ssk/generate
router.post(
  '/ssk/generate',
  validate(generatePartnerSskSchema),
  async (req, res, next) => {
    try {
      const { year, month } = req.body;

      // Check unique constraint
      const existing = await db.select({ id: partnerSskEntries.id })
        .from(partnerSskEntries)
        .where(and(
          eq(partnerSskEntries.year, year),
          eq(partnerSskEntries.month, month),
        ))
        .limit(1);

      if (existing.length > 0) {
        res.status(400).json({
          error: `SSK entry for ${year}-${String(month).padStart(2, '0')} already exists`,
        });
        return;
      }

      // Get active employees for the month
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
      const firstDay = new Date(year, month - 1, 1)
        .toISOString().split('T')[0];

      const activeEmps = await db.select().from(partnerEmployees)
        .where(and(
          lte(partnerEmployees.startDate, lastDay),
          or(
            isNull(partnerEmployees.endDate),
            gte(partnerEmployees.endDate, firstDay),
          ),
          eq(partnerEmployees.isActive, true),
        ));

      if (activeEmps.length === 0) {
        res.status(400).json({
          error: 'No active partner employees for this month',
        });
        return;
      }

      const breakdown = activeEmps.map((emp) => ({
        employeeId: emp.id,
        name: emp.name,
        amount: parseFloat(emp.sskMonthlyAmount || '0'),
      }));

      const totalAmount = breakdown.reduce((s, b) => s + b.amount, 0);

      const [entry] = await db.insert(partnerSskEntries)
        .values({
          year,
          month,
          totalAmount: String(totalAmount),
          breakdown,
        }).returning();

      await db.insert(activityLog).values({
        entityType: 'partner_ssk_entry',
        entityId: entry.id,
        action: 'generated',
        description: `Partner SSK for ${year}-${String(month).padStart(2, '0')} generated (${totalAmount} JOD, ${activeEmps.length} employees)`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: entry });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /ssk/:id
router.put('/ssk/:id', validate(updatePartnerSskSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const { isPaid, notes, totalAmount } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (isPaid !== undefined) updates.isPaid = isPaid;
    if (notes !== undefined) updates.notes = notes;
    if (totalAmount !== undefined) {
      updates.totalAmount = String(totalAmount);
    }

    const [updated] = await db.update(partnerSskEntries)
      .set(updates)
      .where(eq(partnerSskEntries.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'SSK entry not found' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /ssk/:id
router.delete('/ssk/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const entry = await db.query.partnerSskEntries.findFirst({
      where: eq(partnerSskEntries.id, id),
    });
    if (!entry) {
      res.status(404).json({ error: 'SSK entry not found' });
      return;
    }

    await db.delete(partnerSskEntries).where(eq(partnerSskEntries.id, id));

    await db.insert(activityLog).values({
      entityType: 'partner_ssk_entry',
      entityId: id,
      action: 'deleted',
      description: `Partner SSK for ${entry.year}-${String(entry.month).padStart(2, '0')} deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'SSK entry deleted' } });
  } catch (err) {
    next(err);
  }
});

// ===================== Summary =====================

// GET /summary
router.get('/summary', async (req, res, next) => {
  try {
    const { year } = req.query;
    const expenseConditions = [];
    const paymentConditions = [];
    const sskConditions = [];

    if (year && typeof year === 'string') {
      const y = parseInt(year, 10);
      if (!isNaN(y)) {
        expenseConditions.push(
          gte(partnerExpenses.date, `${y}-01-01`),
          lte(partnerExpenses.date, `${y}-12-31`),
        );
        paymentConditions.push(
          gte(partnerPayments.date, `${y}-01-01`),
          lte(partnerPayments.date, `${y}-12-31`),
        );
        sskConditions.push(eq(partnerSskEntries.year, y));
      }
    }

    const expenseWhere = expenseConditions.length > 0
      ? and(...expenseConditions) : undefined;
    const paymentWhere = paymentConditions.length > 0
      ? and(...paymentConditions) : undefined;
    const sskWhere = sskConditions.length > 0
      ? sskConditions[0] : undefined;

    const [expenseResult] = await db.select({
      total: sql<string>`coalesce(sum(${partnerExpenses.partnerShare}), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(partnerExpenses).where(expenseWhere);

    const [paymentResult] = await db.select({
      total: sql<string>`coalesce(sum(${partnerPayments.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(partnerPayments).where(paymentWhere);

    const [sskResult] = await db.select({
      total: sql<string>`coalesce(sum(${partnerSskEntries.totalAmount}), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(partnerSskEntries).where(sskWhere);

    const totalExpenses = parseFloat(expenseResult.total);
    const totalSsk = parseFloat(sskResult.total);
    const totalPayments = parseFloat(paymentResult.total);

    res.json({
      data: {
        totalExpenses,
        totalSsk,
        totalPayments,
        balance: totalExpenses + totalSsk - totalPayments,
        expenseCount: expenseResult.count,
        sskCount: sskResult.count,
        paymentCount: paymentResult.count,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
