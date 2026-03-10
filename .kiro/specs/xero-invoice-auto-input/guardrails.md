# Guardrails: Xero Invoice Auto-Input System

**Date:** 2026-03-10
**Purpose:** Define permission boundaries, human-in-the-loop gates, audit requirements, operation restrictions, and AI constraints to prevent unauthorized or erroneous actions.

---

## 1. Permission Boundaries

### Role-Based Access

| Role | Read Operations | Write Operations | Admin Operations |
|------|----------------|-----------------|-----------------|
| Staff (SH-001) | View contacts, accounts, tracking options, invoice history, preview | Create DRAFT invoice in Xero, submit form data | None |
| Accountant (SH-002) | View created_invoices audit log, view DRAFT invoices in Xero | None via this system (uses Xero directly to AUTHORISE) | None |
| Admin (SH-003) | All read operations | All write operations | Xero OAuth connect/disconnect, data sync, token management, DB backup |

### API Route Permission Matrix

| API Route | Staff | Admin | Auth Required |
|-----------|-------|-------|---------------|
| GET /api/contacts/search | Yes | Yes | Yes |
| GET /api/accounts | Yes | Yes | Yes |
| GET /api/tracking-categories | Yes | Yes | Yes |
| POST /api/invoices/create | Yes | Yes | Yes |
| GET /api/invoices/history | Yes | Yes | Yes |
| POST /api/xero/connect | No | Yes | Yes |
| POST /api/xero/sync | No | Yes | Yes |
| GET /api/xero/health | No | Yes | Yes |

### Principle of Least Privilege

- Staff cannot access OAuth token management endpoints.
- Staff cannot trigger cache sync (auto-sync via TTL only).
- No role can AUTHORISE invoices from this system (Xero-side only).
- No role can delete audit log records from this system.

---

## 2. Human-in-the-Loop Gates

### Gate 1: Invoice Preview Before Xero Submission (REQ-011, REQ-013)

```
[5-field input] --> [Auto-complete] --> [PREVIEW GATE] --> [Xero DRAFT creation]
                                            |
                                     Staff reviews ALL 15 fields
                                     Staff edits any incorrect fields
                                     Staff clicks "Xeroへ送信" to proceed
```

**Rules:**
- All 15 auto-completed fields must be displayed on a single preview screen (REQ-011).
- Every field must be editable by the staff before submission.
- Incomplete fields (e.g., empty ContactName) must be highlighted in red with warning text (EH-015).
- The "Xeroへ送信" button must be disabled until all MUST fields are populated.
- No automatic submission is permitted. Staff must explicitly click the submit button.
- After submission, display InvoiceID and InvoiceNumber with a link to Xero dashboard (REQ-013 AT-013).

### Gate 2: ContactName Manual Entry When No Match (REQ-004, EH-007)

```
[Project + Unit No input] --> [Fuzzy search] --> Match found?
                                                    |
                                              Yes: Show top 5 candidates
                                              No:  [MANUAL ENTRY GATE]
                                                    |
                                              Staff types ContactName manually
                                              Warning: "一致するコンタクトが見つかりません"
```

**Rules:**
- When zero matches are found, the system must display the warning message from EH-007.
- The system must NOT auto-generate a ContactName.
- The system must NOT create a new Contact in Xero automatically.
- Staff must manually type the ContactName or select from a broader search.
- The manually entered ContactName is passed to Xero as a `Name` string (Xero handles matching/creation on its side).

### Gate 3: TrackingOption Selection When Auto-Detect Fails (REQ-007, EH-011)

```
[Detail input] --> [Pattern matching] --> Match found?
                                            |
                                      Yes: Auto-select TrackingOption1
                                      No:  [MANUAL SELECTION GATE]
                                            |
                                      Dropdown with 28 existing options
                                      Field left empty (staff must select)
                                      No new TrackingOption values created
```

**Rules:**
- When auto-detection fails, TrackingOption1 is left empty (EH-011).
- Staff must select from the 28 existing TrackingOption1 values via dropdown.
- The system must NOT create new TrackingCategory values in Xero.
- Same logic applies to TrackingOption2 (EH-012): dropdown of 25 existing project values.

### Gate 4: Confirmation on Xero Submission Error

```
[Submit to Xero] --> [API Error] --> [ERROR REVIEW GATE]
                                          |
                                    Display Xero error message (EH-017)
                                    Highlight problematic fields
                                    Staff corrects and resubmits
```

**Rules:**
- On HTTP 400: show Xero validation error, highlight fields, allow correction (EH-017).
- On HTTP 429: auto-retry with exponential backoff up to 5 times (EH-018). If all retries fail, show rate limit message.
- On HTTP 401: attempt token refresh (EH-019). If refresh fails, redirect to re-auth.
- Staff is never left without actionable feedback.

---

## 3. Audit Trail Requirements (REQ-014)

### What to Log

Every invoice submission must record the following in the `created_invoices` table:

| Field | Description | Source |
|-------|-------------|--------|
| id | Auto-increment primary key | SQLite |
| invoice_id | Xero InvoiceID (UUID) | Xero API response |
| invoice_number | Xero InvoiceNumber (e.g., JJB26-0001) | Xero API response |
| contact_name | ContactName submitted | Form data |
| total | Invoice total amount (MYR) | Form data |
| reference | INVOICE or DEBIT NOTE | Form data |
| account_code | AccountCode used | Form data |
| tracking_option1 | TrackingOption1 value | Form data |
| tracking_option2 | TrackingOption2 value | Form data |
| created_by | User email from Auth.js session (REQ-SEC-002) | Auth.js session |
| created_at | ISO 8601 timestamp | Server clock |
| status | SUCCESS or ERROR | Xero API response |
| error_message | Xero error details (if status=ERROR) | Xero API response |
| xero_request_payload | Sanitized JSON of the submitted invoice data | Application |

### Audit Log Integrity Rules

- **Append-only:** No DELETE or UPDATE operations on created_invoices at application level (REQ-SEC-009).
- **Retry on failure:** If SQLite write fails, retry once; fallback to stderr logging (REQ-SEC-005).
- **Non-blocking:** Audit log failure must not prevent the Xero invoice creation from being reported as successful (EH-020).
- **Retention:** 7 years per Malaysian Income Tax Act 1967 and Companies Act 2016.

### Who / What / When / Result Format

Every log entry answers:
- **Who:** `created_by` (authenticated user email)
- **What:** `contact_name`, `total`, `reference`, `account_code`, `tracking_option1`, `tracking_option2`, `xero_request_payload`
- **When:** `created_at` (server-side ISO 8601 timestamp)
- **Result:** `status` (SUCCESS/ERROR), `invoice_id`, `invoice_number`, `error_message`

---

## 4. Operation Restrictions

### Forbidden Operations

| Operation | Reason | Enforcement |
|-----------|--------|-------------|
| Create AUTHORISED invoices | Must be DRAFT only; accountant reviews in Xero (ADR-004) | Server-side: always set Status=DRAFT in API payload |
| Auto-create Xero Contacts | Staff must verify contact identity (REQ-004 note) | No POST /Contacts endpoint exposed |
| Auto-create TrackingCategory values | Must use existing 28+25 options only (REQ-007, REQ-008 notes) | No POST /TrackingCategories endpoint exposed |
| Delete audit log records | Audit integrity (REQ-SEC-009) | No DELETE route for created_invoices |
| Specify InvoiceNumber | Xero auto-numbers (ADR-005) | Field omitted from API payload |
| Change Currency from MYR | MYR fixed (REQ-016, ASM-003) | Hardcoded in API payload |
| Change TaxType from Tax Exempt | Tax Exempt fixed (REQ-016, ASM-003) | Hardcoded in API payload |
| Access system without Auth.js session | All routes require authentication (REQ-SEC-004) | Middleware check on every API route |

### Rate Limits

| Limit | Value | Enforcement | Reference |
|-------|-------|-------------|-----------|
| Xero API requests per minute | 50 (of 60 allowed) | p-queue library | REQ-903 |
| Xero API requests per day | 4,500 (of 5,000 allowed) | Daily counter in system_config | REQ-903 |
| Token refresh concurrency | 1 (mutex lock) | TokenManager mutex | REQ-002 EH-004 |
| Contact cache refresh | Once per 60 minutes (TTL) | Cache timestamp check | REQ-004 |
| Account/Tracking cache refresh | Once per 24 hours (TTL) | Cache timestamp check | REQ-005, REQ-007 |
| Max invoice batch size | 50 per request | Server-side validation | CON-005 |

### Retry Policy

| Scenario | Strategy | Max Retries | Reference |
|----------|----------|-------------|-----------|
| HTTP 429 (rate limit) | Exponential backoff: 1s, 2s, 4s, 8s, 16s | 5 | REQ-013 EH-018 |
| HTTP 401 (auth error) | Token refresh then retry | 1 | REQ-013 EH-019 |
| HTTP 400 (validation) | No retry; show error to user | 0 | REQ-013 EH-017 |
| SQLite write failure | Immediate retry | 1 | REQ-SEC-005 |
| Xero API timeout | Retry after 5 seconds | 2 | Best practice |

---

## 5. AI / Automation Constraints

### Absolute Prohibitions

| Constraint | Reason | Enforcement |
|-----------|--------|-------------|
| No auto-creation of Xero Contacts | Contact identity must be verified by staff; wrong contact = wrong billing (REQ-004 note) | POST /Contacts not implemented |
| No auto-creation of TrackingCategory options | Tracking structure is company-defined; unauthorized values corrupt reporting (REQ-007, REQ-008 notes) | POST /TrackingCategories not implemented |
| No auto-AUTHORISE of invoices | Accountant must review DRAFT in Xero before sending to client (ADR-004, NG-007) | Status always set to DRAFT |
| No auto-submission without preview | Staff must review all 15 fields (REQ-011) | UI enforces preview gate |
| No ML model training on Xero data | Xero ToS prohibits using Xero data for AI/ML training | Fuse.js is fuzzy string matching only, not ML |

### Auto-Complete Boundaries

| Field | Auto-Complete Source | Fallback | Staff Override |
|-------|---------------------|----------|---------------|
| ContactName | Xero Contacts cache + invoice_history (Fuse.js) | Manual text input (EH-007) | Always editable |
| AccountCode | invoice_history frequency analysis | Dropdown of all Xero accounts (EH-009) | Always editable |
| Description | invoice_history pattern matching | Use Detail input as-is (EH-010) | Always editable |
| TrackingOption1 | invoice_history pattern matching | Dropdown of 28 options (EH-011) | Always editable |
| TrackingOption2 | Project name direct mapping | Dropdown of 25 options (EH-012) | Always editable |
| Reference | invoice_history pattern (INVOICE/DEBIT NOTE) | Default to INVOICE (EH-013) | Dropdown selection |
| DueDate | Xero Contact payment terms | Same as InvoiceDate (EH-016) | Always editable |

### Confidence and Transparency

- Auto-completed values are suggestions, not final decisions.
- Staff can modify any auto-completed field before submission.
- When auto-complete confidence is low (no match found), the field is left empty or shows a fallback, never a guess.
- The system does not explain its reasoning but clearly indicates when manual input is required (red highlight, warning message).

---

## 6. Guardrail Verification Checklist

| # | Guardrail | Verification Method | Frequency |
|---|-----------|-------------------|-----------|
| 1 | All invoices created as DRAFT | Check created_invoices for any non-DRAFT status | Per deployment |
| 2 | No Contact auto-creation | Verify no POST /Contacts in codebase | Code review |
| 3 | No TrackingCategory auto-creation | Verify no POST /TrackingCategories in codebase | Code review |
| 4 | Auth.js session on all API routes | Middleware test | Per deployment |
| 5 | Audit log records every submission | Integration test: submit invoice, verify log entry | Per deployment |
| 6 | Rate limits enforced | Load test: 60 rapid requests, verify queuing | Phase 1 Week 4 |
| 7 | Preview gate cannot be bypassed | UI test: verify submit button requires preview | Per deployment |
| 8 | ENCRYPTION_KEY validated at startup | Unit test: start with short key, verify rejection | Per deployment |
| 9 | .env.local in .gitignore | Pre-commit hook check | Every commit |
| 10 | SQLite file permissions = 600 | Deployment script check | Per deployment |

---

## Review Log

| Date | Reviewer | Notes |
|------|----------|-------|
| 2026-03-10 | Architect | Initial guardrails document created |
