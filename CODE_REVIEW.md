# Code Review: vibe-invoicing

Comprehensive review of issues, inconsistencies, and recommended improvements.

---

## CRITICAL Issues (Fix Immediately)

### 1. JWT `rememberMe` Logic Is Inverted — Tokens Never Expire

**`server/src/routes/auth.routes.ts:37-40`**

```typescript
const jwtOptions: jwt.SignOptions = rememberMe
  ? {}                    // remember me = NO expiration (forever!)
  : { expiresIn: '90d' }; // don't remember me = 90 days
```

The logic is backwards. Checking "Remember Me" produces a token that **never expires**. Not checking it gives 90 days. This means:
- Leaked "remember me" tokens can never be invalidated
- Users who *don't* want to be remembered get a longer session than expected
- There is no token revocation mechanism at all

**Fix:** Flip the logic. "Remember me" → 30-90 days. Normal session → 1-8 hours.

---

### 2. Tax Rate Is Hardcoded to 16%, User Input Silently Ignored

**`server/src/routes/invoice.routes.ts:208-215`**

```typescript
const {
  taxRate: rawTaxRate = 0,  // ← accepted from user
  isTaxable = false,
  ...invoiceData
} = req.body;

const taxRate = isTaxable ? 16 : 0;  // ← immediately overwritten!
```

The user-supplied `rawTaxRate` is destructured then never used — it's dead code. The hardcoded `16` also appears in:
- `server/src/services/recurring.service.ts:88`
- `client/src/components/invoices/invoice-form.tsx:81, 131`

Meanwhile, `settings.defaultTaxRate` exists in the DB schema specifically for this purpose but is never read.

**Fix:** Use `settings.defaultTaxRate` as the default, allow per-invoice override via `rawTaxRate`.

---

### 3. Secrets Stored as Plaintext in the Database

**`server/src/db/schema.ts:51-74`**

```typescript
jofotaraClientSecret: text('jofotara_client_secret'),
paypalClientSecret: text('paypal_client_secret'),
geminiApiKey: text('gemini_api_key'),
resendApiKey: text('resend_api_key'),
smtpPassword: text('smtp_password'),
```

Plus bank session tokens at lines 356-357:
```typescript
token: text('token').notNull(),
refreshToken: text('refresh_token'),
```

All API keys, passwords, and bank tokens are stored unencrypted. A database backup leak or SQL injection exposes all third-party credentials.

**Fix:** Encrypt at rest using AES-256, or move to a secrets manager.

---

### 4. Unhandled Promise in `/auth/verify` — Requests Can Hang Forever

**`server/src/routes/auth.routes.ts:76-93`**

```typescript
router.post('/verify', (req, res) => {
  try {
    const payload = jwt.verify(...);
    db.select(...)
      .then(([user]) => { res.json(...); });  // no .catch()!
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

The handler is not `async`, so the `try/catch` cannot catch the rejected promise. If the DB query fails, the client hangs until timeout.

**Fix:** Make the handler `async` and `await` the query.

---

## HIGH Severity Issues

### 5. `useAuth` Hook Has No Shared State — Each Consumer Is Independent

**`client/src/hooks/use-auth.ts`**

```typescript
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
```

Every component calling `useAuth()` gets its own `useState`. Logging in from `LoginPage` doesn't update other components' auth state. Each mount fires a separate `/auth/verify` API call.

**Fix:** Wrap auth state in a React Context or use React Query with a shared cache key.

---

### 6. Token Access Pattern Is Inconsistent — Chat and PDF Break for Session Users

**`client/src/lib/api-client.ts:17`** — checks both storages (correct):
```typescript
const token = localStorage.getItem('token') || sessionStorage.getItem('token');
```

**`client/src/hooks/use-chat-stream.ts:171`** — only checks localStorage:
```typescript
const token = localStorage.getItem('token');
```

**`client/src/pages/invoice-detail-page.tsx:370`** — only checks localStorage:
```typescript
const token = localStorage.getItem('token');
```

Users who logged in without "Remember Me" (stored in `sessionStorage`) will get unauthenticated requests in chat streaming and PDF downloads.

**Fix:** Centralize token access in a single utility function.

---

### 7. Puppeteer Browser Singleton Has a Race Condition

**`server/src/services/pdf.service.ts:5-15`**

```typescript
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({ ... });
  }
  return browser;
}
```

Two concurrent PDF requests can both see `browser === null`, both launch a browser, and the first one leaks as an orphaned process.

**Fix:** Use a mutex/promise lock to serialize browser creation.

---

### 8. No Pagination on Clients and Payments Endpoints

**`server/src/routes/client.routes.ts:13-34`** — returns ALL clients, no limit:
```typescript
let query = db.select().from(clients).orderBy(desc(clients.createdAt));
const result = await query;  // unbounded!
```

**`server/src/routes/payment.routes.ts:65-76`** — returns ALL payments with nested data:
```typescript
const result = await db.query.payments.findMany({
  with: { invoice: { with: { client: true } } },
});
```

These will degrade badly as data grows. Invoices have proper pagination; clients and payments do not.

**Fix:** Add `page` and `pageSize` query params, matching the invoice pattern.

---

### 9. Payment Deletion Orphans the Associated Transaction

**`server/src/routes/payment.routes.ts:179-220`**

When a payment is deleted, the bank account balance is reversed, but the auto-created income transaction (created at lines 142-149) is **never deleted**. The financial ledger shows phantom transactions.

**Fix:** Delete the associated transaction record within the same DB transaction.

---

### 10. Duplicated Invoice Gets the Original's (Possibly Past) Due Date

**`server/src/routes/invoice.routes.ts:428-443`**

```typescript
issueDate: new Date().toISOString().split('T')[0],  // today
dueDate: original.dueDate,  // copied from original — could be months ago
```

**Fix:** Calculate `dueDate` as `today + settings.defaultPaymentTerms`.

---

### 11. `InvoicePreview` Re-renders on Every Single Keystroke

**`client/src/components/invoices/invoice-preview.tsx:14`**

```typescript
const values = watch();  // subscribes to ALL form fields
```

Every character typed in any field triggers a full re-render of the preview including all currency formatting and line item calculations.

**Fix:** Use `useWatch` with specific field names, or debounce the preview update.

---

### 12. No Role-Based Access Control on Destructive Operations

**`server/src/routes/invoice.routes.ts:379`**, **`client.routes.ts:113`**, etc.

All authenticated users (including `accountant` role) can delete invoices, clients, and other entities. The `ownerOnly` middleware exists but is never applied to DELETE routes.

**Fix:** Apply `ownerOnly` middleware to all destructive endpoints.

---

## MEDIUM Severity Issues

### 13. CORS Allows Any Origin in Production

**`server/src/index.ts:20-24`**

```typescript
origin: isProduction
  ? (process.env.CORS_ORIGIN || true)  // true = allow ANY origin
  : 'http://localhost:5173',
```

If `CORS_ORIGIN` env var is not set, CORS is effectively disabled in production.

**Fix:** Remove the `|| true` fallback. Require `CORS_ORIGIN` to be set in production.

---

### 14. Error Handler Leaks Internal Details to Clients

**`server/src/middleware/error-handler.ts:20-22`**

```typescript
res.status(500).json({ error: err.message || 'Internal server error' });
```

Raw error messages (potentially containing SQL, file paths, stack traces) are sent to clients.

**Fix:** In production, always return a generic message and log the real error server-side.

---

### 15. No Rate Limiting on Login Endpoint

**`server/src/routes/auth.routes.ts:13-60`** — no rate limiting, no account lockout. Brute-force attacks are trivially easy.

---

### 16. `AUTH_PASSWORD` Defaults to Empty String

**`server/src/env.ts:11`**

```typescript
AUTH_PASSWORD: z.string().default(''),
```

An empty string will be happily hashed by bcrypt, creating an owner account with no password.

**Fix:** Use `z.string().min(1)` or remove the default.

---

### 17. External QR Service Leaks Invoice Data

**`client/src/pages/invoice-detail-page.tsx:841-843`**

```typescript
src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(invoice.jofotaraQrCode)}`}
```

Invoice QR data is sent to a third-party server. Use a local library like `qrcode.react` instead.

---

### 18. New SMTP Transport Created Per Email

**`server/src/services/email.service.ts:31-41`**

A new SMTP connection + `verify()` handshake happens for every email sent. This adds latency and is wasteful.

**Fix:** Cache and reuse the transport, reconnecting only when settings change.

---

### 19. Hardcoded Currency `'JOD'` in Dashboard

**`client/src/pages/dashboard-page.tsx:329,335,342,351`**

```typescript
{formatCurrency(gstSummary.taxableSales, 'JOD')}
```

The GST summary section hardcodes Jordanian Dinar while the rest of the dashboard uses a dynamic `currency` variable (line 78).

---

### 20. No Debouncing on Search Inputs

**`client/src/pages/invoices-page.tsx:309-316`**

Every keystroke fires an API request. Typing "hello" sends 5 requests.

**Fix:** Debounce the search input (300-500ms) or use `useDeferredValue`.

---

### 21. Hardcoded Default Due Date Ignores Settings

**`client/src/components/invoices/invoice-form.tsx:50`**

```typescript
const defaultDue = format(addDays(new Date(), 30), 'yyyy-MM-dd');
```

Hardcoded to 30 days. `settings.defaultPaymentTerms` exists but is unused.

---

### 22. `decimal` DB Columns Return Strings, Types Declare `number`

**`server/src/db/schema.ts`** — all `decimal()` columns (financial amounts, tax rates, etc.)
**`shared/src/types.ts`** — declares these as `number`

Drizzle's `decimal()` returns strings from PostgreSQL. The shared types lie about the runtime type, masking potential `NaN` bugs when arithmetic is done without explicit conversion.

---

### 23. No React Error Boundary

**`client/src/main.tsx`** — no top-level `ErrorBoundary`. Any unhandled error crashes the entire app to a white screen.

---

### 24. Tracking Endpoint Uses Sequential IDs, No Auth

**`server/src/routes/tracking.routes.ts:15-59`** — public endpoint with enumerable integer IDs. Attackers can inflate email open counts.

**Fix:** Use UUIDs or signed tokens instead of sequential IDs.

---

### 25. `invoice-detail-page.tsx` Is 1,360 Lines of Mixed Concerns

This page contains inline PDF download logic (duplicated twice), status change logic, JoFotara workflow state machine, payment recording, overdue calculation, and 13 separate `useState` calls. It should be decomposed into custom hooks and sub-components.

---

### 26. `formatInvoiceNumber` Utility Exists But Is Never Used

**`server/src/utils/invoice-number.ts`** — defines `formatInvoiceNumber(prefix, num)`, but invoice routes and recurring service inline the same logic instead of importing it.

---

### 27. Direct `api.patch` Calls Bypass React Query

**`client/src/pages/invoice-create-page.tsx:29`**, **`invoice-detail-page.tsx:199`**

Status updates use direct `api.patch()` calls instead of React Query mutations, bypassing cache management and the centralized error handling pattern.

---

## LOW Severity Issues

### 28. Project Directory Typo: `vibe-inovicing`

The directory is named `vibe-inovicing` (missing 'i' in invoicing), while `package.json`, Docker configs, and image names all use the correct `vibe-invoicing`. The deploy script's `APP_DIR` also preserves the typo.

### 29. TypeScript Version Mismatch

Client uses `~5.9.3`, root/server use `^5.7.3`. Could cause feature incompatibility or conflicting hoisted versions.

### 30. Zod Version Mismatch

Client uses `^3.25.76`, shared/server use `^3.24.2`. Zod 3.25 had internal breaking changes; dual versions can break schema sharing.

### 31. Docker: PostgreSQL Port Exposed to Host

`docker-compose.yml` maps port `5432:5432` — database is accessible outside the container network.

### 32. Docker: No Non-Root USER in Production Image

The Dockerfile has no `USER` directive. The Node.js process runs as root inside the container.

### 33. Docker: `drizzle-kit` Installed Unpinned with `--no-save`

**`Dockerfile:59`** — `npm install --no-save drizzle-kit` gets whatever latest version, which may break migrations.

### 34. Deploy Script: `git reset --hard` with No Backup

**`deploy.sh:16`** — discards all local changes (including hotfixes) without warning.

### 35. Deploy Script: App Starts Before Migrations Run

**`deploy.sh:26-35`** — `docker run -d` then `docker exec ... drizzle-kit push`. The app serves requests against stale schema during migration.

### 36. Missing Shared Type Fields

`Settings` type is missing `writeOffPrefix`, `nextWriteOffNumber`, `createdAt`, `updatedAt` that exist in DB schema. `ActivityLogEntry` is missing `metadata`.

### 37. `@types/qrcode` in Production Dependencies

**`server/package.json:16`** — `@types/*` belongs in `devDependencies`.

### 38. No Validation Schemas for Quote Status Update, Chat, or JoFotara Submissions

### 39. Hardcoded Locale `'en-US'` in Invoice Form

**`client/src/components/invoices/invoice-form.tsx:97`** — uses `'en-US'` while the shared `formatCurrency` properly uses `getLocale()`. Arabic users see English number formatting in the form.

### 40. Module-Level Mutable Variable in `use-chat-stream.ts`

**`client/src/hooks/use-chat-stream.ts:17`** — `let hadMutationInStream = false;` is shared across all hook instances. Should be `useRef`.

### 41. Client `tsconfig.json` Has No Reference to Shared Package

Server correctly references `../shared`; client does not. Client build relies on shared `dist/` already existing.

### 42. Shared Package Builds Twice

**Root `package.json:14`** — `npm run build --workspace=shared && npm run build --workspaces` builds shared first explicitly, then again as part of `--workspaces`.

---

## Summary

| Severity | Count | Top Priorities |
|----------|-------|----------------|
| **Critical** | 4 | Inverted JWT expiry, hardcoded tax rate ignoring input, plaintext secrets, unhandled promise |
| **High** | 8 | No shared auth state, token inconsistency, browser race condition, no pagination, orphaned transactions |
| **Medium** | 15 | CORS misconfigured, error leak, no rate limiting, empty password default, QR data leak |
| **Low** | 15 | Directory typo, version mismatches, Docker hardening, missing types, dead code |
