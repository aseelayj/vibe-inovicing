# Suggested Missing Features & Improvements

A comprehensive list of missing features, architectural improvements, and enhancements for the Vibe Invoicing platform. This document focuses on **new capabilities and structural improvements** rather than existing bugs (see `CODE_REVIEW.md` for those).

---

## Table of Contents

1. [Testing & Quality Assurance](#1-testing--quality-assurance)
2. [Security Hardening](#2-security-hardening)
3. [Performance & Scalability](#3-performance--scalability)
4. [Invoicing & Billing Features](#4-invoicing--billing-features)
5. [Payment & Financial Features](#5-payment--financial-features)
6. [Client Management](#6-client-management)
7. [Reporting & Analytics](#7-reporting--analytics)
8. [Notifications & Communication](#8-notifications--communication)
9. [User Experience & UI](#9-user-experience--ui)
10. [API & Integration](#10-api--integration)
11. [Developer Experience & Architecture](#11-developer-experience--architecture)
12. [Deployment & Operations](#12-deployment--operations)
13. [Compliance & Audit](#13-compliance--audit)
14. [Multi-Tenancy & Collaboration](#14-multi-tenancy--collaboration)

---

## 1. Testing & Quality Assurance

The application currently has **zero test coverage** — no unit, integration, or end-to-end tests exist. For a financial application handling invoicing, tax calculations, and payroll, this is the single highest-priority gap.

### 1.1 Unit Tests (Highest Priority)

Add unit tests for all financial calculation logic:

- **Invoice total calculations** — subtotal, tax, discount, grand total with rounding
- **Payroll calculations** — gross salary, SSK deductions (7.5% employee / 14.25% employer), overtime rates (1.25x weekday / 1.5x weekend)
- **Tax calculations** — sales tax, income tax brackets, GST return summaries
- **Currency formatting** — multi-currency display, locale-aware formatting
- **Invoice number sequencing** — atomic increment, gap detection, prefix logic
- **Date calculations** — due date computation, aging bucket assignment, recurring schedule next-run
- **Utility functions** — `escapeXml`, `escapeCsv`, `sanitizeHeaderColor`, `formatInvoiceNumber`

**Recommended stack:** Vitest (already Vite-based) + @testing-library/react for component tests.

### 1.2 Integration Tests

Add API-level tests for critical workflows:

- Authentication flow (login, token verification, token expiry)
- Invoice CRUD with line items and payment recording
- Recurring invoice generation cycle
- Payment creation with automatic transaction and balance update
- JoFotara submission lifecycle
- Email sending with template variable replacement
- Settings encryption/decryption round-trip

**Recommended stack:** Supertest + a test database with Drizzle migrations.

### 1.3 End-to-End Tests

Cover the primary user journeys:

- Onboarding: first login, settings configuration, creating first invoice
- Full invoice lifecycle: create draft, send to client, record payment, mark paid
- Quote-to-invoice conversion
- Recurring invoice setup and triggered generation
- Payroll run: create, calculate, finalize, mark paid

**Recommended stack:** Playwright for cross-browser E2E testing.

### 1.4 CI Pipeline

- Add a GitHub Actions workflow for automated testing on PR
- Run lint, type-check, unit tests, and integration tests before merge
- Add test coverage reporting with a minimum threshold (e.g., 80% for `server/src/utils/` and `server/src/services/`)

---

## 2. Security Hardening

Beyond the bugs in CODE_REVIEW.md, these are structural security features that are missing entirely.

### 2.1 Rate Limiting

No rate limiting exists on any endpoint. Add:

- **Login endpoint**: 5 attempts per IP per 15 minutes (with account lockout after 10 failed attempts)
- **API endpoints**: 100 requests per minute per authenticated user
- **Public endpoints** (email tracking): 30 requests per minute per IP
- **File upload endpoints**: 10 uploads per minute

**Recommended:** `express-rate-limit` with a Redis or in-memory store.

### 2.2 CSRF Protection

State-changing endpoints (POST, PATCH, DELETE) have no CSRF protection. Since the frontend and backend are on the same origin in production, implement:

- Double-submit cookie pattern, or
- `SameSite=Strict` cookie-based tokens via `csurf` or a custom middleware

### 2.3 Token Revocation & Refresh Tokens

The current JWT setup has no server-side revocation capability. Implement:

- **Refresh token rotation**: Short-lived access tokens (15 min) + long-lived refresh tokens (30 days) stored in the database
- **Token revocation table**: Allow explicit logout to invalidate all sessions
- **Device/session management UI**: Let users see and revoke active sessions

### 2.4 Password Policy & Multi-Factor Auth

- Enforce minimum password complexity (length, character variety)
- Add optional TOTP-based 2FA (e.g., via `otplib`)
- Add password reset flow (currently impossible — no email-based reset exists)

### 2.5 Audit Trail for Security Events

Log all security-sensitive events to a dedicated table:

- Failed login attempts (with IP address)
- Password changes
- Role changes
- Settings modifications (currently not audited)
- API key rotations
- Session creation and revocation

### 2.6 Content Security Policy (CSP)

CSP is disabled in development and uses Helmet defaults in production. Define an explicit allowlist:

- `script-src 'self'`
- `img-src 'self' data:` (remove reliance on `api.qrserver.com`)
- `connect-src 'self'` plus any external API domains
- `style-src 'self' 'unsafe-inline'` (for Tailwind)

---

## 3. Performance & Scalability

### 3.1 Database Query Optimization

- **Add pagination** to clients (`GET /api/clients`) and payments (`GET /api/payments`) — these currently return unbounded result sets
- **Add database indexes** on frequently filtered columns: `invoices.status`, `invoices.clientId`, `transactions.date`, `transactions.bankAccountId`
- **Use select projections** in list endpoints — many queries fetch all columns when only a subset is needed (e.g., invoice list doesn't need full line items)

### 3.2 Frontend Performance

- **Debounce search inputs** — every keystroke on invoice/client search fires an API request; add 300ms debounce
- **Virtualize long lists** — client and transaction lists render all rows in the DOM; use `@tanstack/react-virtual` for large datasets
- **Lazy-load routes** — all 33 pages are eagerly loaded in `app.tsx`; use `React.lazy()` with route-based code splitting
- **Memoize expensive components** — `InvoicePreview` re-renders on every keystroke via `watch()`; use `useDeferredValue` or debounced `useWatch`
- **Optimize bundle size** — audit with `vite-plugin-visualizer`; libraries like Recharts and date-fns may benefit from tree-shaking or lighter alternatives

### 3.3 Backend Performance

- **Cache SMTP transport** — a new Nodemailer transport is created and verified per email; cache and reuse it
- **Add Puppeteer browser pooling** — the current singleton has a race condition; use a proper pool (e.g., `generic-pool`) with max browser limits
- **Add response caching** for read-heavy endpoints — dashboard metrics, settings, and chart-of-accounts data change infrequently; cache with short TTL
- **Connection pooling** — verify PostgreSQL pool configuration (`pg` pool size, idle timeout) is tuned for expected concurrency

### 3.4 Caching Strategy

- Add Redis (or in-memory cache) for:
  - Dashboard aggregate queries (refresh every 5 min)
  - Settings lookups (refresh on update)
  - Exchange rates (if multi-currency conversion is added)
- Add HTTP cache headers (`Cache-Control`, `ETag`) for static and semi-static responses

---

## 4. Invoicing & Billing Features

### 4.1 Credit Notes / Refunds

There is no formal credit note workflow. When an invoice needs correction or refund:

- Allow creating a credit note linked to the original invoice
- Credit notes should have their own number sequence (e.g., CN-001)
- Credit note amounts should reduce the client's outstanding balance
- JoFotara credit note submission endpoint exists but has no corresponding UI

### 4.2 Partial Invoicing & Deposits

- Support deposit/advance invoices (e.g., 50% upfront, 50% on completion)
- Link deposit invoices to final invoices with automatic balance calculation
- Add a "deposit applied" line item type

### 4.3 Invoice Templates & Customization

- Allow multiple invoice templates (professional, minimal, detailed)
- Customizable invoice colors, fonts, and logo placement
- Custom fields on invoices (purchase order number, project name, etc.)
- Terms and conditions library (save and reuse across invoices)

### 4.4 Batch Operations

- Bulk status change (mark multiple invoices as sent/paid)
- Bulk PDF download (zip archive of selected invoices)
- Bulk email sending with progress indicator
- Batch payment recording across multiple invoices

### 4.5 Late Fees & Interest

- Configure automatic late fee calculation (flat amount or percentage)
- Interest accrual on overdue invoices (simple or compound)
- Late fee line items added automatically on overdue transition

### 4.6 Multi-Currency Invoicing Improvements

- Exchange rate lookup at invoice creation time
- Currency conversion on dashboard totals (currently hardcodes JOD in GST section)
- Realized/unrealized gain/loss tracking when payment currency differs from invoice currency
- Historical exchange rate tracking

### 4.7 Expense Tracking & Receipts

- Upload and attach expense receipts (photos of paper receipts)
- OCR extraction of receipt data (amount, vendor, date)
- Link expenses to specific clients or projects for cost tracking
- Mileage/travel expense tracking

---

## 5. Payment & Financial Features

### 5.1 Online Payment Links

- Generate payment links for invoices (embeddable in emails)
- Integrate Stripe Checkout or PayPal payment buttons
- Auto-record payment when online payment completes (webhook-driven)
- Show "Pay Now" button in invoice emails

### 5.2 Stripe Integration

PayPal integration exists but Stripe is missing. Add:

- Stripe Connect for receiving payments
- Automatic payment reconciliation via Stripe webhooks
- Support for credit card, ACH, and bank transfer payments
- Stripe Dashboard link from transaction records

### 5.3 Bank Reconciliation

The current bank sync fetches transactions but has no reconciliation workflow:

- Match imported bank transactions to recorded payments/expenses
- Suggest matches based on amount, date, and reference
- Allow manual matching and splitting
- Flag unmatched transactions for review
- Reconciliation status tracking (matched, unmatched, excluded)

### 5.4 Multi-Bank Statement Import

- Support CSV/OFX/QIF statement import formats
- Column mapping UI for CSV files
- Duplicate detection during import
- Bank statement period tracking

### 5.5 Financial Dashboard Improvements

- Cash flow forecast (based on outstanding invoices and recurring commitments)
- Accounts payable tracking (not just receivable)
- Budget vs. actual comparison
- Monthly/quarterly financial snapshots

---

## 6. Client Management

### 6.1 Client Portal

- Self-service portal where clients can:
  - View their invoices and statements
  - Download PDFs
  - Make online payments
  - Update their contact information
  - Approve/reject quotes
- Secure access via tokenized links (no registration required)

### 6.2 Client Communication History

- Unified timeline of all interactions per client:
  - Emails sent (invoices, quotes, reminders)
  - Payments received
  - Notes and internal comments
  - Phone call logs
  - Document attachments

### 6.3 Client Groups & Tags

- Tag clients by category (VIP, retail, wholesale, etc.)
- Group-based discount rules or payment terms
- Filter and report by client group
- Custom fields per client (industry, account manager, etc.)

### 6.4 Client Credit Management

- Set credit limits per client
- Warn when new invoice would exceed credit limit
- Credit hold workflow (block invoicing for clients over limit)
- Credit score/rating tracking

### 6.5 Contact Management

- Multiple contacts per client (billing contact, technical contact, etc.)
- Per-contact email preferences
- CC/BCC additional contacts on invoice emails

---

## 7. Reporting & Analytics

### 7.1 Custom Report Builder

- Allow users to create ad-hoc reports with:
  - Selectable dimensions (client, date range, status, currency)
  - Aggregation options (sum, count, average)
  - Chart type selection (bar, line, pie, table)
- Save and schedule custom reports

### 7.2 Export Improvements

- Export any report to PDF (not just Excel)
- Scheduled report email delivery (weekly/monthly)
- CSV export for all data tables
- Data export for accounting software integration (QuickBooks, Xero format)

### 7.3 Missing Reports

- **Revenue by client** — rank clients by total revenue
- **Revenue by product/service** — identify top-selling items
- **Invoice aging trend** — how aging distribution changes over time
- **Collection efficiency** — average days to payment, collection rate
- **Tax liability forecast** — estimate upcoming tax obligations
- **Year-over-year comparison** — revenue, expenses, profit trends
- **Employee cost analysis** — total cost per employee including SSK and benefits

### 7.4 Dashboard Widgets

- Configurable dashboard layout (drag-and-drop widgets)
- KPI goal tracking (e.g., monthly revenue targets)
- Top clients by revenue widget
- Overdue invoice alerts widget
- Quick-action shortcuts (create invoice, record payment)

---

## 8. Notifications & Communication

### 8.1 In-App Notifications

No notification system exists. Add:

- Real-time notifications for:
  - Payment received
  - Invoice overdue
  - Quote accepted/rejected
  - Recurring invoice generated
  - Team member actions (for owners)
- Notification bell icon in the top bar with unread count
- Notification preferences (per-event, per-channel)

### 8.2 Webhook / Event System

- Allow external systems to subscribe to events:
  - `invoice.created`, `invoice.paid`, `invoice.overdue`
  - `payment.received`
  - `client.created`
- Configurable webhook URLs with retry logic
- Event log for debugging integrations

### 8.3 SMS Notifications

- SMS payment reminders for overdue invoices
- SMS notification when payment is received
- Integration with Twilio or similar provider

### 8.4 Automated Follow-Up Sequences

The current auto-reminder is a single overdue notification. Expand to:

- Multi-step reminder sequences (e.g., 3 days before due, on due date, 7 days overdue, 14 days overdue)
- Customizable message per step
- Escalation rules (different tone/urgency per step)
- Stop sequence when payment is received

---

## 9. User Experience & UI

### 9.1 Onboarding Flow

No guided setup exists — new users land on an empty dashboard. Add:

- Step-by-step setup wizard:
  1. Business details and logo
  2. Tax configuration
  3. Invoice numbering preferences
  4. Email provider setup
  5. Create first client
  6. Create first invoice
- Progress indicator showing setup completion
- Contextual help tooltips

### 9.2 Keyboard Shortcuts

- Global shortcuts:
  - `Ctrl+N` / `Cmd+N` — New invoice
  - `Ctrl+K` / `Cmd+K` — Command palette (already has `cmdk` but limited)
  - `Ctrl+S` / `Cmd+S` — Save current form
  - `Ctrl+/` — Open AI chat
- Shortcut cheat sheet (accessible via `?`)

### 9.3 Error Boundary & Offline Support

- **React Error Boundary** — currently missing; an unhandled error crashes to a white screen. Add a graceful fallback UI with retry option.
- **Offline indicator** — show a banner when the network is unavailable
- **Optimistic UI** — show changes immediately and reconcile with server (partially done via React Query, but not for all mutations)
- **Form draft auto-save** — save invoice/quote form state to localStorage to prevent data loss on accidental navigation

### 9.4 Accessibility Improvements

- **Skip navigation link** — missing for keyboard users
- **Focus management** — after closing a dialog, focus should return to the trigger element
- **Color contrast** — audit all color combinations against WCAG 2.1 AA standards
- **Screen reader announcements** — add `aria-live` regions for toast notifications and loading states
- **Reduced motion** — respect `prefers-reduced-motion` for chart animations

### 9.5 Advanced Search & Filters

- Global search across all entities (invoices, clients, transactions)
- Saved filter presets (e.g., "Overdue invoices > $1000")
- Date range picker with presets (this month, last quarter, custom)
- Multi-column sorting on data tables

### 9.6 File Attachment Support

- Attach files to invoices (contracts, supporting documents)
- Attach files to client records
- Drag-and-drop file upload
- File preview (PDF, images) within the application

---

## 10. API & Integration

### 10.1 Public REST API with Documentation

- Formalize a public API for external integrations
- Add OpenAPI/Swagger documentation auto-generated from route definitions
- API key authentication for third-party access (separate from user JWT)
- Rate limiting per API key
- Versioned endpoints (`/api/v1/...`)

### 10.2 Accounting Software Integration

- Export to QuickBooks format (IIF or QBO)
- Export to Xero format (CSV compatible)
- Two-way sync with popular accounting platforms
- Chart of accounts mapping

### 10.3 Zapier / Make Integration

- Provide a Zapier app or webhook triggers so users can:
  - Create invoices from CRM deals
  - Log payments from payment processors
  - Sync clients from external databases
  - Trigger notifications in Slack/Teams

### 10.4 Calendar Integration

- Sync tax deadlines to Google Calendar / Outlook
- Invoice due date reminders as calendar events
- Payroll run schedule calendar integration

---

## 11. Developer Experience & Architecture

### 11.1 Structured Logging

Replace `console.log()` / `console.error()` throughout the codebase with a proper logging library:

- Use **Pino** or **Winston** for structured JSON logging
- Add request correlation IDs (generate UUID per request via middleware)
- Log levels (debug, info, warn, error) configurable via environment
- Include context in all log entries (userId, requestId, endpoint)
- Separate access logs from application logs

### 11.2 Database Migration Workflow

- Add a formal migration history (currently using `drizzle-kit push` which applies changes directly)
- Version-controlled migration files with up/down capability
- Migration status check on startup
- Seed data versioning

### 11.3 Code Organization

- **Decompose large files**:
  - `invoice-detail-page.tsx` (1,360 lines) into hooks and sub-components
  - `schema.ts` (1,000+ lines) into per-domain schema files
  - `types.ts` (65+ interfaces) into domain-grouped type files
- **Service layer on client** — extract API calls from hooks into a service layer for better testability
- **Shared constants** — move hardcoded values (tax rate 16%, due days 30, currency JOD) into `shared/src/constants.ts`

### 11.4 Type Safety Improvements

- Fix `decimal` column types — Drizzle returns strings for `decimal()` columns but shared types declare `number`. Add explicit parsing at the API boundary.
- Add Zod validation schemas for all endpoints (currently missing for quote status, chat messages, JoFotara)
- Generate API client types from the server routes (e.g., via `ts-rest` or `zodios`)

### 11.5 Monorepo Tooling

- Migrate from npm workspaces to **Turborepo** for:
  - Parallel builds with caching
  - Dependency graph-aware task execution
  - Elimination of double-build issue (shared package currently builds twice)
- Add `eslint` and `prettier` with shared config across all workspaces
- Add pre-commit hooks via `husky` + `lint-staged`

---

## 12. Deployment & Operations

### 12.1 Health Check Endpoint

No health check endpoint exists. Add `GET /api/health` returning:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected",
  "uptime": 3600
}
```

Use for Docker health checks, load balancer probes, and uptime monitoring.

### 12.2 Graceful Shutdown

The server has no shutdown handler. Add:

- `SIGTERM` / `SIGINT` signal handlers
- Close database connection pool
- Close Puppeteer browser instances
- Finish in-flight requests before exiting
- Stop cron schedulers

### 12.3 Environment Configuration

- Require `CORS_ORIGIN` in production (currently falls back to allowing all origins)
- Require `ENCRYPTION_KEY` in production (currently falls back to `JWT_SECRET`)
- Add environment validation that blocks startup if critical vars are missing
- Add a `/api/health/config` endpoint (owner-only) that shows which integrations are configured

### 12.4 Backup & Recovery

- Automated database backup schedule (daily with 30-day retention)
- Point-in-time recovery capability
- Backup verification (periodic restore tests)
- Document the recovery procedure

### 12.5 Docker Improvements

- Add non-root `USER` directive in Dockerfile
- Remove PostgreSQL port exposure from `docker-compose.yml`
- Pin `drizzle-kit` version in Dockerfile
- Add Docker health check instruction
- Multi-environment compose files (dev, staging, production)

### 12.6 Monitoring & Alerting

- Application Performance Monitoring (APM) integration
- Error tracking service (Sentry or similar)
- Database query performance monitoring
- Alert on: high error rate, slow response times, database connection issues, disk usage

---

## 13. Compliance & Audit

### 13.1 Data Retention Policies

- Define retention periods for:
  - Invoices and financial records (typically 7+ years for tax compliance)
  - Email logs (configurable, e.g., 2 years)
  - Activity logs (configurable)
  - Chat conversations (configurable)
- Automated archival of records past retention period
- Soft-delete with configurable hard-delete schedule

### 13.2 Data Export (GDPR Compliance)

- "Export my data" feature for client records
- "Right to erasure" workflow — anonymize client data while preserving financial records
- Data processing audit trail
- Privacy policy acknowledgment tracking

### 13.3 Immutable Audit Log

The current `activityLog` table can be modified or deleted. For compliance:

- Make audit log append-only (no UPDATE or DELETE)
- Add cryptographic chaining (each entry includes hash of previous)
- Include IP address and user agent in audit entries
- Add audit log search and export functionality

### 13.4 Document Versioning

- Track all changes to invoices with before/after snapshots
- Prevent editing of sent/paid invoices (currently allowed)
- Require reason for any post-send modification
- Version history viewer in the UI

---

## 14. Multi-Tenancy & Collaboration

### 14.1 Organization / Workspace Support

Currently single-tenant (one business per database). To support multiple businesses:

- Add `organization` table with business details
- Scope all data queries by `organizationId`
- Allow users to belong to multiple organizations
- Organization switcher in the UI

### 14.2 Role-Based Access Control (Expanded)

Currently only two roles: `owner` and `accountant`. Expand to:

- **Owner** — full access, user management, settings
- **Admin** — full access except user management
- **Accountant** — financial data, invoices, payments, reports
- **Sales** — clients, quotes, invoices (no financial reports)
- **Viewer** — read-only access to assigned areas
- Per-entity permissions (e.g., only see own clients)
- Custom role builder

### 14.3 Approval Workflows

- Invoice approval before sending (for team environments)
- Payment approval for amounts over a configurable threshold
- Expense approval workflow
- Quote approval chain
- Configurable approval rules (by amount, by client, by type)

### 14.4 Team Collaboration

- Comments/notes on invoices visible to team members
- @mentions in internal notes
- Assignment of invoices/clients to team members
- Team activity feed with filters

---

## Priority Matrix

| Priority | Category | Items |
|----------|----------|-------|
| **P0 — Critical** | Testing | Unit tests for financial calculations, CI pipeline |
| **P0 — Critical** | Security | Rate limiting, CSRF protection, token refresh |
| **P1 — High** | Performance | Pagination on all endpoints, search debouncing, route code splitting |
| **P1 — High** | Features | Credit notes, online payment links, in-app notifications |
| **P1 — High** | Operations | Health check endpoint, graceful shutdown, structured logging |
| **P1 — High** | UX | Error boundary, onboarding wizard, form auto-save |
| **P2 — Medium** | Features | Client portal, bank reconciliation, batch operations |
| **P2 — Medium** | Reporting | Custom reports, revenue by client, collection efficiency |
| **P2 — Medium** | DevEx | Decompose large files, type safety fixes, monorepo tooling |
| **P2 — Medium** | Compliance | Immutable audit log, data retention, document versioning |
| **P3 — Low** | Features | Multi-tenancy, approval workflows, Zapier integration |
| **P3 — Low** | Features | SMS notifications, calendar sync, expense OCR |
| **P3 — Low** | API | Public API docs, accounting software export, API versioning |

---

*This document complements `CODE_REVIEW.md` which covers existing bugs and code-quality issues. Items here represent net-new capabilities and structural improvements.*
