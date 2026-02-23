import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { bankAccounts } from './banking.js';

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  role: varchar('role', { length: 100 }).notNull(),
  baseSalary: decimal('base_salary', { precision: 12, scale: 2 })
    .notNull().default('0'),
  transportAllowance: decimal('transport_allowance', { precision: 12, scale: 2 })
    .notNull().default('0'),
  sskEnrolled: boolean('ssk_enrolled').notNull().default(false),
  hireDate: date('hire_date').notNull(),
  endDate: date('end_date'),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  bankIban: varchar('bank_iban', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_employees_name').on(table.name),
  index('idx_employees_role').on(table.role),
]);

export const payrollRuns = pgTable('payroll_runs', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  standardWorkingDays: integer('standard_working_days').notNull().default(26),
  totalGross: decimal('total_gross', { precision: 12, scale: 2 })
    .notNull().default('0'),
  totalDeductions: decimal('total_deductions', { precision: 12, scale: 2 })
    .notNull().default('0'),
  totalNet: decimal('total_net', { precision: 12, scale: 2 })
    .notNull().default('0'),
  totalSskEmployee: decimal('total_ssk_employee', { precision: 12, scale: 2 })
    .notNull().default('0'),
  totalSskEmployer: decimal('total_ssk_employer', { precision: 12, scale: 2 })
    .notNull().default('0'),
  totalCompanyCost: decimal('total_company_cost', { precision: 12, scale: 2 })
    .notNull().default('0'),
  notes: text('notes'),
  finalizedAt: timestamp('finalized_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  entryCount: integer('entry_count').notNull().default(0),
}, (table) => [
  uniqueIndex('uq_payroll_year_month').on(table.year, table.month),
  index('idx_payroll_runs_status').on(table.status),
]);

export const payrollEntries = pgTable('payroll_entries', {
  id: serial('id').primaryKey(),
  payrollRunId: integer('payroll_run_id').notNull()
    .references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: integer('employee_id').notNull()
    .references(() => employees.id, { onDelete: 'restrict' }),
  employeeName: varchar('employee_name', { length: 255 }).notNull(),
  employeeRole: varchar('employee_role', { length: 100 }).notNull(),
  baseSalary: decimal('base_salary', { precision: 12, scale: 2 })
    .notNull().default('0'),
  sskEnrolled: boolean('ssk_enrolled').notNull().default(false),
  workingDays: integer('working_days').notNull().default(26),
  standardWorkingDays: integer('standard_working_days').notNull().default(26),
  basicSalary: decimal('basic_salary', { precision: 12, scale: 2 })
    .notNull().default('0'),
  weekdayOvertimeHours: decimal('weekday_overtime_hours', { precision: 8, scale: 2 })
    .notNull().default('0'),
  weekdayOvertimeAmount: decimal('weekday_overtime_amount', { precision: 12, scale: 2 })
    .notNull().default('0'),
  weekendOvertimeHours: decimal('weekend_overtime_hours', { precision: 8, scale: 2 })
    .notNull().default('0'),
  weekendOvertimeAmount: decimal('weekend_overtime_amount', { precision: 12, scale: 2 })
    .notNull().default('0'),
  transportAllowance: decimal('transport_allowance', { precision: 12, scale: 2 })
    .notNull().default('0'),
  bonus: decimal('bonus', { precision: 12, scale: 2 })
    .notNull().default('0'),
  salaryDifference: decimal('salary_difference', { precision: 12, scale: 2 })
    .notNull().default('0'),
  grossSalary: decimal('gross_salary', { precision: 12, scale: 2 })
    .notNull().default('0'),
  salaryAdvance: decimal('salary_advance', { precision: 12, scale: 2 })
    .notNull().default('0'),
  otherDeductions: decimal('other_deductions', { precision: 12, scale: 2 })
    .notNull().default('0'),
  otherDeductionsNote: text('other_deductions_note'),
  sskEmployee: decimal('ssk_employee', { precision: 12, scale: 2 })
    .notNull().default('0'),
  totalDeductions: decimal('total_deductions', { precision: 12, scale: 2 })
    .notNull().default('0'),
  netSalary: decimal('net_salary', { precision: 12, scale: 2 })
    .notNull().default('0'),
  sskEmployer: decimal('ssk_employer', { precision: 12, scale: 2 })
    .notNull().default('0'),
  paymentStatus: varchar('payment_status', { length: 20 })
    .notNull().default('pending'),
  paymentDate: date('payment_date'),
  bankTrxReference: varchar('bank_trx_reference', { length: 255 }),
  bankAccountId: integer('bank_account_id')
    .references(() => bankAccounts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_payroll_entries_run').on(table.payrollRunId),
  index('idx_payroll_entries_employee').on(table.employeeId),
  index('idx_payroll_entries_payment').on(table.paymentStatus),
]);
