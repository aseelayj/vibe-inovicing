# Business Flow Gaps Analysis

A detailed audit of business logic gaps in the Vibe Invoicing platform. Each gap identifies where existing code allows invalid operations, produces incorrect calculations, or fails to enforce business rules that a financial application requires.

---

## Table of Contents

1. [Invoice Lifecycle](#1-invoice-lifecycle)
2. [Payment Recording](#2-payment-recording)
3. [Quote-to-Invoice Conversion](#3-quote-to-invoice-conversion)
4. [Recurring Invoices](#4-recurring-invoices)
5. [Tax Calculations](#5-tax-calculations)
6. [Credit Notes](#6-credit-notes)
7. [Client Management](#7-client-management)
8. [Payroll](#8-payroll)
9. [Transaction & Accounting Integrity](#9-transaction--accounting-integrity)
10. [Reporting & Dashboard](#10-reporting--dashboard)
11. [Concurrency & Data Integrity](#11-concurrency--data-integrity)
12. [Client-Side Flow Gaps](#12-client-side-flow-gaps)

---

## 1. Invoice Lifecycle

### 1.1 Paid invoices can be freely edited

**File:** `server/src/routes/invoice.routes.ts:626-631`

The PUT (update) endpoint only blocks editing of `written_off` invoices. Invoices with status `paid` or `partially_paid` can be modified — including their line items, totals, tax rate, and discount amount.

```typescript
if (existing.status === 'written_off') {
  throw Object.assign(new Error('Cannot edit a written-off invoice'), { status: 400 });
}
// No check for 'paid' or 'partially_paid'
```

**Impact:** After a payment is recorded and the invoice is marked paid, a user can change the invoice total. This means `amountPaid` and `total` go out of sync, financial reports become inaccurate, and the audit trail does not reflect what was actually invoiced at the time of payment.

**Fix:** Block editing for `paid`, `partially_paid`, and `sent` invoices (or require a credit note workflow for post-send corrections).

### 1.2 Invoice deletion does not clean up payments or bank transactions

**File:** `server/src/routes/invoice.routes.ts:710-737`

Invoices can be deleted at any status. The delete endpoint does not:
- Check if the invoice has associated payments
- Delete or reverse corresponding bank transactions
- Reverse bank account balance adjustments

```typescript
const [deleted] = await db.delete(invoices)
  .where(eq(invoices.id, id))
  .returning();
```

**Impact:** Deleting a paid invoice orphans payment records (they reference a non-existent `invoiceId`). If payments created bank transactions, those transactions remain, causing the bank balance to be permanently overstated.

**Fix:** Either block deletion of invoices with payments, cascade-delete related payments and reverse bank transactions, or use soft-delete.

### 1.3 Status transition allows marking as "paid" without any payment recorded

**File:** `server/src/routes/invoice.routes.ts:830-836`

The status transition map allows `sent -> paid` via the PATCH status endpoint, but it does not verify that any payment has actually been recorded. A user can manually set an invoice to "paid" without recording a payment, which means `amountPaid` stays at "0.00" while status is "paid".

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  sent: ['paid', 'partially_paid', 'overdue', 'cancelled'],
  // ...
};
```

**Impact:** Dashboard revenue metrics and aging reports will count the invoice as settled, but no payment exists. The P&L report (which sums payments, not invoice totals) will undercount revenue.

**Fix:** When transitioning to `paid` via the status endpoint, either require `amountPaid >= total` or auto-record a payment.

### 1.4 No restriction on duplicating written-off or cancelled invoices

**File:** `server/src/routes/invoice.routes.ts:739-817`

The duplicate endpoint creates a copy of any invoice regardless of its status. Written-off and cancelled invoices can be duplicated. The duplicate copies financial totals from the original (including discount, tax) but resets to `draft` without re-validating that the client or tax rates still exist.

**Impact:** Confusing audit trail; users may accidentally duplicate invoices that were intentionally voided.

---

## 2. Payment Recording

### 2.1 No overpayment validation

**File:** `server/src/routes/payment.routes.ts:117-199`

When creating a payment, there is no check that `amount <= (invoice.total - invoice.amountPaid)`. Any amount can be recorded against any invoice.

```typescript
const [payment] = await tx.insert(payments).values({
  invoiceId,
  amount: String(amount), // No validation against remaining balance
  ...
}).returning();
```

**Impact:** A $100 invoice can receive a $10,000 payment. The `recalculateInvoicePayments` function will mark it as `paid` (since `totalPaid >= invoiceTotal`), but the overpayment amount has no formal credit note or client credit tracking. While a `/client/:id/credit` endpoint exists to calculate overpayment totals, there is no mechanism to apply credits to future invoices.

**Fix:** Warn or block overpayments, or create an explicit client credit record when `payment > remaining`.

### 2.2 Payment deletion matches bank transactions by value, not by ID

**File:** `server/src/routes/payment.routes.ts:225-234`

When deleting a payment, the corresponding bank transaction is found by matching on `bankAccountId`, `category`, `amount`, and `date` — not by a direct foreign key.

```typescript
await tx.delete(transactions).where(
  and(
    eq(transactions.bankAccountId, payment.bankAccountId),
    eq(transactions.category, 'invoice_payment'),
    eq(transactions.amount, payment.amount),
    eq(transactions.date, payment.paymentDate),
  ),
);
```

**Impact:** If two payments have the same amount, date, and bank account, deleting one payment may delete the wrong transaction (or both). String-based amount comparison can also fail due to decimal formatting differences (e.g., "100" vs "100.00").

**Fix:** Store `paymentId` on the transaction record (or transaction ID on the payment) for a direct link.

### 2.3 Draft invoices block payments but `sent` does not require actual sending

**File:** `server/src/routes/payment.routes.ts:134-139`

Payments are blocked for `draft`, `cancelled`, and `written_off` statuses. However, an invoice can be manually moved to `sent` status without ever emailing it, and payments can then be recorded. This is a minor gap — the real issue is that the system treats the status transition as the source of truth, not the actual email delivery.

---

## 3. Quote-to-Invoice Conversion

### 3.1 Expired quotes can be converted

**File:** `server/src/routes/quote.routes.ts:529-548`

The conversion endpoint checks if the quote is already `converted` but does not check the `expiryDate` field. A quote that expired months ago with outdated pricing can still be converted to an invoice.

```typescript
if (quote.status === 'converted') {
  res.status(400).json({ error: 'Quote has already been converted' });
  return;
}
// No check: quote.expiryDate < today
```

**Impact:** Invoices may be created with stale pricing.

**Fix:** Add expiry check: if `quote.expiryDate && new Date(quote.expiryDate) < today`, block or warn.

### 3.2 Tax rate is overridden during conversion, not carried from quote

**File:** `server/src/routes/quote.routes.ts:550-566`

The conversion uses the `isTaxable` flag from the request body (not the quote) and fetches the current system default tax rate. If the quote was originally created with a 10% tax rate but the system default has since changed to 16%, the invoice will use 16%.

```typescript
const isTaxable = req.body?.isTaxable === true;
const taxRate = isTaxable
  ? (settingsRow?.defaultTaxRate ? parseFloat(String(settingsRow.defaultTaxRate)) : 16)
  : 0;
```

**Impact:** Invoice totals differ from what the client accepted on the quote.

**Fix:** Use the quote's original `taxRate` unless the user explicitly overrides it.

### 3.3 Rejected quotes can be converted

**File:** `server/src/routes/quote.routes.ts:545-548`

The only blocked status is `converted`. A quote with status `rejected` or `expired` can still be converted to an invoice.

**Impact:** An invoice may be created from a quote the client already rejected.

**Fix:** Block conversion for `rejected` and `expired` statuses, or require explicit confirmation.

---

## 4. Recurring Invoices

### 4.1 Tax calculated on full subtotal, ignoring discounts

**File:** `server/src/services/recurring.service.ts:113-115`

```typescript
const subtotalNum = parseFloat(recurring.subtotal);
const taxAmountNum = subtotalNum * (taxRate / 100);
const totalNum = subtotalNum + taxAmountNum;
```

Compare to the standard invoice calculation at `invoice.routes.ts:45`:
```typescript
const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
```

Recurring invoices do not store or apply `discountAmount`. Tax is calculated on the full subtotal rather than `(subtotal - discount)`.

**Impact:** Every auto-generated invoice from a recurring template with a discount will have an incorrect (overstated) tax amount and total.

**Fix:** Add `discountAmount` to the recurring invoice schema and use it in the tax calculation.

### 4.2 No idempotency guard against duplicate generation

**File:** `server/src/services/recurring.service.ts:43-55`

If the cron job runs twice on the same day (server restart, overlapping execution), the same recurring invoice will generate two invoices because `nextRunDate` is only updated inside the transaction. Two overlapping executions could both read `nextRunDate <= today` before either commits.

```typescript
const dueRecurrings = await db.select().from(recurringInvoices)
  .where(and(
    eq(recurringInvoices.isActive, true),
    lte(recurringInvoices.nextRunDate, today),
  ));
```

**Impact:** Duplicate invoices with different invoice numbers for the same recurring template on the same day.

**Fix:** Add a `lastRunDate` check: skip if `lastRunDate === today`. Or use a database lock/advisory lock on the recurring invoice row.

### 4.3 End-date boundary can produce one extra invoice

**File:** `server/src/services/recurring.service.ts:59-68, 165-171`

The pre-check (line 59-68) skips if `nextRunDate > endDate`. But the post-creation check (line 165-171) deactivates if the *next* run would be after `endDate`. This means an invoice is created on the exact `endDate`, and then the recurring is deactivated because the next run would exceed it. This is correct behavior. However, if `nextRunDate === endDate` and the end date is meant to be exclusive (i.e., "stop before this date"), one extra invoice gets created.

**Impact:** Ambiguous end-date semantics — depending on user expectation, may produce an unwanted final invoice.

### 4.4 Auto-send failure is silently swallowed

**File:** `server/src/services/recurring.service.ts:301-306`

When `autoSend` is enabled but the email fails, the error is logged to console but no retry, notification, or status flag is set. The invoice is created and `nextRunDate` advances, but the invoice remains in `draft` status with no indication that sending was attempted and failed.

```typescript
} catch (sendErr) {
  console.error(`[Recurring] Invoice created but auto-send failed...`, sendErr);
}
```

**Impact:** Users expect auto-sent invoices to be delivered. A transient email failure means the invoice is never sent and the user is never notified.

**Fix:** Set a `sendFailed` flag or retry mechanism. At minimum, create an activity log entry noting the failure.

---

## 5. Tax Calculations

### 5.1 Inconsistent tax formula across code paths

Tax is calculated differently in at least three places:

| Location | Formula |
|---|---|
| `invoice.routes.ts:45` | `(subtotal - discountAmount) * (taxRate / 100)` |
| `quote.routes.ts:565` | `(subtotal - discountAmt) * (taxRate / 100)` |
| `recurring.service.ts:114` | `subtotal * (taxRate / 100)` — **no discount** |

**Impact:** Auto-generated recurring invoices compute tax differently than manually created ones.

### 5.2 Tax on negative amounts not validated

No code path prevents creating an invoice where `discountAmount > subtotal`, producing a negative taxable base. The tax calculation would yield a negative tax amount, and the total could be negative.

```typescript
const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
// If discountAmount > subtotal, taxAmount is negative
```

**Impact:** Negative invoices have no business meaning without a credit note workflow.

**Fix:** Validate `discountAmount <= subtotal`.

### 5.3 Sales tax report does not exclude credit notes

**File:** `server/src/routes/report.routes.ts:72-79`

The sales tax report filters out `draft`, `cancelled`, and `written_off` invoices but does not filter out credit notes (`isCreditNote = true`). Credit notes stored as invoices will inflate the reported sales and output tax.

```typescript
sql`${invoices.status} NOT IN ('draft', 'cancelled', 'written_off')`,
// Missing: AND is_credit_note = false
```

**Impact:** Tax reports overstate both sales revenue and tax liability.

**Fix:** Add `eq(invoices.isCreditNote, false)` to the report query, or subtract credit note amounts.

---

## 6. Credit Notes

### 6.1 Credit note copies totals blindly from original invoice

**File:** `server/src/routes/invoice.routes.ts:1470-1489`

The credit note copies `subtotal`, `taxAmount`, `total`, `taxRate`, and `discountAmount` directly from the original invoice. There is no option to create a partial credit note (e.g., crediting only 1 of 5 line items).

**Impact:** Every credit note is a full reversal. Partial refunds require manual workarounds.

### 6.2 Credit note does not affect the original invoice status or balance

**File:** `server/src/routes/invoice.routes.ts:1452-1514`

Creating a credit note does not update the original invoice's `amountPaid`, status, or any linked field. The credit note exists as an independent invoice record. There is no automatic reconciliation.

**Impact:** The original invoice still shows as `paid` even after a full credit note is issued. Client statements and aging reports do not reflect the credit.

**Fix:** Link credit notes to original invoices in balance calculations. Reduce `amountPaid` or add a `creditedAmount` field.

### 6.3 Multiple credit notes can be created for the same invoice

There is no check preventing multiple credit notes for the same `originalInvoiceId`. A user could accidentally create several full credit notes, effectively "refunding" more than the invoice total.

**Impact:** Over-crediting without limit.

**Fix:** Track total credited amount per invoice and block when it exceeds the original total.

---

## 7. Client Management

### 7.1 Force-deleting a client orphans invoices and quotes

**File:** `server/src/routes/client.routes.ts:150-162`

When `force=true`, the client is hard-deleted. Because `invoices.clientId` uses `onDelete: 'set null'`, all related invoices lose their client reference.

**Impact:**
- Invoices display without a client name
- Client statements become inaccessible
- Payment-by-client reports lose data
- PDF regeneration for orphaned invoices may fail (no client address)
- JoFotara e-invoice submission would fail (requires buyer info)

### 7.2 Recurring invoices cascade-delete with client

**File:** `server/src/db/tables/recurring.ts` — `clientId` uses `onDelete: 'cascade'`

When a client is deleted, all their recurring invoice templates are silently cascade-deleted. No audit trail entry is created for these deletions.

**Impact:** Future auto-generated invoices simply stop, with no notification or log.

### 7.3 No soft-delete / archive mechanism

The entire system uses hard deletes. Deleted clients, invoices, quotes, and payments are permanently removed from the database. For a financial application, this violates basic data retention requirements.

---

## 8. Payroll

### 8.1 Salary reversal creates offsetting transaction instead of deleting original

**File:** `server/src/routes/payroll.routes.ts:816-834`

When a payroll entry's payment status changes from `paid` to something else, the code inserts a new `income` transaction to offset the original `expense` transaction rather than finding and deleting the original.

```typescript
await tx.insert(transactions).values({
  bankAccountId: entry.bankAccountId,
  type: 'income',
  category: 'salary',
  amount: String(netSalary),
  description: `Salary reversal: ${entry.employeeName}`,
});
```

**Impact:**
- The bank transaction list shows both an expense and an offsetting income for the same salary, creating confusing records
- The P&L report double-counts: it adds the original expense and adds the reversal income, which nets correctly but inflates both revenue and expense totals
- No link between the original and reversal transaction

### 8.2 Payroll transactions not linked to payroll entries

**File:** `server/src/routes/payroll.routes.ts:803-811`

The transaction created when marking a payroll entry as paid has no `payrollEntryId` or `payrollRunId` reference. The transactions table schema does not include these fields.

**Impact:** Cannot trace a bank transaction back to which payroll entry or run it belongs to. Audit trail is broken for salary payments.

### 8.3 Mid-month proration uses day-of-month ratio, not working days

**File:** `server/src/routes/payroll.routes.ts:172-182`

When prorating for mid-month termination, the calculation uses `endDate.getDate() / monthEnd.getDate()` — calendar day ratios rather than actual working days. This is a rough approximation that does not account for weekends or holidays.

**Impact:** Terminated employees may be slightly over- or under-paid depending on when weekends fall in the month.

### 8.4 SSK recalculation gap when manually editing payroll entries

When an admin manually updates gross salary or bonus on a payroll entry, the SSK deductions are recalculated. However, if the total SSK-eligible compensation across the year exceeds the SSK salary cap, there is no cross-month validation — only within-entry validation.

**Impact:** An employee could have SSK deducted on amounts above the annual cap if they receive large bonuses in multiple months.

---

## 9. Transaction & Accounting Integrity

### 9.1 No double-entry enforcement

The system has an `accounts` table (chart of accounts) with debit/credit balance tracking, but transactions are single-entry. Creating a payment or expense does not generate corresponding journal entries. The accounts table data is effectively decorative.

**Impact:** The chart of accounts and any GL-based reports will not balance. This is not a true accounting system.

### 9.2 Bank transactions created without unique reference to source

Payment transactions use `category: 'invoice_payment'` and payroll transactions use `category: 'salary'`, but neither stores a direct reference to the source record (payment ID, payroll entry ID).

**Impact:** Reconciliation depends on matching by amount + date + description, which is fragile. Two payments of the same amount on the same day for different invoices cannot be distinguished.

### 9.3 Bank balance calculated by summing all transactions (no journal)

**File:** `server/src/routes/bank-account.routes.ts`

Bank account balance is calculated by: `initialBalance + SUM(income) - SUM(expenses)`. This means any corrupt, duplicate, or orphaned transaction directly affects the displayed balance.

**Impact:** If a transaction is manually edited or a bug creates an extra transaction, the balance drifts permanently with no self-correcting mechanism.

### 9.4 P&L report mixes accrual and cash basis

**File:** `server/src/routes/report.routes.ts:384-537`

Revenue is calculated from `payments.paymentDate` (cash basis), but expenses include both actual transactions AND estimated commitment amounts (accrual basis). This mixes accounting methods.

```typescript
// Revenue: cash basis (when payment received)
const revenueByMonth = ... FROM payments WHERE payment_date >= ...

// Expenses: actual + estimated commitments
const combinedExpenses = totalExpenses + totalCommitmentExpenses + totalPartnerExpenses;
```

**Impact:** The P&L report does not follow a consistent accounting standard. Comparing revenue (cash) to expenses (mixed accrual) produces misleading profit figures.

### 9.5 Commitment expense estimation uses rough month count

**File:** `server/src/routes/report.routes.ts:459-481`

Active commitments are prorated using simple month counts and hardcoded multipliers (`weekly = amount * 4.33`). The calculation does not account for:
- Commitment start date (applies the full period even if the commitment started mid-period)
- Commitment end date
- Actual billing dates

**Impact:** Commitment expenses in the P&L are approximate rather than accurate.

---

## 10. Reporting & Dashboard

### 10.1 Credit notes inflate sales tax reports

As noted in section 5.3, credit notes stored as invoices are included in sales tax totals. The GST summary and sales tax reports both filter only by `status NOT IN ('draft', 'cancelled', 'written_off')` but do not exclude `isCreditNote = true`.

### 10.2 Income tax report uses payment-based revenue but expense-based costs

**File:** `server/src/routes/report.routes.ts:300-356`

Revenue for income tax is `SUM(payments.amount)` while expenses are `SUM(transactions.amount WHERE type='expense')`. This is internally consistent (cash basis), but it does not include commitment expenses or partner expenses that are included in the P&L report. The two reports use different expense definitions.

**Impact:** The income tax report and P&L report show different profit figures for the same period.

### 10.3 Dashboard revenue and expenses may not match reports

The dashboard (`server/src/routes/index.ts`) likely uses a different query than the P&L report. Without a single source of truth for "revenue" and "expenses," different pages can show contradictory numbers.

### 10.4 Client statement does not account for credit notes

**File:** `server/src/routes/client.routes.ts:183-229`

The client statement sums invoices and payments but does not subtract credit note amounts. A client with a $1,000 invoice, a $1,000 payment, and a $1,000 credit note would show a $0 balance instead of a -$1,000 (client is owed) balance.

---

## 11. Concurrency & Data Integrity

### 11.1 Race condition in bank balance recalculation

**File:** `server/src/routes/bank-account.routes.ts`

The `recalculateBalance()` function reads all transactions and computes a new balance. Two concurrent requests modifying different transactions on the same bank account can both read the same snapshot, compute different balances, and the last write wins.

**Impact:** Bank balance becomes incorrect. Neither transaction is wrong individually, but the final balance reflects only one of the two changes.

**Fix:** Use `SELECT ... FOR UPDATE` on the bank account row, or use atomic SQL increments/decrements instead of recalculating.

### 11.2 Recurring invoice generation not protected against concurrent execution

**File:** `server/src/services/recurring.service.ts:43-55`

The cron job fetches all due recurring invoices and processes them sequentially. If the server restarts and the cron fires again before the previous run completes, both runs process the same recurring invoices.

**Fix:** Use a database advisory lock or a `processing` flag on each recurring invoice.

### 11.3 Payment recording and status recalculation are not atomic with balance update

When a payment is created (`payment.routes.ts:151-182`), the following happens in one transaction:
1. Insert payment
2. Recalculate invoice payment status
3. Create bank transaction
4. Update bank balance with `SQL: currentBalance + amount`

Step 4 uses an atomic SQL increment, which is safe. However, if another payment is being created simultaneously for the same invoice, both may set the invoice to `paid` independently (the recalculation in step 2 sums all payments, so both will see the full total). This is actually safe due to the sum-based approach, but it means the `paidAt` timestamp may reflect whichever transaction commits last.

---

## 12. Client-Side Flow Gaps

### 12.1 No date range validation on invoices or quotes

**Files:** `shared/src/validation.ts:58-70, 79-89`

The Zod schemas for both invoices and quotes validate `issueDate` and `dueDate` (or `expiryDate`) as independent `z.string().min(1)` fields. There is no cross-field validation ensuring:
- Invoice `dueDate` is after `issueDate`
- Quote `expiryDate` is after `issueDate`

**Impact:** Users can create an invoice due before its issue date, or a quote that expires before it was created. Aging reports and overdue calculations produce incorrect results.

### 12.2 Invoices can be created without a client

**File:** `shared/src/validation.ts:59` — `clientId: z.number().int().positive().nullable().optional()`

The validation schema allows `clientId` to be null or omitted. The invoice form's `ClientPicker` defaults to null. An invoice with no client cannot be sent, generates a broken PDF (no recipient address), and cannot be submitted to JoFotara.

**Impact:** Orphaned invoices that serve no purpose and break downstream flows.

### 12.3 Discount can exceed subtotal, producing negative totals

**File:** `client/src/components/invoices/invoice-form.tsx:244-260`

The discount input has `min="0"` but no maximum bound. The server-side validation (`shared/src/validation.ts:64`) also only checks `z.number().min(0)`. A user can enter a discount of $10,000 on a $500 invoice, producing a negative total and negative tax amount.

**Impact:** Negative invoice totals have no business meaning without a credit note workflow. Financial reports will undercount revenue.

### 12.4 Future-dated payments accepted without warning

**File:** `client/src/pages/invoice-detail-page.tsx:128-137`

The payment date input defaults to today but accepts any date, including dates years in the future. The server-side validation (`shared/src/validation.ts:97`) does not validate the date range either.

**Impact:** Future-dated payments appear in cash-basis revenue reports before they actually occur, overstating current revenue.

### 12.5 No unsaved changes warning on invoice/quote forms

**Files:** `client/src/pages/invoice-create-page.tsx`, `invoice-edit-page.tsx`, `quote-edit-page.tsx`

None of the form pages use `useBlocker`, `beforeunload`, or any navigation guard. Users can lose extensive form data by accidentally navigating away or closing the tab.

### 12.6 No form auto-save or draft persistence

Invoice and quote forms do not save drafts to localStorage or the server. A browser crash or accidental tab close loses all entered data.

### 12.7 Role-based access not enforced in the UI

**File:** `client/src/app.tsx:40-56`

The `ProtectedRoute` component only checks `isAuthenticated` — it does not check user role. All navigation items, action buttons (delete, settings, team management), and pages are visible to all authenticated users regardless of role. An `accountant` sees the same UI as an `owner`. When server-side role checks reject an action, the user gets an unexpected API error.

**Impact:** Confusing UX where buttons are visible but non-functional for certain roles.

### 12.8 Invoice status update can desync UI and server

**File:** `client/src/pages/invoice-detail-page.tsx:191-202`

When updating invoice status, the code calls the API then invalidates React Query caches. If the API call fails, the `queryClient.invalidateQueries` is never reached but the user already clicked the button. The UI may show a stale status if the component doesn't properly handle the error state.

### 12.9 Payment error handling leaves dialog in unclear state

**File:** `client/src/pages/invoice-detail-page.tsx:171-178`

When payment creation fails, the catch block is `// handled` (via a toast from the hook). However, the dialog stays open with the form data intact. If the user misses the error toast and clicks submit again, a duplicate payment could be recorded.

### 12.10 All routes eagerly loaded

**File:** `client/src/app.tsx:67-100`

All 30+ page components are imported directly — no `React.lazy()` or route-based code splitting. The initial bundle includes every page.

**Impact:** Slow initial load, especially on mobile or slow connections.

---

## Priority Summary

| Severity | Gap | Section |
|----------|-----|---------|
| **CRITICAL** | Paid invoices can be edited, corrupting financial records | 1.1 |
| **CRITICAL** | Tax inconsistency in recurring invoices (discount not applied) | 4.1, 5.1 |
| **CRITICAL** | Credit notes inflate tax reports | 5.3, 10.1 |
| **CRITICAL** | Invoice deletion orphans payments and bank transactions | 1.2 |
| **HIGH** | No overpayment validation on payments | 2.1 |
| **HIGH** | Expired/rejected quotes can be converted to invoices | 3.1, 3.3 |
| **HIGH** | Tax rate overridden during quote conversion | 3.2 |
| **HIGH** | Credit notes don't affect original invoice balance | 6.2 |
| **HIGH** | Multiple credit notes can exceed original invoice total | 6.3 |
| **HIGH** | Force-deleting client orphans invoices | 7.1 |
| **HIGH** | Bank transaction matching by value, not by ID | 2.2 |
| **HIGH** | P&L mixes accrual and cash accounting | 9.4 |
| **HIGH** | Salary reversal creates offsetting transaction | 8.1 |
| **HIGH** | No double-entry accounting enforcement | 9.1 |
| **HIGH** | Discount can exceed subtotal, producing negative totals | 12.3 |
| **HIGH** | No date range validation (due date before issue date) | 12.1 |
| **MEDIUM** | "Paid" status settable without actual payment | 1.3 |
| **MEDIUM** | Recurring invoice not idempotent | 4.2 |
| **MEDIUM** | Auto-send failure silently swallowed | 4.4 |
| **MEDIUM** | No soft-delete/archival for any entity | 7.3 |
| **MEDIUM** | Bank balance race condition | 11.1 |
| **MEDIUM** | Payroll transactions not linked to source | 8.2 |
| **MEDIUM** | Negative tax amounts possible | 5.2 |
| **MEDIUM** | Income tax vs P&L expense definitions differ | 10.2 |
| **MEDIUM** | Invoices can be created without a client | 12.2 |
| **MEDIUM** | Future-dated payments accepted without warning | 12.4 |
| **MEDIUM** | Role-based access not enforced in UI | 12.7 |
| **MEDIUM** | Payment error handling may cause duplicate submissions | 12.9 |
| **LOW** | No unsaved changes warning on forms | 12.5 |
| **LOW** | All routes eagerly loaded | 12.10 |
| **LOW** | Commitment expense estimation is approximate | 9.5 |
| **LOW** | Mid-month payroll proration is rough | 8.3 |

---

*This document covers business logic flow gaps. For feature suggestions and architectural improvements, see `SUGGESTED_IMPROVEMENTS.md`. For code quality issues, see `CODE_REVIEW.md`.*
