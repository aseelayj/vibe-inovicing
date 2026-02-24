// ---- Product / Service Catalog ----
export const PRODUCT_TYPES = ['product', 'service'] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

// ---- Chart of Accounts ----
export const ACCOUNT_TYPES = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const DEFAULT_CHART_OF_ACCOUNTS = [
  // Assets (1xxx)
  { code: '1000', name: 'Assets', nameAr: 'الأصول', type: 'asset' as const },
  { code: '1100', name: 'Cash & Bank', nameAr: 'النقد والبنوك', type: 'asset' as const, parentCode: '1000' },
  { code: '1110', name: 'Cash on Hand', nameAr: 'النقد في الصندوق', type: 'asset' as const, parentCode: '1100' },
  { code: '1120', name: 'Bank Accounts', nameAr: 'الحسابات البنكية', type: 'asset' as const, parentCode: '1100' },
  { code: '1200', name: 'Accounts Receivable', nameAr: 'الذمم المدينة', type: 'asset' as const, parentCode: '1000' },
  { code: '1300', name: 'Prepaid Expenses', nameAr: 'المصاريف المدفوعة مقدماً', type: 'asset' as const, parentCode: '1000' },
  { code: '1500', name: 'Fixed Assets', nameAr: 'الأصول الثابتة', type: 'asset' as const, parentCode: '1000' },
  { code: '1510', name: 'Equipment', nameAr: 'المعدات', type: 'asset' as const, parentCode: '1500' },
  { code: '1520', name: 'Furniture', nameAr: 'الأثاث', type: 'asset' as const, parentCode: '1500' },
  // Liabilities (2xxx)
  { code: '2000', name: 'Liabilities', nameAr: 'الالتزامات', type: 'liability' as const },
  { code: '2100', name: 'Accounts Payable', nameAr: 'الذمم الدائنة', type: 'liability' as const, parentCode: '2000' },
  { code: '2200', name: 'Sales Tax Payable', nameAr: 'ضريبة المبيعات المستحقة', type: 'liability' as const, parentCode: '2000' },
  { code: '2300', name: 'Accrued Expenses', nameAr: 'المصاريف المستحقة', type: 'liability' as const, parentCode: '2000' },
  { code: '2400', name: 'Social Security Payable', nameAr: 'الضمان الاجتماعي المستحق', type: 'liability' as const, parentCode: '2000' },
  // Equity (3xxx)
  { code: '3000', name: 'Equity', nameAr: 'حقوق الملكية', type: 'equity' as const },
  { code: '3100', name: "Owner's Capital", nameAr: 'رأس مال المالك', type: 'equity' as const, parentCode: '3000' },
  { code: '3200', name: 'Retained Earnings', nameAr: 'الأرباح المحتجزة', type: 'equity' as const, parentCode: '3000' },
  { code: '3300', name: "Owner's Drawings", nameAr: 'مسحوبات المالك', type: 'equity' as const, parentCode: '3000' },
  // Revenue (4xxx)
  { code: '4000', name: 'Revenue', nameAr: 'الإيرادات', type: 'revenue' as const },
  { code: '4100', name: 'Service Revenue', nameAr: 'إيرادات الخدمات', type: 'revenue' as const, parentCode: '4000' },
  { code: '4200', name: 'Product Sales', nameAr: 'مبيعات المنتجات', type: 'revenue' as const, parentCode: '4000' },
  { code: '4300', name: 'Other Revenue', nameAr: 'إيرادات أخرى', type: 'revenue' as const, parentCode: '4000' },
  // Expenses (5xxx)
  { code: '5000', name: 'Expenses', nameAr: 'المصروفات', type: 'expense' as const },
  { code: '5100', name: 'Salaries & Wages', nameAr: 'الرواتب والأجور', type: 'expense' as const, parentCode: '5000' },
  { code: '5200', name: 'Rent Expense', nameAr: 'مصاريف الإيجار', type: 'expense' as const, parentCode: '5000' },
  { code: '5300', name: 'Utilities', nameAr: 'المرافق', type: 'expense' as const, parentCode: '5000' },
  { code: '5400', name: 'Office Supplies', nameAr: 'اللوازم المكتبية', type: 'expense' as const, parentCode: '5000' },
  { code: '5500', name: 'Marketing', nameAr: 'التسويق', type: 'expense' as const, parentCode: '5000' },
  { code: '5600', name: 'Professional Services', nameAr: 'الخدمات المهنية', type: 'expense' as const, parentCode: '5000' },
  { code: '5700', name: 'Travel & Transportation', nameAr: 'السفر والمواصلات', type: 'expense' as const, parentCode: '5000' },
  { code: '5800', name: 'Insurance', nameAr: 'التأمين', type: 'expense' as const, parentCode: '5000' },
  { code: '5900', name: 'Depreciation', nameAr: 'الإهلاك', type: 'expense' as const, parentCode: '5000' },
  { code: '5990', name: 'Other Expenses', nameAr: 'مصروفات أخرى', type: 'expense' as const, parentCode: '5000' },
];

// ---- Journal Entry ----
export const JOURNAL_ENTRY_STATUSES = ['draft', 'posted'] as const;
export type JournalEntryStatus = typeof JOURNAL_ENTRY_STATUSES[number];

// ---- Commitments (Recurring Expenses) ----
export const COMMITMENT_CATEGORIES = [
  'rent', 'electricity', 'water', 'internet', 'phone',
  'ssk', 'wages', 'insurance', 'subscriptions', 'loans',
  'maintenance', 'cleaning', 'government_fees', 'other',
] as const;
export type CommitmentCategory = typeof COMMITMENT_CATEGORIES[number];

export const COMMITMENT_FREQUENCIES = [
  'monthly', 'quarterly', 'yearly', 'weekly',
] as const;
export type CommitmentFrequency = typeof COMMITMENT_FREQUENCIES[number];

// ---- Partner Expenses ----
export const PARTNER_EXPENSE_PAYMENT_METHODS = [
  'cash', 'bank_transfer', 'check', 'other',
] as const;
export type PartnerExpensePaymentMethod =
  typeof PARTNER_EXPENSE_PAYMENT_METHODS[number];

export const DEFAULT_PARTNER_CATEGORIES = [
  { name: 'إيجار', nameEn: 'Rent', defaultSplitPercent: 50 },
  { name: 'كهرباء', nameEn: 'Electricity', defaultSplitPercent: 15 },
  { name: 'مياه', nameEn: 'Water', defaultSplitPercent: 15 },
  { name: 'إنترنت', nameEn: 'Internet', defaultSplitPercent: 50 },
  { name: 'لوازم مكتبية', nameEn: 'Office Supplies', defaultSplitPercent: 75 },
  { name: 'تنظيف', nameEn: 'Cleaning', defaultSplitPercent: 50 },
  { name: 'صيانة', nameEn: 'Maintenance', defaultSplitPercent: 50 },
  { name: 'أخرى', nameEn: 'Other', defaultSplitPercent: 50 },
] as const;

export const EMAIL_PROVIDERS = ['resend', 'smtp'] as const;
export type EmailProvider = typeof EMAIL_PROVIDERS[number];

export const USER_ROLES = ['owner', 'accountant'] as const;

// ---- Payroll ----
export const EMPLOYEE_ROLES = [
  'Owner', 'Web Developer', 'QA Engineer', 'Mobile Developer',
  'UI/UX Designer', 'Project Manager', 'DevOps Engineer',
  'Content Writer', 'Marketing', 'Sales', 'Support', 'Intern', 'Other',
] as const;
export type EmployeeRole = typeof EMPLOYEE_ROLES[number];

export const PAYROLL_RUN_STATUSES = ['draft', 'finalized', 'paid'] as const;
export type PayrollRunStatus = typeof PAYROLL_RUN_STATUSES[number];

export const PAYROLL_PAYMENT_STATUSES = ['pending', 'paid', 'on_hold'] as const;
export type PayrollPaymentStatus = typeof PAYROLL_PAYMENT_STATUSES[number];

export const SSK_EMPLOYEE_RATE = 7.5;
export const SSK_EMPLOYER_RATE = 14.25;
export const SSK_SALARY_CAP = 3000; // Jordanian SSK max insurable salary (JOD/month)
export const STANDARD_WORKING_DAYS = 26;
export const WEEKDAY_OT_MULTIPLIER = 1.25;
export const WEEKEND_OT_MULTIPLIER = 1.5;
export type UserRole = typeof USER_ROLES[number];

// ---- Email Templates ----
export const EMAIL_TEMPLATE_TYPES = ['invoice', 'quote', 'reminder'] as const;
export type EmailTemplateType = typeof EMAIL_TEMPLATE_TYPES[number];

export const EMAIL_TEMPLATE_VARIABLES: Record<
  EmailTemplateType, readonly string[]
> = {
  invoice: [
    'invoiceNumber', 'businessName', 'clientName',
    'total', 'currency', 'dueDate',
  ],
  quote: [
    'quoteNumber', 'businessName', 'clientName',
    'total', 'currency', 'expiryDate',
  ],
  reminder: [
    'invoiceNumber', 'businessName', 'clientName',
    'total', 'currency', 'dueDate', 'daysOverdue',
  ],
} as const;

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled',
  'written_off',
] as const;

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
] as const;

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'credit_card',
  'check',
  'paypal',
  'other',
] as const;

export const BANK_ACCOUNT_PROVIDERS = [
  'manual',
  'paypal',
  'bank_al_etihad',
] as const;
export type BankAccountProvider = typeof BANK_ACCOUNT_PROVIDERS[number];

export const RECURRING_FREQUENCIES = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD',
  'JPY', 'CHF', 'SAR', 'AED', 'JOD',
] as const;

export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export type QuoteStatus = typeof QUOTE_STATUSES[number];
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type RecurringFrequency = typeof RECURRING_FREQUENCIES[number];
export type Currency = typeof CURRENCIES[number];

export const TRANSACTION_TYPES = ['income', 'expense'] as const;

export const TRANSACTION_CATEGORIES = [
  'office_supplies', 'rent', 'utilities', 'software', 'travel',
  'meals', 'salary', 'marketing', 'insurance', 'professional_services',
  'equipment', 'shipping', 'taxes', 'invoice_payment', 'other',
] as const;

export type TransactionType = typeof TRANSACTION_TYPES[number];
export type TransactionCategory = typeof TRANSACTION_CATEGORIES[number];

// ---- JoFotara E-Invoicing ----
export const JOFOTARA_SUBMISSION_STATUSES = [
  'not_submitted',
  'pending',
  'submitted',
  'failed',
  'validation_error',
] as const;

export const JOFOTARA_INVOICE_TYPES = [
  'income',
  'general_sales',
  'special_sales',
] as const;

export const JOFOTARA_PAYMENT_CODES: Record<
  JofotaraInvoiceType, { cash: string; receivable: string }
> = {
  income: { cash: '011', receivable: '021' },
  general_sales: { cash: '012', receivable: '022' },
  special_sales: { cash: '013', receivable: '023' },
};

export const JOFOTARA_TAX_CATEGORIES = ['S', 'Z', 'O'] as const;

export const JORDAN_CITY_CODES = [
  { code: 'JO-AM', name: 'Amman' },
  { code: 'JO-IR', name: 'Irbid' },
  { code: 'JO-AZ', name: 'Zarqa' },
  { code: 'JO-BA', name: 'Balqa' },
  { code: 'JO-MA', name: 'Mafraq' },
  { code: 'JO-KA', name: 'Karak' },
  { code: 'JO-JA', name: 'Jerash' },
  { code: 'JO-AJ', name: 'Ajloun' },
  { code: 'JO-AT', name: 'Tafilah' },
  { code: 'JO-MN', name: "Ma'an" },
  { code: 'JO-MD', name: 'Madaba' },
  { code: 'JO-AQ', name: 'Aqaba' },
] as const;

export type JofotaraSubmissionStatus =
  typeof JOFOTARA_SUBMISSION_STATUSES[number];
export type JofotaraInvoiceType = typeof JOFOTARA_INVOICE_TYPES[number];
export type JofotaraTaxCategory = typeof JOFOTARA_TAX_CATEGORIES[number];

// ---- Tax Compliance (Jordan) ----
export const FILING_STATUSES = ['single', 'married'] as const;
export type FilingStatus = typeof FILING_STATUSES[number];

export const TAX_PERIOD_STATUSES = [
  'not_filed', 'filed', 'overdue',
] as const;
export type TaxPeriodStatus = typeof TAX_PERIOD_STATUSES[number];

export const GST_RATE = 16; // Jordan General Sales Tax %

export const INCOME_TAX_BRACKETS = [
  { min: 0, max: 5000, rate: 5 },
  { min: 5000, max: 10000, rate: 10 },
  { min: 10000, max: 15000, rate: 15 },
  { min: 15000, max: 20000, rate: 20 },
  { min: 20000, max: Infinity, rate: 25 },
] as const;

export const NATIONAL_CONTRIBUTION_THRESHOLD = 200000;
export const NATIONAL_CONTRIBUTION_RATE = 1;
export const PERSONAL_EXEMPTION_DEFAULT = 9000;
export const FAMILY_EXEMPTION_DEFAULT = 9000;
export const MAX_ADDITIONAL_EXEMPTIONS = 3000;

/** Bimonthly periods used for GST filing in Jordan */
export const BIMONTHLY_PERIODS = [
  { label: 'Jan–Feb', startMonth: 0, endMonth: 1 },
  { label: 'Mar–Apr', startMonth: 2, endMonth: 3 },
  { label: 'May–Jun', startMonth: 4, endMonth: 5 },
  { label: 'Jul–Aug', startMonth: 6, endMonth: 7 },
  { label: 'Sep–Oct', startMonth: 8, endMonth: 9 },
  { label: 'Nov–Dec', startMonth: 10, endMonth: 11 },
] as const;

/**
 * Get bimonthly period dates for a given year and period index (0-5).
 */
export function getBimonthlyPeriod(year: number, periodIndex: number) {
  const period = BIMONTHLY_PERIODS[periodIndex];
  const startDate = new Date(year, period.startMonth, 1);
  const endDate = new Date(year, period.endMonth + 1, 0); // last day
  // Filing deadline: end of month following the period
  const deadlineDate = new Date(year, period.endMonth + 2, 0);
  return {
    ...period,
    year,
    periodIndex,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    deadlineDate: deadlineDate.toISOString().split('T')[0],
  };
}

/**
 * Get the current bimonthly period based on today's date.
 */
export function getCurrentBimonthlyPeriod() {
  const now = new Date();
  const month = now.getMonth();
  const periodIndex = Math.floor(month / 2);
  return getBimonthlyPeriod(now.getFullYear(), periodIndex);
}

/**
 * Get all bimonthly periods for a given year.
 */
export function getYearBimonthlyPeriods(year: number) {
  return BIMONTHLY_PERIODS.map((_, i) => getBimonthlyPeriod(year, i));
}

/**
 * Calculate Jordan income tax from taxable income (after exemptions).
 */
export function calculateIncomeTax(taxableIncome: number) {
  if (taxableIncome <= 0) return { tax: 0, brackets: [], nationalContribution: 0 };

  let remaining = taxableIncome;
  let totalTax = 0;
  const brackets: { range: string; income: number; rate: number; tax: number }[] = [];

  for (const bracket of INCOME_TAX_BRACKETS) {
    if (remaining <= 0) break;
    const width = bracket.max === Infinity
      ? remaining
      : bracket.max - bracket.min;
    const taxable = Math.min(remaining, width);
    const tax = taxable * (bracket.rate / 100);
    totalTax += tax;
    brackets.push({
      range: bracket.max === Infinity
        ? `Over ${bracket.min.toLocaleString()} JOD`
        : `${bracket.min.toLocaleString()} – ${bracket.max.toLocaleString()} JOD`,
      income: taxable,
      rate: bracket.rate,
      tax,
    });
    remaining -= taxable;
  }

  const nationalContribution = taxableIncome > NATIONAL_CONTRIBUTION_THRESHOLD
    ? taxableIncome * (NATIONAL_CONTRIBUTION_RATE / 100)
    : 0;

  return { tax: totalTax, brackets, nationalContribution };
}
