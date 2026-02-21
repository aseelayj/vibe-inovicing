import { Router } from 'express';
import { eq, and, or, ilike, desc, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { employees, payrollEntries, activityLog } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createEmployeeSchema, updateEmployeeSchema } from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / — List employees (filter: ?active, ?role, ?search)
router.get('/', async (req, res, next) => {
  try {
    const { search, active, role } = req.query;
    let query = db.select().from(employees).orderBy(desc(employees.createdAt));

    const conditions = [];

    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(employees.name, pattern),
          ilike(employees.email, pattern),
        )!,
      );
    }

    if (active === 'true') {
      conditions.push(isNull(employees.endDate));
    } else if (active === 'false') {
      conditions.push(isNotNull(employees.endDate));
    }

    if (role && typeof role === 'string') {
      conditions.push(eq(employees.role, role));
    }

    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query;
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query;
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /:id — Get employee with payroll history
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, id),
      with: {
        payrollEntries: {
          orderBy: desc(payrollEntries.createdAt),
        },
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.json({ data: employee });
  } catch (err) {
    next(err);
  }
});

// POST / — Create employee
router.post('/', validate(createEmployeeSchema), async (req, res, next) => {
  try {
    const [employee] = await db.insert(employees)
      .values(req.body)
      .returning();

    await db.insert(activityLog).values({
      entityType: 'employee',
      entityId: employee.id,
      action: 'created',
      description: `Employee "${employee.name}" created`,
      userId: (req as AuthRequest).userId,
    });

    res.status(201).json({ data: employee });
  } catch (err) {
    next(err);
  }
});

// PUT /:id — Update employee
router.put(
  '/:id',
  validate(updateEmployeeSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const [updated] = await db.update(employees)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(employees.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      await db.insert(activityLog).values({
        entityType: 'employee',
        entityId: updated.id,
        action: 'updated',
        description: `Employee "${updated.name}" updated`,
        userId: (req as AuthRequest).userId,
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — Delete (only if no payroll entries)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const entries = await db.select({ id: payrollEntries.id })
      .from(payrollEntries)
      .where(eq(payrollEntries.employeeId, id))
      .limit(1);

    if (entries.length > 0) {
      res.status(400).json({
        error: 'Cannot delete employee with payroll entries',
      });
      return;
    }

    const [deleted] = await db.delete(employees)
      .where(eq(employees.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'employee',
      entityId: deleted.id,
      action: 'deleted',
      description: `Employee "${deleted.name}" deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Employee deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
