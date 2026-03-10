# Guardrails: Xero Invoice Auto-Input System

**System**: Xero Invoice Auto-Input (localhost:3000)
**Classification**: Internal — Confidential
**Compliance**: Malaysian PDPA 2010, Income Tax Act 1967
**Threat Model Reference**: threat-model.md (STRIDE analysis, 2026-03-10)
**Review Date**: 2026-03-10

---

## Purpose

This document defines the non-negotiable security and operational boundaries for the Xero Invoice Auto-Input System. Every guardrail listed here maps to one or more identified threats from the STRIDE analysis (threat-model.md) or to a compliance requirement. Developers must not bypass these guardrails without a written Architecture Decision Record (ADR) reviewed by the system owner.

---

## 1. Permission Model

### 1.1 Application Roles

The system defines three roles. All roles authenticate via Auth.js v5 using Xero as the OIDC identity provider. There are no anonymous sessions. Session idle timeout is 30 minutes to address shared office PC risk (REQ-SEC-001).

| Role | Stakeholder ID | Permissions | Auth Method |
|------|---------------|-------------|-------------|
| Staff | SH-001 | Input invoices, view auto-fill suggestions, preview and submit DRAFT invoices to Xero | Auth.js session (Xero OIDC) |
| Accountant | SH-002 | All Staff permissions plus view audit log (created_invoices table) | Auth.js session (Xero OIDC) |
| Admin | SH-003 | All Accountant permissions plus re-authorize Xero OAuth connection, trigger contact/cache sync, view system health dashboard | Auth.js session (Xero OIDC) |

Role assignment is determined by the authenticated user's Xero OIDC email address mapped to a role in the local configuration. Role elevation is not possible at runtime without an Admin updating the configuration and restarting the server.

**Threats addressed**: S-03 (unauthorized access on shared PC), E-01 (privilege bypass to Xero API routes).

### 1.2 API Route Protection

All API routes and Server Actions require a valid Auth.js session. Unauthenticated requests must receive HTTP 401 and must not reach any Xero-facing logic. Auth.js session validation must be the first operation in every route handler and Server Action. Business logic must not execute if the session check fails or returns a role below the required minimum.

| Route / Server Action | Minimum Role | Notes |
|-----------------------|-------------|-------|
| `createInvoiceAction` (Server Action) | Staff | Submits a DRAFT invoice to Xero; session email recorded in audit log |
| `fuzzyMatchAction` (Server Action) | Staff | Returns auto-fill suggestions from 18,860 historical records |
| `GET /api/contacts/search` | Staff | Reads from Xero contacts cache; never creates contacts |
| `GET /api/accounts` | Staff | Returns account codes from Xero settings cache |
| `GET /api/tracking-categories` | Staff | Returns tracking category options from Xero settings cache |
| `GET /api/invoices/history` | Staff | Returns invoice history for suggestion engine |
| `GET /api/audit-log` | Accountant | Returns created_invoices table records |
| `POST /api/xero/reauthorize` | Admin | Initiates Xero OAuth2 authorization code flow |
| `syncContactsCacheAction` (Server Action) | Admin | Triggers contacts and tracking category cache refresh |
| `GET /api/xero/health` | Admin | Returns system health: token validity, rate limit counters, SQLite status |

**Requirement**: REQ-SEC-004.
**Threats addressed**: E-01 (staff bypasses preview to call Xero API directly), S-03 (unauthorized access).

### 1.3 Xero OAuth2 Scopes

The system requests the minimum set of scopes required to fulfill its function. No additional scopes may be added without a documented ADR and re-authorization by the Admin.

| Scope | Purpose | Access Type |
|-------|---------|-------------|
| `openid` | OIDC identity token for Auth.js | Read |
| `profile` | User display name | Read |
| `email` | User email for audit log identity (REQ-SEC-002) | Read |
| `offline_access` | Refresh token for automated token renewal (REQ-002) | Read |
| `accounting.transactions` | Create DRAFT invoices in Xero | Write (DRAFT only) |
| `accounting.contacts` | Read existing contacts for matching | Read |
| `accounting.settings` | Read tracking categories and account codes | Read |

The scope `accounting.invoices` (granular) must replace `accounting.transactions` when made available by Xero, targeted for May 2026 with a hard deadline of September 2027.

**Requirement**: REQ-SEC-007.
**Threat addressed**: E-02 (overly broad OAuth scopes granting more access than needed).

---

## 2. Human-in-the-Loop Gates

These gates are mandatory. They cannot be removed, bypassed, or made optional via configuration flags or feature toggles. Each gate directly mitigates one or more HIGH or MEDIUM threats from the STRIDE analysis.

### Gate 1: Invoice Preview (MANDATORY)

Before any invoice payload is transmitted to the Xero API, the staff member must be presented with a full preview screen displaying every field that will be submitted, including all auto-filled values.

**Rules:**
- The preview must show all fields: ContactName, AccountCode, TrackingOption1, TrackingOption2, Description, Amount, Reference, InvoiceNumber, DueDate, and any other fields included in the Xero API payload.
- All auto-filled fields must be individually editable on the preview screen. Read-only previews are not permitted.
- The submit action (which triggers the Xero API call) must require an explicit, deliberate user interaction (button click). It must not be triggered by keyboard shortcuts, auto-submit timers, or double-click prevention bypasses.
- The Xero API call must not be initiated from the auto-fill suggestion step. The flow is: input fields -> auto-fill suggestions applied -> preview screen -> explicit Submit -> Xero API call.
- Incomplete mandatory fields must be highlighted with a warning before submission is permitted.

**Requirement**: REQ-011.
**Threats addressed**: T-02 (malicious modification of auto-completed fields before submission), E-01 (staff bypasses preview to call Xero API directly).

### Gate 2: DRAFT Status (MANDATORY)

Every invoice created by this system in Xero must have status `DRAFT`. The system must never submit an invoice with status `AUTHORISED`, `SUBMITTED`, or any other status.

**Rules:**
- The Xero API payload must always include `"Status": "DRAFT"`.
- This value must be hardcoded server-side and must not be derived from user input, query parameters, or environment variables.
- If the Xero API returns a response indicating the invoice was not created as DRAFT, the system must treat this as an error, log it, and not surface the invoice as successfully created.
- Accountants review and approve invoices exclusively within the Xero dashboard. This system provides no approval workflow.

**Requirement**: REQ-013.
**Threats addressed**: T-02 (invoice field manipulation before submission), R-02 (unauthorized invoice creation without trace).

### Gate 3: Contact Name Validation (MANDATORY)

The system must never auto-create a new ContactName in Xero. All contact matching operates against the locally cached list of existing Xero contacts.

**Rules:**
- The ContactName field may only be populated with a value that exists in the Xero contacts cache (populated via `accounting.contacts` read scope).
- The auto-fill engine may suggest a ContactName from the contacts cache via fuzzy matching (Fuse.js). It must never suggest a name that does not exist in the cache.
- If no matching contact is found in the cache, the ContactName field must remain empty and the staff member must type the name manually. The manually typed name must be validated against the contacts cache before the invoice payload is assembled. If no match is found, the staff member must be informed and submission must be blocked until a valid match is selected.
- The Xero API call must never include a ContactName that did not exist in Xero prior to submission.

**Requirement**: REQ-007.
**Threats addressed**: T-02 (data integrity of invoice payload), E-01 (unauthorized data creation in Xero).

### Gate 4: Tracking Options from Existing Values Only (MANDATORY)

The system must never auto-create new TrackingOptions in Xero. TrackingOption1 and TrackingOption2 values must only be populated from the locally cached list of existing Xero tracking categories and their options.

**Rules:**
- At server startup and on each sync, the system fetches and caches all existing tracking categories and their options from Xero using the `accounting.settings` scope.
- Auto-fill suggestions for TrackingOption1 and TrackingOption2 must only use values present in this cache.
- If a historical record references a tracking option that no longer exists in Xero, that option must not be suggested.
- The Xero API payload must never include a tracking option name that does not exist in the cache at the time of submission. Server-side validation must enforce this before the API call is made.

**Requirement**: REQ-010.
**Threats addressed**: T-02 (data integrity of invoice payload), E-01 (unauthorized data creation in Xero).

---

## 3. Audit Trail

### 3.1 created_invoices Table Schema

Every invoice submission attempt, successful or failed, must produce a record in the `created_invoices` table. This table is the primary audit trail for compliance with the Malaysian Income Tax Act 1967 and for non-repudiation (threat R-01).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Internal record identifier |
| `xero_invoice_id` | TEXT | Xero-assigned invoice UUID; NULL if submission failed before Xero responded |
| `invoice_number` | TEXT | Invoice number field value at time of submission |
| `contact_name` | TEXT | ContactName field value at time of submission |
| `account_code` | TEXT | AccountCode field value at time of submission |
| `tracking1` | TEXT | TrackingOption1 value at time of submission; NULL if not used |
| `tracking2` | TEXT | TrackingOption2 value at time of submission; NULL if not used |
| `description` | TEXT | Description field value at time of submission |
| `amount` | REAL | Invoice amount at time of submission |
| `reference` | TEXT | Reference field value at time of submission |
| `status` | TEXT | Submission outcome: `DRAFT` (success), `PENDING_XERO` (in-flight), `ERROR` (failed) |
| `submitted_by` | TEXT | Authenticated user's email from Xero OIDC token (Auth.js session) |
| `submitted_at` | TEXT | ISO 8601 UTC timestamp of submission attempt |
| `xero_response` | TEXT | Raw Xero API response body (JSON string); redacted of any credential fields before storage |
| `all_fields_json` | TEXT | Complete JSON snapshot of all fields in the invoice payload at submission time |

**Requirements**: REQ-014, REQ-SEC-002.

### 3.2 What Gets Logged

The following events must always produce a record in `created_invoices` or in the application's structured log (stderr):

| Event | Log Target | Required Fields |
|-------|-----------|----------------|
| Invoice submission initiated (preview confirmed) | `created_invoices` (status: PENDING_XERO) | `submitted_by`, `submitted_at`, `all_fields_json` |
| Xero API returns success | `created_invoices` updated (status: DRAFT) | `xero_invoice_id`, `xero_response` |
| Xero API returns error | `created_invoices` updated (status: ERROR) | `xero_response`, error detail |
| Audit log write failure | stderr (structured JSON log) | Timestamp, `submitted_by`, error message |
| Rate limit approached (>4,000 daily requests) | stderr (structured JSON log) | Current count, timestamp |
| Token refresh failure | stderr (structured JSON log) | Error type only (no token values) |
| Sync triggered | stderr (structured JSON log) | `triggered_by`, timestamp, record counts |

If writing to `created_invoices` fails, the system must retry once. If the retry fails, the event must be written to stderr as a structured JSON log entry. The Xero API call must not be blocked by an audit log write failure (non-blocking audit writes).

**Requirement**: REQ-SEC-005.
**Threats addressed**: R-01 (staff denies creating an invoice), R-03 (audit log write failure), R-04 (audit log deletion).

### 3.3 Retention Policy

- Audit records in `created_invoices` must be retained for a minimum of 7 years from the date of `submitted_at`.
- This retention period is mandated by the Malaysian Income Tax Act 1967 (section on financial records).
- The application layer must provide no `DELETE` or `UPDATE` operations on the `created_invoices` table. The Drizzle ORM schema must not define mutations for this table beyond `INSERT`.
- Purging records after the retention period is an administrative operation performed manually by the Admin directly on the SQLite file, with a full file-level backup taken beforehand.
- The `contacts_cache` table is operational only and is purged on each sync operation. It is not subject to the 7-year retention requirement.

**Requirement**: REQ-SEC-009.
**Threat addressed**: R-04 (audit log records deleted from SQLite).

---

## 4. Data Protection Guardrails

### 4.1 Token Protection

OAuth tokens (access token, refresh token, ID token) are the highest-sensitivity secrets managed by the system. Their compromise would allow an attacker to create, read, and potentially modify financial data in Xero.

**Rules:**
- All OAuth tokens must be encrypted at rest using AES-256-GCM before being written to the `xero_tokens` SQLite table. The GCM authentication tag must be stored and verified on every read to detect tampering (threat T-04).
- The encryption key (`ENCRYPTION_KEY`) must be sourced exclusively from `process.env.ENCRYPTION_KEY`. It must never be hardcoded in source code or committed to git.
- At application startup, the system must validate that `ENCRYPTION_KEY` is present and has a minimum length of 32 bytes (256 bits). If this check fails, the application must refuse to start and must log an error to stderr without revealing the key value.
- OAuth tokens must never be included in any HTTP response body sent to the browser. The xero-node SDK and all token operations must be confined to Server Actions and API Route handlers (server-side only).
- OAuth tokens must never appear in application logs, error messages, or the `xero_response` column of `created_invoices`. Log redaction must be applied before any external write.
- Auth.js stores the session as an encrypted HTTP-only cookie. The session cookie must have `HttpOnly`, `Secure` (when served over HTTPS), and `SameSite=Strict` attributes. The raw session JWT must not be accessible to client-side JavaScript.

**Requirements**: REQ-902, REQ-904, REQ-SEC-010.
**Threats addressed**: I-02 (OAuth tokens leaked to client JS), I-05 (ENCRYPTION_KEY leaked), S-05 (stolen OAuth access token), T-04 (direct SQLite modification).

### 4.2 PII Handling

Contact data (names, email addresses, physical addresses) is sourced from Xero and cached locally solely for the purpose of invoice contact matching. Its use is constrained by Malaysian PDPA 2010, Section 6 (Purpose Limitation Principle).

**Rules:**
- Contact data in the `contacts_cache` table must only be queried for the purpose of matching a ContactName during invoice creation. It must not be used for analytics, reporting, export, or any purpose outside invoice matching.
- The system must not implement any endpoint that exports, lists, or paginates raw contact records to the browser beyond what is necessary to display a dropdown suggestion (top-N fuzzy-matched results for the current input only).
- The `contacts_cache` table must be purged and re-populated on each sync operation. Stale contact data must not be retained indefinitely.
- API responses for contact search must return only the minimum fields required (e.g., ContactName, ContactID). Full contact records including addresses and financial details must not be included in responses.
- No feature may be added that uses contact data for a purpose other than invoice matching without a written PDPA impact assessment reviewed by the system owner.

**Compliance**: PDPA 2010 S.6 (Purpose Limitation).
**Threats addressed**: I-01 (contact PII exposed in browser dev tools), I-04 (SQLite file copied exposing PII).

### 4.3 Environment Variable Protection

| Variable | Sensitivity | Rules |
|----------|------------|-------|
| `ENCRYPTION_KEY` | Critical | Minimum 32 bytes, generated via `openssl rand -hex 32`, never committed to git, validated at startup (REQ-SEC-010) |
| `XERO_CLIENT_ID` | High | Xero application client ID, never logged, never sent to browser |
| `XERO_CLIENT_SECRET` | Critical | Xero application client secret, never logged, never sent to browser |
| `NEXTAUTH_SECRET` | Critical | Auth.js session encryption key, never logged |
| `NEXTAUTH_URL` | Low | Must be `http://localhost:3000` for this deployment |

**Rules:**
- `.env.local` must be listed in `.gitignore`. This must be verified before every git commit and enforced by a pre-commit hook where possible.
- No secret value may appear in source code, comments, test fixtures, or log output.
- If a secret is accidentally committed to git, the secret must be rotated immediately. Removing the commit from git history is insufficient on its own; the secret is considered compromised from the moment of the first push.

**Requirement**: REQ-904.
**Threat addressed**: I-05 (ENCRYPTION_KEY leaked from .env.local).

---

## 5. Operational Guardrails

### 5.1 Rate Limiting

The system must not exhaust the Xero API rate limits, as doing so would prevent invoice creation for the remainder of the rate limit window — a HIGH risk (threat D-02).

**Per-minute limit:**
- Xero enforces a hard limit of 60 requests per minute per tenant.
- The system's internal rate limiter (p-queue) must cap outbound Xero API calls at 50 requests per minute, providing a 10-request safety buffer.
- If the internal counter reaches 50 requests within a 60-second window, additional requests must be queued (not rejected) and processed in the next window.

**Daily limit:**
- Xero enforces a hard daily limit of 5,000 requests per tenant.
- The system must stop initiating new Xero API calls when the daily counter reaches 4,500 requests, providing a 500-request safety buffer.
- When the 4,500 daily threshold is reached, the system must display a clear error message to the user and log the event to stderr. No further Xero API calls may be made until the daily counter resets (midnight UTC).

**Retry policy on HTTP 429:**
- On receiving HTTP 429 (Too Many Requests) from Xero, the system must apply exponential backoff before retrying.
- Backoff schedule: 1s, 2s, 4s, 8s, 16s (maximum 5 retries).
- After 5 retries without success, the request must fail with an error message to the user. The audit log must record the failure with status `ERROR`.

**Requirement**: REQ-903.
**Threat addressed**: D-02 (Xero API rate limit exhaustion).

### 5.2 Error Budget Policy

The error budget is defined in the SLO document. The following development policy applies based on current error budget consumption:

| Status | Error Budget Consumed | Policy |
|--------|----------------------|--------|
| GREEN | 0% to 50% | Normal feature development and deployments permitted |
| YELLOW | 51% to 99% | New feature development paused; only reliability and bug fixes permitted |
| RED | 100% or above | All development stops; all effort directed to reliability restoration; no deployments until budget recovers below 50% |

The Admin is responsible for monitoring the error budget status via the `/api/xero/health` endpoint and communicating the current status to the development team.

### 5.3 Deployment Guardrails

Because this system directly creates financial records in a live Xero tenant, the following deployment controls are mandatory.

**No auto-deploy to production.** All deployments require a human decision. CI/CD pipelines must not push directly to the production environment.

**Manual smoke test before production use.** After every deployment, the following smoke tests must be completed and confirmed before the system is made available to staff:
1. Auth.js login flow completes successfully (Xero OIDC).
2. Contact search returns results from cache.
3. Invoice preview screen renders all fields correctly.
4. A test invoice is submitted to Xero as DRAFT and verified in the Xero dashboard.
5. The test invoice appears in the `created_invoices` audit log with the correct `submitted_by` email.

**SQLite backup before schema migration.** Before any Drizzle ORM migration is applied to the production SQLite database, a full file-level backup of the SQLite database must be created and stored in a separate location. The backup file name must include the date and the migration identifier (e.g., `invoice_db_backup_20260310_before_migration_0003.db`).

**SQLite file permissions.** The SQLite database file must have OS-level permissions set to `600` (owner read/write only). This must be verified after each deployment.

**Node.js process user.** The Node.js server process must run under a dedicated non-administrator user account. It must not be run as root, SYSTEM, or any account with elevated OS privileges. This limits the blast radius of a process compromise (REQ-SEC-011).

**Requirements**: REQ-SEC-008, REQ-SEC-011.
**Threats addressed**: S-06 (SQLite file replacement), T-04 (direct SQLite modification), D-04 (SQLite corruption), R-04 (audit log deletion), E-03 (excessive OS permissions).

---

## 6. Prohibited Actions (System MUST NOT)

The following actions are absolutely prohibited. No business requirement, feature request, or deadline justifies bypassing these prohibitions. Each item maps to a critical security control or a HIGH/MEDIUM risk threat from the STRIDE analysis.

| # | Prohibited Action | Threat Mitigated | Requirement |
|---|-------------------|-----------------|-------------|
| P-01 | Auto-create new ContactNames in Xero | T-02, unauthorized data creation in external financial system | REQ-007, Gate 3 |
| P-02 | Auto-create new TrackingOptions in Xero | T-02, unauthorized alteration of Xero reporting structure | REQ-010, Gate 4 |
| P-03 | Submit invoices to Xero with any status other than `DRAFT` | T-02, R-02, financial record integrity | REQ-013, Gate 2 |
| P-04 | Store OAuth tokens in client-side storage (localStorage, sessionStorage, non-HttpOnly cookies, or JavaScript variables) | I-02, token theft via XSS | REQ-904, Section 4.1 |
| P-05 | Log full OAuth token values, client secrets, or the ENCRYPTION_KEY to any output (stdout, stderr, files, or error messages) | I-03, I-05, credential leakage | REQ-904, REQ-SEC-006 |
| P-06 | Commit `.env.local` or any file containing secret values to git | I-05, credential exposure | REQ-904, Section 4.3 |
| P-07 | Allow any Xero-facing API route or Server Action to execute without first validating an Auth.js session of sufficient role | E-01, unauthorized Xero operations | REQ-SEC-004, Section 1.2 |
| P-08 | Provide a `DELETE` or `UPDATE` operation on the `created_invoices` table from the application layer | R-04, audit log tampering, compliance violation | REQ-SEC-009, Section 3.3 |
| P-09 | Request OAuth scopes beyond those listed in Section 1.3 without a documented ADR and Admin re-authorization | E-02, excessive privilege in Xero tenant | REQ-SEC-007, Section 1.3 |
| P-10 | Expose raw contact records beyond top-N fuzzy match suggestions to the browser | I-01, I-04, PDPA Purpose Limitation violation | PDPA S.6, Section 4.2 |

If any of these prohibited actions is discovered in a code review, pull request, or production incident, it must be treated as a CRITICAL defect and remediated before any further deployments are made.

---

## 7. Security Requirements Traceability

The following table maps all security requirements from the STRIDE analysis (threat-model.md, Section 5) to the guardrail sections that implement them.

| Requirement ID | Description | Guardrail Section |
|---------------|-------------|-------------------|
| REQ-SEC-001 | Session idle timeout of 30 minutes | Section 1.1 |
| REQ-SEC-002 | Audit log includes Xero OIDC email per submission | Section 3.1, Section 3.2 |
| REQ-SEC-003 | Sanitize API responses; disable verbose errors in production | Section 4.2 |
| REQ-SEC-004 | Auth.js session validation on all Xero-facing API routes | Section 1.2, Section 6 (P-07) |
| REQ-SEC-005 | Audit log write retry plus stderr fallback | Section 3.2 |
| REQ-SEC-006 | Structured logging with field allowlist; redact tokens before logging | Section 4.1, Section 6 (P-05) |
| REQ-SEC-007 | Migrate to granular OAuth scopes by September 2027 | Section 1.3, Section 6 (P-09) |
| REQ-SEC-008 | SQLite file permissions set to 600 | Section 5.3 |
| REQ-SEC-009 | Append-only audit log at application layer (no DELETE/UPDATE) | Section 3.3, Section 6 (P-08) |
| REQ-SEC-010 | Validate ENCRYPTION_KEY entropy at startup (min 32 bytes) | Section 4.1 |
| REQ-SEC-011 | Run Node.js process under dedicated non-admin user account | Section 5.3 |
| REQ-902 | AES-256-GCM encryption for all OAuth tokens at rest | Section 4.1 |
| REQ-903 | Rate limit compliance (50 req/min cap, 4,500 req/day cap) | Section 5.1 |
| REQ-904 | Credential protection: no client-side exposure, no log output | Section 4.1, Section 4.3, Section 6 |

---

## Review Log

| Date | Reviewer | Notes |
|------|----------|-------|
| 2026-03-10 | Security Architect | Full rewrite. Derived from threat-model.md STRIDE analysis. All HIGH and MEDIUM threats addressed. Supersedes prior draft. |
