import { Router } from 'express';
import { eq, and, or, desc, isNull, lte, gte, asc, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  payrollRuns,
  payrollEntries,
  employees,
  activityLog,
  transactions,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createPayrollRunSchema,
  updatePayrollEntrySchema,
  updatePayrollPaymentSchema,
  addPayrollEntrySchema,
  markAllPaidSchema,
  STANDARD_WORKING_DAYS,
  SSK_SALARY_CAP,
} from '@vibe/shared';
import {
  calculatePayrollEntry,
  recalculatePayrollRunTotals,
} from '../services/payroll.service.js';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';
import { recalculateBalance } from './bank-account.routes.js';

const router = Router();

// Validation for PUT /:id
const updatePayrollRunSchema = z.object({
  notes: z.string().nullable().optional(),
  standardWorkingDays: z.number().int().min(1).max(31).optional(),
});

// GET / — List payroll runs (filter: ?year, ?status)
router.get('/', async (req, res, next) => {
  try {
    const { year, status } = req.query;
    const conditions = [];

    if (year && typeof year === 'string') {
      const parsed = parseInt(year, 10);
      if (!isNaN(parsed)) conditions.push(eq(payrollRuns.year, parsed));
    }
    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(eq(payrollRuns.status, status));
    }

    let query = db.select().from(payrollRuns)
      .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));

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

// GET /:id — Get run with all entries
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
      with: {
        entries: {
          orderBy: asc(payrollEntries.employeeName),
        },
      },
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    res.json({ data: run });
  } catch (err) {
    next(err);
  }
});

// POST / — Create run + auto-populate active employees (in transaction)
router.post(
  '/',
  validate(createPayrollRunSchema),
  async (req, res, next) => {
    try {
      const { year, month, standardWorkingDays, notes, duplicateFromRunId } = req.body;
      const stdDays = standardWorkingDays ?? STANDARD_WORKING_DAYS;

      // Compute last day of payroll month for hire date filter
      const lastDayOfMonth = new Date(year, month, 0)
        .toISOString().split('T')[0];

      const fullRun = await db.transaction(async (tx) => {
        // Check unique year/month inside transaction
        const existing = await tx.select({ id: payrollRuns.id })
          .from(payrollRuns)
          .where(and(
            eq(payrollRuns.year, year),
            eq(payrollRuns.month, month),
          ))
          .limit(1);

        if (existing.length > 0) {
          throw new Error(
            `Payroll run for ${year}-${String(month).padStart(2, '0')} already exists`,
          );
        }

        // Fetch employees who were active during this month:
        // - hired on or before last day of month
        // - still active OR terminated during/after this month
        const firstDayOfMonth = new Date(year, month - 1, 1)
          .toISOString().split('T')[0];
        const activeEmployees = await tx.select()
          .from(employees)
          .where(and(
            lte(employees.hireDate, lastDayOfMonth),
            or(
              isNull(employees.endDate),
              gte(employees.endDate, firstDayOfMonth),
            ),
          ));

        // If duplicating, fetch source entries
        let sourceEntries: typeof payrollEntries.$inferSelect[] = [];
        if (duplicateFromRunId) {
          sourceEntries = await tx.select()
            .from(payrollEntries)
            .where(eq(payrollEntries.payrollRunId, duplicateFromRunId));
        }
        const sourceMap = new Map(
          sourceEntries.map((e) => [e.employeeId, e]),
        );

        // Create run
        const [run] = await tx.insert(payrollRuns)
          .values({
            year,
            month,
            standardWorkingDays: stdDays,
            notes: notes ?? null,
            entryCount: activeEmployees.length,
          })
          .returning();

        // Create entries for each active employee
        if (activeEmployees.length > 0) {
          const entryValues = activeEmployees.map((emp) => {
            const src = sourceMap.get(emp.id);
            const baseSalary = parseFloat(emp.baseSalary || '0');
            const transportAllowance = parseFloat(
              emp.transportAllowance || '0',
            );

            // When duplicating, copy only recurring items; one-time items reset to 0
            // For mid-month terminations, prorate working days
            let defaultWorkingDays = stdDays;
            if (emp.endDate) {
              const endDate = new Date(emp.endDate);
              const monthEnd = new Date(year, month, 0);
              if (endDate < monthEnd) {
                // Employee left before month end — prorate
                defaultWorkingDays = Math.min(
                  stdDays,
                  Math.round(stdDays * endDate.getDate() / monthEnd.getDate()),
                );
              }
            }
            const workingDays = src
              ? src.workingDays : defaultWorkingDays;
            const weekdayOTHours = src
              ? parseFloat(src.weekdayOvertimeHours || '0') : 0;
            const weekendOTHours = src
              ? parseFloat(src.weekendOvertimeHours || '0') : 0;
            const salaryDifference = src
              ? parseFloat(src.salaryDifference || '0') : 0;

            const calc = calculatePayrollEntry({
              baseSalary,
              workingDays,
              standardWorkingDays: stdDays,
              weekdayOvertimeHours: weekdayOTHours,
              weekendOvertimeHours: weekendOTHours,
              transportAllowance,
              bonus: 0,
              salaryDifference,
              salaryAdvance: 0,
              otherDeductions: 0,
              sskEnrolled: emp.sskEnrolled,
            });

            return {
              payrollRunId: run.id,
              employeeId: emp.id,
              employeeName: emp.name,
              employeeRole: emp.role,
              baseSalary: String(baseSalary),
              sskEnrolled: emp.sskEnrolled,
              workingDays,
              standardWorkingDays: stdDays,
              basicSalary: String(calc.basicSalary),
              weekdayOvertimeHours: String(weekdayOTHours),
              weekdayOvertimeAmount: String(calc.weekdayOvertimeAmount),
              weekendOvertimeHours: String(weekendOTHours),
              weekendOvertimeAmount: String(calc.weekendOvertimeAmount),
              transportAllowance: String(transportAllowance),
              bonus: '0',
              salaryDifference: String(salaryDifference),
              grossSalary: String(calc.grossSalary),
              salaryAdvance: '0',
              otherDeductions: '0',
              sskEmployee: String(calc.sskEmployee),
              totalDeductions: String(calc.totalDeductions),
              netSalary: String(calc.netSalary),
              sskEmployer: String(calc.sskEmployer),
            };
          });

          await tx.insert(payrollEntries).values(entryValues);
        }

        await recalculatePayrollRunTotals(tx, run.id);

        return await tx.query.payrollRuns.findFirst({
          where: eq(payrollRuns.id, run.id),
          with: { entries: true },
        });
      });

      if (!fullRun) {
        res.status(500).json({ error: 'Failed to create payroll run' });
        return;
      }

      await db.insert(activityLog).values({
        entityType: 'payroll_run',
        entityId: fullRun.id,
        action: 'created',
        description: `Payroll run ${year}-${String(month).padStart(2, '0')} created with ${fullRun.entryCount} employees`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: fullRun });
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

// PUT /:id — Update run metadata (notes, standardWorkingDays)
router.put(
  '/:id',
  validate(updatePayrollRunSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, id),
      });

      if (!run) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      if (run.status !== 'draft') {
        res.status(400).json({ error: 'Can only edit draft payroll runs' });
        return;
      }

      const { notes, standardWorkingDays } = req.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (notes !== undefined) updates.notes = notes;
      if (standardWorkingDays !== undefined) {
        updates.standardWorkingDays = standardWorkingDays;
      }

      // If standardWorkingDays changed, recalculate all entries
      if (
        standardWorkingDays !== undefined
        && standardWorkingDays !== run.standardWorkingDays
      ) {
        const result = await db.transaction(async (tx) => {
          const [updatedRun] = await tx.update(payrollRuns)
            .set(updates)
            .where(eq(payrollRuns.id, id))
            .returning();

          const entries = await tx.select().from(payrollEntries)
            .where(eq(payrollEntries.payrollRunId, id));

          for (const entry of entries) {
            const calc = calculatePayrollEntry({
              baseSalary: parseFloat(entry.baseSalary || '0'),
              workingDays: entry.workingDays,
              standardWorkingDays,
              weekdayOvertimeHours: parseFloat(entry.weekdayOvertimeHours || '0'),
              weekendOvertimeHours: parseFloat(entry.weekendOvertimeHours || '0'),
              transportAllowance: parseFloat(entry.transportAllowance || '0'),
              bonus: parseFloat(entry.bonus || '0'),
              salaryDifference: parseFloat(entry.salaryDifference || '0'),
              salaryAdvance: parseFloat(entry.salaryAdvance || '0'),
              otherDeductions: parseFloat(entry.otherDeductions || '0'),
              sskEnrolled: entry.sskEnrolled,
            });

            await tx.update(payrollEntries)
              .set({
                standardWorkingDays,
                basicSalary: String(calc.basicSalary),
                weekdayOvertimeAmount: String(calc.weekdayOvertimeAmount),
                weekendOvertimeAmount: String(calc.weekendOvertimeAmount),
                grossSalary: String(calc.grossSalary),
                sskEmployee: String(calc.sskEmployee),
                totalDeductions: String(calc.totalDeductions),
                netSalary: String(calc.netSalary),
                sskEmployer: String(calc.sskEmployer),
                updatedAt: new Date(),
              })
              .where(eq(payrollEntries.id, entry.id));
          }

          await recalculatePayrollRunTotals(tx, id);
          return updatedRun;
        });

        res.json({ data: result });
        return;
      }

      const [updated] = await db.update(payrollRuns)
        .set(updates)
        .where(eq(payrollRuns.id, id))
        .returning();

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — Delete (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    if (run.status !== 'draft') {
      res.status(400).json({ error: 'Can only delete draft payroll runs' });
      return;
    }

    await db.delete(payrollRuns).where(eq(payrollRuns.id, id));

    await db.insert(activityLog).values({
      entityType: 'payroll_run',
      entityId: id,
      action: 'deleted',
      description: `Payroll run ${run.year}-${String(run.month).padStart(2, '0')} deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Payroll run deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /:id/entries — Add an employee to an existing draft run
router.post('/:id/entries', validate(addPayrollEntrySchema), async (req, res, next) => {
  try {
    const runId = parseId(req, res);
    if (runId === null) return;
    const { employeeId } = req.body;

    const result = await db.transaction(async (tx) => {
      const run = await tx.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, runId),
      });
      if (!run) throw new Error('RUN_NOT_FOUND');
      if (run.status !== 'draft') throw new Error('DRAFT_ONLY');

      // Check not already in run
      const existing = await tx.select({ id: payrollEntries.id })
        .from(payrollEntries)
        .where(and(
          eq(payrollEntries.payrollRunId, runId),
          eq(payrollEntries.employeeId, employeeId),
        ))
        .limit(1);
      if (existing.length > 0) throw new Error('ALREADY_EXISTS');

      const emp = await tx.query.employees.findFirst({
        where: eq(employees.id, employeeId),
      });
      if (!emp) throw new Error('EMPLOYEE_NOT_FOUND');

      const baseSalary = parseFloat(emp.baseSalary || '0');
      const transportAllowance = parseFloat(emp.transportAllowance || '0');
      const stdDays = run.standardWorkingDays;

      const calc = calculatePayrollEntry({
        baseSalary,
        workingDays: stdDays,
        standardWorkingDays: stdDays,
        weekdayOvertimeHours: 0,
        weekendOvertimeHours: 0,
        transportAllowance,
        bonus: 0,
        salaryDifference: 0,
        salaryAdvance: 0,
        otherDeductions: 0,
        sskEnrolled: emp.sskEnrolled,
      });

      const [entry] = await tx.insert(payrollEntries).values({
        payrollRunId: runId,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        baseSalary: String(baseSalary),
        sskEnrolled: emp.sskEnrolled,
        workingDays: stdDays,
        standardWorkingDays: stdDays,
        basicSalary: String(calc.basicSalary),
        weekdayOvertimeHours: '0',
        weekdayOvertimeAmount: '0',
        weekendOvertimeHours: '0',
        weekendOvertimeAmount: '0',
        transportAllowance: String(transportAllowance),
        bonus: '0',
        salaryDifference: '0',
        grossSalary: String(calc.grossSalary),
        salaryAdvance: '0',
        otherDeductions: '0',
        sskEmployee: String(calc.sskEmployee),
        totalDeductions: String(calc.totalDeductions),
        netSalary: String(calc.netSalary),
        sskEmployer: String(calc.sskEmployer),
      }).returning();

      // Update entry count
      const countResult = await tx.select({ count: eq(payrollEntries.payrollRunId, runId) })
        .from(payrollEntries)
        .where(eq(payrollEntries.payrollRunId, runId));
      await tx.update(payrollRuns).set({
        entryCount: countResult.length,
        updatedAt: new Date(),
      }).where(eq(payrollRuns.id, runId));

      await recalculatePayrollRunTotals(tx, runId);
      return entry;
    });

    res.status(201).json({ data: result });
  } catch (err: any) {
    if (err?.message === 'RUN_NOT_FOUND') {
      res.status(404).json({ error: 'Payroll run not found' });
    } else if (err?.message === 'DRAFT_ONLY') {
      res.status(400).json({ error: 'Can only add entries to draft runs' });
    } else if (err?.message === 'ALREADY_EXISTS') {
      res.status(400).json({ error: 'Employee already in this payroll run' });
    } else if (err?.message === 'EMPLOYEE_NOT_FOUND') {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      next(err);
    }
  }
});

// DELETE /:id/entries/:entryId — Remove an entry from a draft run
router.delete('/:id/entries/:entryId', async (req, res, next) => {
  try {
    const runId = parseId(req, res, 'id');
    if (runId === null) return;
    const entryId = parseId(req, res, 'entryId');
    if (entryId === null) return;

    await db.transaction(async (tx) => {
      const run = await tx.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, runId),
      });
      if (!run) throw new Error('RUN_NOT_FOUND');
      if (run.status !== 'draft') throw new Error('DRAFT_ONLY');

      const entry = await tx.query.payrollEntries.findFirst({
        where: and(
          eq(payrollEntries.id, entryId),
          eq(payrollEntries.payrollRunId, runId),
        ),
      });
      if (!entry) throw new Error('ENTRY_NOT_FOUND');

      await tx.delete(payrollEntries).where(eq(payrollEntries.id, entryId));

      // Update entry count
      const remaining = await tx.select({ id: payrollEntries.id })
        .from(payrollEntries)
        .where(eq(payrollEntries.payrollRunId, runId));
      await tx.update(payrollRuns).set({
        entryCount: remaining.length,
        updatedAt: new Date(),
      }).where(eq(payrollRuns.id, runId));

      await recalculatePayrollRunTotals(tx, runId);
    });

    res.json({ data: { message: 'Entry removed' } });
  } catch (err: any) {
    if (err?.message === 'RUN_NOT_FOUND') {
      res.status(404).json({ error: 'Payroll run not found' });
    } else if (err?.message === 'DRAFT_ONLY') {
      res.status(400).json({ error: 'Can only remove entries from draft runs' });
    } else if (err?.message === 'ENTRY_NOT_FOUND') {
      res.status(404).json({ error: 'Entry not found in this run' });
    } else {
      next(err);
    }
  }
});

// PUT /:id/entries/:entryId — Update entry (draft only), auto-recalculate in tx
router.put(
  '/:id/entries/:entryId',
  validate(updatePayrollEntrySchema),
  async (req, res, next) => {
    try {
      const runId = parseId(req, res, 'id');
      if (runId === null) return;

      const entryId = parseId(req, res, 'entryId');
      if (entryId === null) return;

      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, runId),
      });

      if (!run) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      if (run.status !== 'draft') {
        res.status(400).json({
          error: 'Can only edit entries in draft payroll runs',
        });
        return;
      }

      const entry = await db.query.payrollEntries.findFirst({
        where: and(
          eq(payrollEntries.id, entryId),
          eq(payrollEntries.payrollRunId, runId),
        ),
      });

      if (!entry) {
        res.status(404).json({ error: 'Payroll entry not found' });
        return;
      }

      const merged = {
        baseSalary: parseFloat(entry.baseSalary || '0'),
        workingDays: req.body.workingDays ?? entry.workingDays,
        standardWorkingDays: entry.standardWorkingDays,
        weekdayOvertimeHours: req.body.weekdayOvertimeHours
          ?? parseFloat(entry.weekdayOvertimeHours || '0'),
        weekendOvertimeHours: req.body.weekendOvertimeHours
          ?? parseFloat(entry.weekendOvertimeHours || '0'),
        transportAllowance: parseFloat(entry.transportAllowance || '0'),
        bonus: req.body.bonus ?? parseFloat(entry.bonus || '0'),
        salaryDifference: req.body.salaryDifference
          ?? parseFloat(entry.salaryDifference || '0'),
        salaryAdvance: req.body.salaryAdvance
          ?? parseFloat(entry.salaryAdvance || '0'),
        otherDeductions: req.body.otherDeductions
          ?? parseFloat(entry.otherDeductions || '0'),
        sskEnrolled: entry.sskEnrolled,
      };

      const calc = calculatePayrollEntry(merged);

      // Wrap entry update + totals recalculation in a single transaction
      const updated = await db.transaction(async (tx) => {
        const [result] = await tx.update(payrollEntries)
          .set({
            workingDays: merged.workingDays,
            weekdayOvertimeHours: String(merged.weekdayOvertimeHours),
            weekendOvertimeHours: String(merged.weekendOvertimeHours),
            bonus: String(merged.bonus),
            salaryDifference: String(merged.salaryDifference),
            salaryAdvance: String(merged.salaryAdvance),
            otherDeductions: String(merged.otherDeductions),
            otherDeductionsNote: req.body.otherDeductionsNote !== undefined
              ? req.body.otherDeductionsNote
              : entry.otherDeductionsNote,
            basicSalary: String(calc.basicSalary),
            weekdayOvertimeAmount: String(calc.weekdayOvertimeAmount),
            weekendOvertimeAmount: String(calc.weekendOvertimeAmount),
            grossSalary: String(calc.grossSalary),
            sskEmployee: String(calc.sskEmployee),
            totalDeductions: String(calc.totalDeductions),
            netSalary: String(calc.netSalary),
            sskEmployer: String(calc.sskEmployer),
            updatedAt: new Date(),
          })
          .where(eq(payrollEntries.id, entryId))
          .returning();

        await recalculatePayrollRunTotals(tx, runId);
        return result;
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/finalize — Lock entries
router.patch('/:id/finalize', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    if (run.status !== 'draft') {
      res.status(400).json({ error: 'Can only finalize draft runs' });
      return;
    }

    const [updated] = await db.update(payrollRuns)
      .set({
        status: 'finalized',
        finalizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payrollRuns.id, id))
      .returning();

    await db.insert(activityLog).values({
      entityType: 'payroll_run',
      entityId: id,
      action: 'finalized',
      description: `Payroll run ${run.year}-${String(run.month).padStart(2, '0')} finalized`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/reopen — Only finalized runs (not paid)
router.patch('/:id/reopen', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    if (run.status !== 'finalized') {
      res.status(400).json({
        error: run.status === 'draft'
          ? 'Run is already draft'
          : 'Cannot reopen a paid run — bank transactions have been recorded',
      });
      return;
    }

    const [updated] = await db.update(payrollRuns)
      .set({
        status: 'draft',
        finalizedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(payrollRuns.id, id))
      .returning();

    await db.insert(activityLog).values({
      entityType: 'payroll_run',
      entityId: id,
      action: 'reopened',
      description: `Payroll run ${run.year}-${String(run.month).padStart(2, '0')} reopened`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/entries/:entryId/payment — Update payment info (finalized+ only)
router.patch(
  '/:id/entries/:entryId/payment',
  validate(updatePayrollPaymentSchema),
  async (req, res, next) => {
    try {
      const runId = parseId(req, res, 'id');
      if (runId === null) return;

      const entryId = parseId(req, res, 'entryId');
      if (entryId === null) return;

      // Check run status — don't allow payment on draft runs
      const run = await db.query.payrollRuns.findFirst({
        where: eq(payrollRuns.id, runId),
      });

      if (!run) {
        res.status(404).json({ error: 'Payroll run not found' });
        return;
      }

      if (run.status === 'draft') {
        res.status(400).json({
          error: 'Finalize the payroll run before updating payments',
        });
        return;
      }

      const { paymentStatus, paymentDate, bankTrxReference, bankAccountId } =
        req.body;

      // Use a transaction to prevent TOCTOU race on duplicate bank transactions
      const updated = await db.transaction(async (tx) => {
        const entry = await tx.query.payrollEntries.findFirst({
          where: and(
            eq(payrollEntries.id, entryId),
            eq(payrollEntries.payrollRunId, runId),
          ),
        });

        if (!entry) throw new Error('NOT_FOUND');

        const [result] = await tx.update(payrollEntries)
          .set({
            paymentStatus,
            paymentDate: paymentDate ?? null,
            bankTrxReference: bankTrxReference ?? null,
            bankAccountId: bankAccountId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(payrollEntries.id, entryId))
          .returning();

        // Auto-create expense transaction when marking paid with a bank account
        if (
          paymentStatus === 'paid'
          && bankAccountId
          && entry.paymentStatus !== 'paid'
        ) {
          const netSalary = parseFloat(entry.netSalary || '0');
          if (netSalary > 0) {
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
          }
        }

        // Reversal: if changing FROM 'paid' to something else, reverse the bank transaction
        if (
          entry.paymentStatus === 'paid'
          && paymentStatus !== 'paid'
          && entry.bankAccountId
        ) {
          const netSalary = parseFloat(entry.netSalary || '0');
          if (netSalary > 0) {
            await tx.insert(transactions).values({
              bankAccountId: entry.bankAccountId,
              type: 'income',
              category: 'salary',
              amount: String(netSalary),
              date: new Date().toISOString().split('T')[0],
              description: `Salary reversal: ${entry.employeeName}`,
            });
            await recalculateBalance(tx, entry.bankAccountId);
          }
        }

        return result;
      });

      res.json({ data: updated });
    } catch (err: any) {
      if (err?.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Payroll entry not found' });
        return;
      }
      next(err);
    }
  },
);

// PATCH /:id/mark-all-paid — Batch mark pending entries as paid + create bank txns
router.patch('/:id/mark-all-paid', validate(markAllPaidSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    if (run.status === 'draft') {
      res.status(400).json({
        error: 'Finalize the payroll run before marking entries paid',
      });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const bankAccountId = req.body?.bankAccountId ?? null;

    // Get pending entries to process
    const pendingEntries = await db.select()
      .from(payrollEntries)
      .where(and(
        eq(payrollEntries.payrollRunId, id),
        eq(payrollEntries.paymentStatus, 'pending'),
      ));

    await db.transaction(async (tx) => {
      // Mark all pending as paid
      await tx.update(payrollEntries)
        .set({
          paymentStatus: 'paid',
          paymentDate: today,
          bankAccountId: bankAccountId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(payrollEntries.payrollRunId, id),
          eq(payrollEntries.paymentStatus, 'pending'),
        ));

      // Create bank expense transactions for each entry
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

      // Only set run to 'paid' if no on_hold entries remain
      const onHoldEntries = await tx.select({ id: payrollEntries.id })
        .from(payrollEntries)
        .where(and(
          eq(payrollEntries.payrollRunId, id),
          ne(payrollEntries.paymentStatus, 'paid'),
        ))
        .limit(1);

      if (onHoldEntries.length === 0) {
        await tx.update(payrollRuns)
          .set({ status: 'paid', updatedAt: new Date() })
          .where(eq(payrollRuns.id, id));
      }
    });

    await db.insert(activityLog).values({
      entityType: 'payroll_run',
      entityId: id,
      action: 'marked_all_paid',
      description: `Pending entries in ${run.year}-${String(run.month).padStart(2, '0')} marked as paid (${pendingEntries.length} entries)`,
      userId: (req as AuthRequest).userId,
    });

    const fullRun = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
      with: { entries: true },
    });

    res.json({ data: fullRun });
  } catch (err) {
    next(err);
  }
});

// ---- CSV Export Helpers ----
function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsv).join(',');
}

function formatNum(val: string | number | null | undefined): string {
  return parseFloat(String(val || '0')).toFixed(2);
}

// GET /:id/export/spreadsheet — Full payroll spreadsheet as CSV
router.get('/:id/export/spreadsheet', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
      with: {
        entries: {
          orderBy: asc(payrollEntries.employeeName),
        },
      },
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    const filename = `payroll-${run.year}-${String(run.month).padStart(2, '0')}-spreadsheet.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const headers = [
      'Employee', 'Role', 'Working Days', 'Basic Salary',
      'Weekday OT Hours', 'Weekday OT Amount',
      'Weekend OT Hours', 'Weekend OT Amount',
      'Transport', 'Bonus', 'Salary Difference', 'Gross',
      'Salary Advance', 'Other Deductions', 'SSK Employee',
      'Total Deductions', 'Net Salary', 'SSK Employer',
      'Payment Status',
    ];

    const rows: string[] = [csvRow(headers)];

    for (const entry of run.entries) {
      rows.push(csvRow([
        entry.employeeName,
        entry.employeeRole,
        entry.workingDays,
        formatNum(entry.basicSalary),
        formatNum(entry.weekdayOvertimeHours),
        formatNum(entry.weekdayOvertimeAmount),
        formatNum(entry.weekendOvertimeHours),
        formatNum(entry.weekendOvertimeAmount),
        formatNum(entry.transportAllowance),
        formatNum(entry.bonus),
        formatNum(entry.salaryDifference),
        formatNum(entry.grossSalary),
        formatNum(entry.salaryAdvance),
        formatNum(entry.otherDeductions),
        formatNum(entry.sskEmployee),
        formatNum(entry.totalDeductions),
        formatNum(entry.netSalary),
        formatNum(entry.sskEmployer),
        entry.paymentStatus,
      ]));
    }

    res.send(rows.join('\n'));
  } catch (err) {
    next(err);
  }
});

// GET /:id/export/bank-transfers — Bank transfer list as CSV
router.get('/:id/export/bank-transfers', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
      with: {
        entries: {
          orderBy: asc(payrollEntries.employeeName),
        },
      },
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    // Filter to pending or paid entries only
    const eligibleEntries = run.entries.filter(
      (e) => e.paymentStatus === 'pending' || e.paymentStatus === 'paid',
    );

    // Fetch employee bank info for all eligible entries
    const employeeIds = eligibleEntries.map((e) => e.employeeId);
    const employeeRecords = employeeIds.length > 0
      ? await db.select({
        id: employees.id,
        bankAccountName: employees.bankAccountName,
        bankIban: employees.bankIban,
      })
        .from(employees)
        .where(
          or(...employeeIds.map((eid) => eq(employees.id, eid))),
        )
      : [];

    const empMap = new Map(
      employeeRecords.map((e) => [e.id, e]),
    );

    const filename = `payroll-${run.year}-${String(run.month).padStart(2, '0')}-bank-transfers.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const headers = [
      'Employee Name', 'Bank Account Name', 'IBAN',
      'Net Salary', 'Payment Status',
    ];

    const rows: string[] = [csvRow(headers)];

    for (const entry of eligibleEntries) {
      const emp = empMap.get(entry.employeeId);
      rows.push(csvRow([
        entry.employeeName,
        emp?.bankAccountName ?? '',
        emp?.bankIban ?? '',
        formatNum(entry.netSalary),
        entry.paymentStatus,
      ]));
    }

    res.send(rows.join('\n'));
  } catch (err) {
    next(err);
  }
});

// GET /:id/export/ssk — SSK submission report as CSV
router.get('/:id/export/ssk', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, id),
      with: {
        entries: {
          orderBy: asc(payrollEntries.employeeName),
        },
      },
    });

    if (!run) {
      res.status(404).json({ error: 'Payroll run not found' });
      return;
    }

    const sskEntries = run.entries.filter((e) => e.sskEnrolled);

    const filename = `payroll-${run.year}-${String(run.month).padStart(2, '0')}-ssk.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const headers = [
      'Employee Name', 'Gross Salary', 'SSK Base',
      'Employee SSK (7.5%)', 'Employer SSK (14.25%)', 'Total SSK',
    ];

    const rows: string[] = [csvRow(headers)];

    let totalGross = 0;
    let totalSskBase = 0;
    let totalEmployeeSsk = 0;
    let totalEmployerSsk = 0;
    let totalSsk = 0;

    for (const entry of sskEntries) {
      const gross = parseFloat(String(entry.grossSalary || '0'));
      const sskBase = Math.min(gross, SSK_SALARY_CAP);
      const employeeSsk = parseFloat(String(entry.sskEmployee || '0'));
      const employerSsk = parseFloat(String(entry.sskEmployer || '0'));
      const entrySskTotal = employeeSsk + employerSsk;

      totalGross += gross;
      totalSskBase += sskBase;
      totalEmployeeSsk += employeeSsk;
      totalEmployerSsk += employerSsk;
      totalSsk += entrySskTotal;

      rows.push(csvRow([
        entry.employeeName,
        formatNum(gross),
        formatNum(sskBase),
        formatNum(employeeSsk),
        formatNum(employerSsk),
        formatNum(entrySskTotal),
      ]));
    }

    // Totals row
    rows.push(csvRow([
      'TOTAL',
      formatNum(totalGross),
      formatNum(totalSskBase),
      formatNum(totalEmployeeSsk),
      formatNum(totalEmployerSsk),
      formatNum(totalSsk),
    ]));

    res.send(rows.join('\n'));
  } catch (err) {
    next(err);
  }
});

export default router;
