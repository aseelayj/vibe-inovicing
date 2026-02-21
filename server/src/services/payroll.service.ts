import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { payrollRuns, payrollEntries } from '../db/schema.js';
import type * as schema from '../db/schema.js';
import {
  SSK_EMPLOYEE_RATE,
  SSK_EMPLOYER_RATE,
  WEEKDAY_OT_MULTIPLIER,
  WEEKEND_OT_MULTIPLIER,
} from '@vibe/shared';

export interface CalcParams {
  baseSalary: number;
  workingDays: number;
  standardWorkingDays: number;
  weekdayOvertimeHours: number;
  weekendOvertimeHours: number;
  transportAllowance: number;
  bonus: number;
  salaryDifference: number;
  salaryAdvance: number;
  otherDeductions: number;
  sskEnrolled: boolean;
}

export interface CalcResult {
  basicSalary: number;
  weekdayOvertimeAmount: number;
  weekendOvertimeAmount: number;
  grossSalary: number;
  sskEmployee: number;
  totalDeductions: number;
  netSalary: number;
  sskEmployer: number;
}

/**
 * Pure function: calculate all derived fields for a payroll entry.
 * Hourly rate = baseSalary / standardWorkingDays / 8
 */
export function calculatePayrollEntry(p: CalcParams): CalcResult {
  const hourlyRate = p.standardWorkingDays > 0
    ? p.baseSalary / p.standardWorkingDays / 8
    : 0;

  const basicSalary = p.standardWorkingDays > 0
    ? round2(p.baseSalary * p.workingDays / p.standardWorkingDays)
    : 0;

  const weekdayOvertimeAmount = round2(
    p.weekdayOvertimeHours * hourlyRate * WEEKDAY_OT_MULTIPLIER,
  );
  const weekendOvertimeAmount = round2(
    p.weekendOvertimeHours * hourlyRate * WEEKEND_OT_MULTIPLIER,
  );

  const grossSalary = round2(
    basicSalary
    + weekdayOvertimeAmount
    + weekendOvertimeAmount
    + p.transportAllowance
    + p.bonus
    + p.salaryDifference,
  );

  const sskEmployee = p.sskEnrolled
    ? round2(grossSalary * SSK_EMPLOYEE_RATE / 100)
    : 0;

  const totalDeductions = round2(
    p.salaryAdvance + p.otherDeductions + sskEmployee,
  );

  const netSalary = round2(grossSalary - totalDeductions);

  const sskEmployer = p.sskEnrolled
    ? round2(grossSalary * SSK_EMPLOYER_RATE / 100)
    : 0;

  return {
    basicSalary,
    weekdayOvertimeAmount,
    weekendOvertimeAmount,
    grossSalary,
    sskEmployee,
    totalDeductions,
    netSalary,
    sskEmployer,
  };
}

/**
 * Recalculate a payroll run's totals from its entries.
 * Accepts a transaction handle or falls back to global db.
 */
export async function recalculatePayrollRunTotals(
  txOrDb: NodePgDatabase<typeof schema>,
  runId: number,
) {
  const result = await txOrDb
    .select({
      totalGross: sql<string>`COALESCE(SUM(${payrollEntries.grossSalary}), 0)`,
      totalDeductions: sql<string>`COALESCE(SUM(${payrollEntries.totalDeductions}), 0)`,
      totalNet: sql<string>`COALESCE(SUM(${payrollEntries.netSalary}), 0)`,
      totalSskEmployee: sql<string>`COALESCE(SUM(${payrollEntries.sskEmployee}), 0)`,
      totalSskEmployer: sql<string>`COALESCE(SUM(${payrollEntries.sskEmployer}), 0)`,
    })
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollRunId, runId));

  const row = result[0];
  const totalGross = row.totalGross;
  const totalSskEmployer = row.totalSskEmployer;
  const companyCost = round2(
    parseFloat(totalGross) + parseFloat(totalSskEmployer),
  );

  await txOrDb.update(payrollRuns)
    .set({
      totalGross: totalGross,
      totalDeductions: row.totalDeductions,
      totalNet: row.totalNet,
      totalSskEmployee: row.totalSskEmployee,
      totalSskEmployer: totalSskEmployer,
      totalCompanyCost: String(companyCost),
      updatedAt: new Date(),
    })
    .where(eq(payrollRuns.id, runId));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
