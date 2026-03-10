# Runbook: Xero Invoice Auto-Input System

**Service:** Xero Invoice Auto-Input System
**URL:** localhost:3000
**Stack:** Next.js 15, xero-node SDK, SQLite (WAL mode), Auth.js v5
**Version:** 2.0
**Date:** 2026-03-10
**Owner:** Developer (SH-003)
**Review Frequency:** Monthly during Phase 1; quarterly thereafter

---

## 1. Severity Definitions

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|---------|
| SEV-1 | Critical | System completely unusable; invoices cannot be created; data loss possible or active | 15 minutes | Server down (5xx on all routes), SQLite corruption, complete Xero API outage, all invoice submissions failing |
| SEV-2 | High | Core functionality impaired but a manual workaround exists; SLO burn rate is high | 1 hour | Xero access token expired and auto-refresh failing, refresh token expired (re-auth required), rate limit exhausted for the day, Auth.js session loop preventing login |
| SEV-3 | Medium | A specific feature is degraded with minor impact; no data is lost | 4 hours | Fuzzy match returning wrong suggestions, autocomplete P95 latency above 500 ms, build failure after dependency update, wrong invoice type (DEBIT NOTE vs INVOICE) |
| SEV-4 | Low | Cosmetic issue, minor inconvenience, or non-functional monitoring noise | Next business day | UI label mismatch, outdated cached tracking categories, non-critical log noise, documentation error |

### SLO Alignment

Severity ratings align with the SLO error budget burn rates defined in `slo.md`:

| Budget Consumed | Status | SEV Guidance |
|-----------------|--------|--------------|
| 0-50% | GREEN | Normal operations; most issues are SEV-3 or SEV-4 |
| 50-80% | YELLOW | Elevated vigilance; recurring SEV-3 patterns may indicate a latent SEV-2 |
| 80-100% | ORANGE | New feature development paused; treat all failures as SEV-2 or higher |
| 100%+ | RED | All development stopped; declare SEV-1, execute full incident response |

---

## 2. Common Incidents and Response Procedures

---

### INC-001: Xero Access Token Expired During Submission

**Severity:** SEV-2
**Risk Register Reference:** R-01 (HIGH risk — access token expiry during form submission)
**SLO Impact:** Contributes to SLO-005 (Xero API success rate >= 99%)

#### Detection

- Xero API calls return HTTP 401.
- Application logs contain: `401 Unauthorized` from `xero-node` or `lib/xero/xero-service.ts`.
- Prometheus alert `XeroTokenExpired` fires (if metrics endpoint is active).
- Users report "Invoice submission failed" error in the UI.

#### Diagnosis

1. Check the application logs for the 401 response and the endpoint that triggered it.
2. Query the token table to inspect the current token state:
   ```sql
   SELECT id, tenant_id, expires_at, updated_at FROM xero_tokens ORDER BY updated_at DESC LIMIT 1;
   ```
3. Compare `expires_at` against the current UTC time. A value in the past confirms token expiry.
4. Check whether the TokenManager attempted a proactive refresh by searching logs for `TokenManager: refreshing token` within the 5-minute window before expiry.
5. Call the health endpoint to get a live status report:
   ```
   GET /api/xero/health
   ```
   Expected response when token is expired:
   ```json
   { "tokenStatus": "expired", "canRefresh": true }
   ```

#### Fix

**Case A: Access token expired, refresh token still valid**

The health endpoint will attempt a refresh automatically. If the automatic refresh succeeds, the system self-heals. Verify by re-submitting the failed invoice.

If the health endpoint returns an error, manually trigger the refresh flow by calling:
```
GET /api/xero/health
```
Monitor logs for `TokenManager: token refreshed successfully`.

**Case B: Refresh token also expired (invalid_grant)**

Proceed to INC-002.

**Case C: TokenManager mutex deadlock (refresh never attempted)**

1. Restart the Next.js server process to clear in-memory state.
2. After restart, the next request will trigger a fresh token check.
3. If the issue recurs, add a log probe to the mutex acquisition path and escalate to a code fix.

#### Verification

- Call `GET /api/xero/health` and confirm `tokenStatus: "active"`.
- Submit a test invoice through the UI and confirm it reaches Xero as a DRAFT.
- Confirm the `created_invoices` table shows `status = SUBMITTED` (not `PENDING_XERO` or `FAILED`).

#### Post-Mortem Triggers

Open a post-mortem if:
- The proactive 5-minute refresh did not fire as expected (indicates a bug in TokenManager).
- More than one user was affected before the issue was detected.
- The incident consumed more than 20% of the monthly error budget (SLO-005: approximately 1 failure out of 5 allowed per month).

---

### INC-002: Xero Refresh Token Expired (60-Day Inactivity)

**Severity:** SEV-2 (escalates to SEV-1 if no admin is available to re-authorize)
**Risk Register Reference:** R-02 (HIGH risk — refresh token expiry after 60 days of inactivity)
**SLO Impact:** SLO-001 (availability) and SLO-005 (API success rate)

#### Detection

- Xero OAuth2 refresh call returns `error: invalid_grant`.
- Application logs contain: `refresh token expired` or `invalid_grant`.
- Prometheus alert `XeroTokenExpired` fires.
- `GET /api/xero/health` returns `{ "tokenStatus": "expired", "canRefresh": false }`.
- All invoice submissions fail; users cannot create any invoices.

#### Diagnosis

1. Confirm the error type is `invalid_grant` (not a network error or misconfiguration):
   ```
   GET /api/xero/health
   ```
2. Check `xero_tokens` table for the `updated_at` timestamp. If the last update was more than 60 days ago, the refresh token has expired due to inactivity.
3. Confirm whether the weekly cron job running the token health check was active (see Section 6, Maintenance Procedures). A missed or non-existent cron is typically the root cause.

#### Fix

Re-authorization by an administrator is the only recovery path. There is no programmatic fix.

1. An administrator with Xero account access navigates to:
   ```
   http://localhost:3000/login
   ```
2. Click "Connect to Xero" to initiate the OAuth2 authorization flow.
3. Complete the Xero login and grant the requested scopes.
4. Auth.js stores the new access token and refresh token in `xero_tokens`.
5. Verify the new token is active:
   ```
   GET /api/xero/health
   ```
   Expected: `{ "tokenStatus": "active", "canRefresh": true }`

**Important:** Invoice history, SQLite data, and Fuse.js caches are not affected. Only the Xero OAuth connection is lost and restored. No data needs to be re-imported.

#### Verification

- `GET /api/xero/health` returns `tokenStatus: "active"`.
- Submit a test invoice and confirm DRAFT creation in Xero.
- Confirm the weekly cron job for token health check is scheduled and running to prevent recurrence.

#### Post-Mortem Triggers

Always open a post-mortem for this incident. Root cause is typically a failed or absent weekly cron job. The Prometheus alert `XeroTokenExpiringSoon` (fires at 14 days remaining) should have provided advance warning. If it did not fire, that is a secondary action item.

---

### INC-003: Xero API Rate Limit Hit (HTTP 429)

**Severity:** SEV-2 (minute limit, transient) / SEV-1 (daily limit exhausted)
**Risk Register Reference:** R-03 (HIGH risk — rate limit during batch operations)
**SLO Impact:** SLO-006 (100% rate limit compliance, zero 429 responses per day)

#### Detection

- Xero API calls return HTTP 429.
- Application logs contain: `429 Too Many Requests`.
- `X-MinLimit-Remaining` header value drops to 0.
- Prometheus alerts `XeroRateLimitApproaching` (fewer than 10 remaining) or `XeroDailyLimitApproaching` (fewer than 500 remaining) fire.
- Users report slow invoice submissions or submission failures during batch operations.

#### Diagnosis

**Step 1: Identify the limit type**

Check the response headers from the last 429 error in logs:
- `X-MinLimit-Remaining`: minute-level limit (50 req/min)
- `X-DayLimit-Remaining`: daily limit (4,500 req/day)

**Step 2: Check current rate limit counters**

```
GET /api/xero/health
```
Review the `rateLimitStatus` fields in the response.

**Step 3: Identify the source of excess requests**

Search logs for the last 5 minutes of API calls. Look for:
- Repeated identical requests indicating a retry loop bug.
- Unexpected batch processing running outside scheduled windows.
- Multiple concurrent users submitting invoices simultaneously.

**Step 4: Check system_config for the daily counter**

```sql
SELECT key, value, updated_at FROM system_config WHERE key LIKE 'xero_daily%';
```

#### Fix

**Case A: Minute limit hit (transient)**

The p-queue retry logic applies exponential backoff (1s, 2s, 4s, 8s, 16s, maximum 5 retries) and should recover automatically within 60 seconds. No manual action is required unless the queue is in a runaway retry loop.

To verify recovery:
- Wait 60 seconds.
- Check that `X-MinLimit-Remaining` resets in the next Xero API response.
- Confirm submissions resume without further 429 responses.

**Case B: Runaway retry loop detected**

1. Restart the Next.js server to flush the p-queue.
2. Investigate the code path that caused the loop before restarting submissions.
3. If a code bug is confirmed, patch and redeploy before allowing batch operations to resume.

**Case C: Daily limit exhausted (X-DayLimit-Remaining below 100)**

1. Stop all new invoice submissions immediately. Advise users to wait until midnight UTC (08:00 MYT) when the daily counter resets.
2. Check `system_config` daily counter for accuracy:
   ```sql
   SELECT value FROM system_config WHERE key = 'xero_daily_remaining';
   ```
3. Identify what consumed the daily budget (large batch, loop bug, or unexpected load).
4. For Phase 2 batch operations: split batches into smaller sub-batches with a 2-second pause between each, and schedule across multiple days if the volume exceeds safe daily limits.
5. Daily limit resets at midnight UTC. Resume submissions after the reset is confirmed via `GET /api/xero/health`.

#### Verification

- `GET /api/xero/health` shows `rateLimitStatus.minuteRemaining > 10` and `dailyRemaining > 100`.
- No new 429 responses appear in logs for 10 minutes.
- Invoice submissions complete successfully end-to-end.

#### Post-Mortem Triggers

Open a post-mortem if the daily limit was exhausted. The daily limit of 4,500 requests is very large relative to the approximately 500 invoices per month this system processes, so exhaustion strongly indicates either a runaway loop or a batch processing error. Also open a post-mortem if the Prometheus alert `XeroDailyLimitApproaching` did not fire before exhaustion.

---

### INC-004: SQLite Database Corruption

**Severity:** SEV-1
**Risk Register Reference:** R-07 (HIGH risk — SQLite data loss or corruption)
**SLO Impact:** SLO-001 (availability); complete system outage until restored

#### Detection

- Application logs contain: `SQLITE_CORRUPT`, `SQLITE_IOERR`, or `database disk image is malformed`.
- All database-dependent routes return 500 errors.
- Server fails to start or crashes immediately after startup.
- `GET /api/xero/health` returns a database connectivity error.

#### Diagnosis

1. Stop the Next.js server immediately to prevent further writes to the corrupted file.
2. Run an integrity check on the SQLite file:
   ```bash
   sqlite3 /path/to/invoice-system.db "PRAGMA integrity_check;"
   ```
   - Output of `ok` means the file is intact (the error may be transient or caused by something else).
   - Any other output confirms corruption.
3. Check whether orphaned WAL/SHM files from an unclean shutdown exist:
   ```bash
   ls -lh /path/to/invoice-system.db-wal
   ls -lh /path/to/invoice-system.db-shm
   ```
   Attempt a WAL checkpoint recovery before restoring from backup:
   ```bash
   sqlite3 /path/to/invoice-system.db "PRAGMA wal_checkpoint(TRUNCATE);"
   ```
   If `PRAGMA integrity_check;` returns `ok` after this, the file may be recoverable without a restore.

#### Fix

**Case A: WAL checkpoint recovered the database**

- Restart the server and confirm normal operation.
- Run `PRAGMA integrity_check;` again after restart to re-validate.
- Monitor closely for the next hour.

**Case B: Confirmed corruption — restore from backup**

1. Confirm the Next.js server is stopped.
2. Rename the corrupted database file as evidence:
   ```bash
   mv /path/to/invoice-system.db /path/to/invoice-system.db.corrupted.$(date +%Y%m%d%H%M%S)
   mv /path/to/invoice-system.db-wal /path/to/invoice-system.db-wal.bak 2>/dev/null
   mv /path/to/invoice-system.db-shm /path/to/invoice-system.db-shm.bak 2>/dev/null
   ```
3. Copy the most recent daily backup to the active database path:
   ```bash
   cp /path/to/backups/invoice-system-YYYYMMDD.db /path/to/invoice-system.db
   ```
4. Run an integrity check on the restored file:
   ```bash
   sqlite3 /path/to/invoice-system.db "PRAGMA integrity_check;"
   ```
5. Restart the Next.js server.
6. Identify any invoices created between the backup timestamp and the corruption event by cross-referencing the Xero dashboard. Re-record missing entries in `created_invoices` manually if audit trail completeness is required.

**Case C: No valid backup available**

1. Re-create the schema and re-import from the original source CSV files:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
2. Xero itself holds all submitted invoices as the authoritative source of truth. No invoice submitted to Xero before the corruption event is permanently lost.
3. The `xero_tokens` table will be empty after a fresh schema creation; proceed to INC-002 (re-authorization) after the database is restored.
4. The `created_invoices` audit log will be incomplete; cross-reference with Xero exports to reconstruct records as needed.

#### Verification

- `sqlite3 /path/to/invoice-system.db "PRAGMA integrity_check;"` returns `ok`.
- `GET /api/xero/health` returns database connectivity as healthy.
- Submit a test invoice end-to-end and confirm it appears in both `created_invoices` and Xero as a DRAFT.

#### Post-Mortem Triggers

Always open a post-mortem. Investigate:
- Whether WAL mode was properly enabled at the time of corruption.
- Whether the daily backup process ran successfully before the corruption event.
- Whether the backup file was older than 25 hours (a stale backup alert should have fired in advance).

---

### INC-005: Fuzzy Match Returns Wrong Suggestions

**Severity:** SEV-3
**Risk Register Reference:** R-06 (HIGH risk — poor fuzzy match quality)
**SLO Impact:** No direct SLO violation; impacts user trust and increases the correction burden on staff

#### Detection

- Staff reports that the auto-fill populated an incorrect contact name, account code, or tracking category.
- During Phase 1 staff feedback collection, the correction rate for a specific field exceeds acceptable levels.
- Fuse.js match score logs show low-confidence scores (below the configured threshold) being accepted and surfaced to the user.

#### Diagnosis

1. Collect the specific input value that triggered the wrong suggestion from the staff report (for example, the Description text that was entered).
2. Review `invoice_history` for entries matching that description:
   ```sql
   SELECT description, contact_name, account_code, count(*) AS frequency
   FROM invoice_history
   WHERE description LIKE '%[reported text]%'
   GROUP BY description, contact_name, account_code
   ORDER BY frequency DESC
   LIMIT 10;
   ```
3. Check the Fuse.js configuration (typically in `lib/autocomplete/fuse-config.ts` or equivalent) for current field weights and the threshold value.
4. Determine whether the issue is:
   - **Data quality:** `invoice_history` contains conflicting or noisy records for this description pattern.
   - **Weight misconfiguration:** A lower-priority field is weighted higher than a higher-priority field.
   - **Threshold too permissive:** Low-confidence matches are being returned to users rather than showing no suggestion.

#### Fix

**Case A: Data quality issue in invoice_history**

1. Identify and correct the problematic records:
   ```sql
   -- Review problematic records
   SELECT id, description, contact_name, account_code
   FROM invoice_history
   WHERE description LIKE '%[problematic pattern]%';

   -- Correct records as appropriate
   UPDATE invoice_history SET contact_name = '[correct name]' WHERE id = [id];
   ```
2. Restart or invalidate the Fuse.js index cache to reflect the updated data.

**Case B: Fuse.js weight adjustment needed**

1. Update field weights in the Fuse.js configuration. Recommended starting adjustments based on the 18,860-record training set:
   - `ContactName`: weight 0.4
   - `Description`: weight 0.3
   - `AccountCode`: weight 0.2
   - `TrackingCategory`: weight 0.1
2. Raise the minimum acceptable score threshold (lower Fuse.js threshold value means stricter matching; for example, `threshold: 0.3`).
3. Test the new configuration against the reported input before deploying to confirm the correct result is returned.

**Case C: Threshold too permissive**

Raise the minimum score required before a suggestion is surfaced to the user. Prefer showing "No suggestion found" over a low-confidence suggestion that staff may accept without scrutiny.

#### Verification

- Re-test the specific input that triggered the wrong suggestion and confirm the correct result is returned.
- Run the Phase 1 staff feedback session to collect broader accuracy data across a larger sample.
- Monitor the correction rate for the affected field over the following week.

#### Post-Mortem Triggers

Open a post-mortem if the wrong suggestion led to a wrong invoice type being created (see INC-008), or if the data quality issue affected more than 10% of invoice submissions in a single week.

---

### INC-006: Auth.js Session Issues (Repeated Login Redirects)

**Severity:** SEV-2
**Risk Register Reference:** R-13 (HIGH risk — Auth.js v5 compatibility with custom Xero OIDC provider)
**SLO Impact:** SLO-001 (availability) — users cannot access the system

#### Detection

- Users report being repeatedly redirected to the login page despite completing the login flow.
- Application logs show repeated session creation attempts or JWT callback errors.
- `NEXTAUTH_SECRET` environment variable error appears in server startup logs.
- Session cookies are not being set or are being rejected by the browser.

#### Diagnosis

1. Check server startup logs for any Auth.js initialization errors related to `NEXTAUTH_SECRET` or the Xero OIDC provider configuration.
2. Verify the `NEXTAUTH_SECRET` environment variable is set and non-empty in `.env.local`.
3. Check browser developer tools under Application > Cookies for the presence of `next-auth.session-token` or `__Secure-next-auth.session-token`. If absent after a successful login, the cookie is not being set.
4. Verify cookie configuration in `auth.ts`:
   - `secure: true` requires HTTPS. On `localhost`, this must be `false` or left unset.
   - `sameSite` settings must be compatible with the application URL.
5. Check Auth.js JWT callback logs for token refresh failures. A failed Xero token refresh inside the JWT callback causes Auth.js to invalidate the session and redirect to login.
6. Confirm the Xero OIDC discovery document is reachable:
   ```
   GET https://identity.xero.com/.well-known/openid-configuration
   ```

#### Fix

**Case A: Missing or invalid NEXTAUTH_SECRET**

1. Generate a new secret:
   ```bash
   openssl rand -base64 32
   ```
2. Set it in `.env.local`:
   ```
   NEXTAUTH_SECRET=<generated value>
   ```
3. Restart the Next.js server. All existing sessions will be invalidated; users will need to log in once.

**Case B: Cookie settings incompatible with localhost**

Update `auth.ts` to ensure `secure` is not set to `true` for the localhost HTTP environment. The `__Secure-` cookie prefix requires HTTPS and will cause the cookie to be silently dropped on HTTP origins.

**Case C: JWT callback failing due to Xero token refresh error**

The Auth.js JWT callback calls the Xero token refresh endpoint on each session validation. If the refresh token is expired, Auth.js will invalidate the session and redirect to login on every request. Proceed to INC-002 to re-authorize the Xero connection.

**Case D: Xero OIDC discovery endpoint unreachable**

Check network connectivity to `https://identity.xero.com`. If Xero's identity service is experiencing an outage, Auth.js cannot validate sessions. Consult `https://status.xero.com` for active platform incidents. This is an external dependency failure; no internal fix is possible.

#### Verification

- A user can log in and remain on the application without being redirected.
- `GET /api/xero/health` returns a successful response (requires an active session).
- The session cookie (`next-auth.session-token`) is present in browser developer tools after login.

#### Post-Mortem Triggers

Open a post-mortem if all users were locked out simultaneously, or if the root cause was a configuration regression introduced by a deployment (for example, `.env.local` being overwritten or a missing environment variable in a redeploy).

---

### INC-007: xero-node SDK Build Failure

**Severity:** SEV-3
**Risk Register Reference:** R-12 (MEDIUM risk — xero-node webpack conflict in Next.js build)
**SLO Impact:** Prevents deployment; no runtime SLO impact if caught before the build reaches production

#### Detection

- `npm run build` fails with webpack module resolution errors.
- Error messages reference `xero-node`, `better-sqlite3`, native Node.js modules, or `__dirname` in a client-side bundle.
- Common error message examples:
  - `Module not found: Can't resolve 'fs'`
  - `Module not found: Can't resolve 'node:crypto'`
  - `Critical dependency: the request of a dependency is an expression`

#### Diagnosis

1. Review the full build error output for the specific module that failed to resolve.
2. Confirm whether the failure originated in a Server Component, a Client Component, or a shared utility file.
3. Verify `next.config.ts` contains the correct `serverExternalPackages` configuration:
   ```typescript
   // next.config.ts
   const nextConfig = {
     serverExternalPackages: ['xero-node', 'better-sqlite3'],
   };
   ```
4. Check whether a recent change introduced an import of `xero-node` or `better-sqlite3` in a Client Component or a shared file that is imported by a Client Component.
5. Check whether a recent SDK version update changed the package's internal module structure in a way that bypasses the `serverExternalPackages` exclusion.

#### Fix

**Case A: serverExternalPackages missing or incomplete**

Add the missing package names to `serverExternalPackages` in `next.config.ts` and re-run the build.

**Case B: xero-node imported in a client component or shared file**

Move all `xero-node` imports to server-only files (`lib/xero/xero-service.ts`, API route handlers, Server Actions). Never import `xero-node` in a component file or any file that lacks a `'use server'` directive.

Add a `server-only` import guard at the top of the file as an additional safeguard:
```typescript
import 'server-only';
```

**Case C: xero-node SDK update broke webpack compatibility**

1. Revert to the last known working version:
   ```bash
   npm install xero-node@<last-known-good-version>
   ```
2. Confirm the build succeeds before redeploying.
3. File a bug report against the `XeroAPI/xero-node` GitHub repository; this follows the known issue #543 pattern.
4. If the SDK becomes unmaintained or the issue cannot be resolved, migrate `lib/xero/xero-service.ts` to direct `fetch` REST calls against the Xero API. All Xero interactions are isolated in that single file. Estimated migration effort: 3-5 days (see R-04 contingency in the risk register).

#### Verification

- `npm run build` completes without errors.
- `npm run start` launches the server successfully.
- Submit a test invoice to confirm runtime functionality is intact after the build fix.

#### Post-Mortem Triggers

Open a post-mortem if a broken build was deployed to the running server (indicating the build step was skipped or not gated before deployment), or if the xero-node SDK version was updated without first verifying a successful build.

---

### INC-008: Invoice Created as Wrong Type (DEBIT NOTE vs INVOICE)

**Severity:** SEV-3
**Risk Register Reference:** R-11 (HIGH risk — staff creates wrong invoices) / R-06 (fuzzy match quality)
**SLO Impact:** No direct SLO violation; creates incorrect financial records in Xero

#### Detection

- Staff reports that a DEBIT NOTE was created when an INVOICE was intended, or vice versa.
- Querying `created_invoices` shows `invoice_type = 'ACCRECCREDIT'` where `'ACCREC'` was expected (or the reverse).
- Staff locates the wrong document type in Xero's DRAFT invoices list.

#### Diagnosis

1. Retrieve the affected record from `created_invoices`:
   ```sql
   SELECT id, invoice_number, invoice_type, contact_name, reference, created_at
   FROM created_invoices
   WHERE invoice_number = '[reported invoice number]';
   ```
2. Note the Reference field value used for this submission.
3. Review the Reference-to-type mapping logic in the codebase (likely in `lib/xero/invoice-builder.ts` or equivalent). Determine whether:
   - The mapping rule incorrectly classified this Reference pattern as a DEBIT NOTE.
   - The historical pattern in `invoice_history` contains conflicting type records for this Reference pattern.
4. Check `invoice_history` for the Reference pattern:
   ```sql
   SELECT reference, invoice_type, count(*) AS frequency
   FROM invoice_history
   WHERE reference LIKE '%[reference pattern]%'
   GROUP BY reference, invoice_type
   ORDER BY frequency DESC;
   ```
   Conflicting rows for the same Reference pattern will cause inconsistent fuzzy match results.

#### Fix

**Immediate: Void the incorrect DRAFT invoice in Xero**

Since all invoices are created as DRAFT status, no invoice has been sent to a client at the point of detection. The incorrect draft can be voided in Xero:
1. Open the Xero dashboard and locate the incorrect DRAFT invoice.
2. Change its status to VOIDED (or Delete if it remains in DRAFT).
3. Re-create the correct invoice type through the application, with the correct type explicitly confirmed by staff in the preview form before submission.

If the 30-second undo window is implemented, staff can click "Undo" immediately after submission to void the draft without accessing Xero directly.

**Fix the root cause:**

- If the mapping logic contains an incorrect rule: update the Reference-to-type classification rules and redeploy.
- If `invoice_history` data is ambiguous: clean up conflicting records (see INC-005, Case A) to establish a consistent historical pattern.
- If staff repeatedly selects the wrong type: add an explicit type confirmation step to the invoice preview form so staff must actively confirm INVOICE vs DEBIT NOTE before the form allows submission.

#### Verification

- Re-submit the same invoice data and confirm the correct Xero type (`ACCREC` or `ACCRECCREDIT`) appears in Xero as a DRAFT.
- Confirm the previously incorrect DRAFT is in VOIDED status in Xero.
- Review `invoice_history` for the affected Reference pattern to confirm data quality is now consistent.

#### Post-Mortem Triggers

Open a post-mortem if more than one invoice was affected before detection, if the incorrect type was AUTHORIZED in Xero (not DRAFT, indicating a workflow change outside this system), or if the root cause is a systematic mapping rule error affecting an entire class of invoices.

---

## 3. Rollback Procedures

### 3.1 Code Rollback

Use when a recent deployment introduced a regression such as a build failure, broken feature, or incorrect behavior.

```bash
# Identify the last known good commit
git log --oneline -10

# Revert the bad commit (creates a new commit, preserves history)
git revert <commit-hash>

# Or revert the most recent commit only
git revert HEAD

# Rebuild and restart
npm run build
npm run start
```

Verify after rollback:
- `npm run build` completes without errors.
- `GET /api/xero/health` returns all systems healthy.
- Submit a test invoice to confirm end-to-end functionality.

### 3.2 Database Rollback

Use when SQLite corruption is confirmed (see INC-004) or when a data migration script introduced incorrect data.

```bash
# Step 1: Stop the server

# Step 2: Verify backup integrity before restoring
sqlite3 /path/to/backups/invoice-system-YYYYMMDD.db "PRAGMA integrity_check;"

# Step 3: Preserve the current (corrupt or bad) database as evidence
mv /path/to/invoice-system.db /path/to/invoice-system.db.pre-rollback.$(date +%Y%m%d%H%M%S)

# Step 4: Restore from backup
cp /path/to/backups/invoice-system-YYYYMMDD.db /path/to/invoice-system.db

# Step 5: Validate the restored database
sqlite3 /path/to/invoice-system.db "PRAGMA integrity_check;"
sqlite3 /path/to/invoice-system.db "SELECT count(*) FROM invoice_history;"
sqlite3 /path/to/invoice-system.db "SELECT count(*) FROM created_invoices;"

# Step 6: Restart the server
npm run start
```

Important notes:
- Any invoices created between the backup timestamp and the rollback will not appear in the local `created_invoices` table. Cross-reference with Xero to identify and manually re-record these if audit trail completeness is required.
- Xero is the authoritative record for all submitted invoices. The local SQLite database is the audit log and history cache. No invoice submitted to Xero before the corruption event is permanently lost.

### 3.3 Token Rollback (Re-Authorization)

Use when the `xero_tokens` table contains corrupt data, stale data from a previous tenant, or when a database rollback removed valid tokens.

```sql
-- Clear all token records
DELETE FROM xero_tokens;
```

After clearing tokens:
1. Navigate to `http://localhost:3000/login`.
2. Click "Connect to Xero" and complete the OAuth2 authorization flow.
3. Verify `GET /api/xero/health` returns `tokenStatus: "active"`.

Note: Clearing the tokens table does not affect `invoice_history`, `created_invoices`, or any other application data. Invoice history and the Fuse.js cache remain intact.

---

## 4. Health Check Procedures

### 4.1 Automated Health Endpoint

```
GET http://localhost:3000/api/xero/health
```

Expected response for a fully healthy system:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-10T09:00:00.000Z",
  "tokenStatus": "active",
  "canRefresh": true,
  "tokenExpiresIn": 1620,
  "refreshTokenExpiresIn": 5184000,
  "rateLimitStatus": {
    "minuteRemaining": 48,
    "dailyRemaining": 4487
  },
  "database": "connected",
  "pendingInvoices": 0
}
```

Key fields and their alert thresholds:

| Field | Healthy Value | Action Required |
|-------|--------------|-----------------|
| `tokenStatus` | `"active"` | If `"expired"`: attempt refresh; if `canRefresh: false`, proceed to INC-002 |
| `canRefresh` | `true` | If `false`: refresh token expired; re-authorization required (INC-002) |
| `refreshTokenExpiresIn` | > 1,209,600 seconds (14 days) | If below: alert admin to schedule re-authorization before expiry |
| `rateLimitStatus.minuteRemaining` | >= 10 | If below: investigate for runaway requests (INC-003) |
| `rateLimitStatus.dailyRemaining` | >= 500 | If below: trigger `XeroDailyLimitApproaching` response (INC-003) |
| `database` | `"connected"` | If error: check SQLite integrity (INC-004) |
| `pendingInvoices` | 0 | If > 0 for more than 30 minutes: investigate stuck PENDING_XERO rows |

### 4.2 Manual SQLite Integrity Check

Run after any unclean server shutdown or as part of incident diagnosis:

```bash
# Full integrity check
sqlite3 /path/to/invoice-system.db "PRAGMA integrity_check;"
# Expected output: ok

# Flush WAL to main database file
sqlite3 /path/to/invoice-system.db "PRAGMA wal_checkpoint(PASSIVE);"

# Verify row counts are plausible
sqlite3 /path/to/invoice-system.db "SELECT count(*) FROM invoice_history;"
sqlite3 /path/to/invoice-system.db "SELECT count(*) FROM created_invoices;"
sqlite3 /path/to/invoice-system.db "SELECT count(*) FROM xero_tokens;"
```

### 4.3 Manual Xero API Connectivity Check

Verify that Xero's API is reachable and that the current token is accepted:

```
GET /api/xero/health
```

If the health endpoint reports Xero connectivity errors but `tokenStatus` is `"active"`, check `https://status.xero.com` for active Xero platform incidents before investigating local configuration.

### 4.4 Pending Invoice Check

Identify invoices that were submitted locally but not confirmed by Xero:

```sql
SELECT id, invoice_number, contact_name, created_at, status
FROM created_invoices
WHERE status = 'PENDING_XERO'
ORDER BY created_at ASC;
```

Any row in `PENDING_XERO` status for more than 30 minutes requires investigation. The Xero submission either failed silently or the network call timed out without updating the local status. Cross-reference with the Xero dashboard to determine whether the invoice was actually created on the Xero side.

---

## 5. Escalation Matrix

| Level | Contact | Role | When to Escalate |
|-------|---------|------|-----------------|
| L1 | SH-003 (Developer) | System administrator and primary on-call | All incidents — first contact for any SEV-1 through SEV-4 |
| L2 | Xero Developer Support (`developer.xero.com/support`) | Xero platform support | When the root cause is confirmed to be a Xero API bug, unexpected API behavior, OAuth infrastructure outage, or xero-node SDK defect that cannot be resolved internally |
| L3 | Management (SH-002) | Business stakeholder | Data loss confirmed or unrecoverable, extended outage beyond 4 hours during business hours (9:00-18:00 MYT), SLO error budget at 100%+ (RED status), or incorrect invoices that have reached clients in Xero |

### Escalation Notes

**Xero platform outages:** Check `https://status.xero.com` before escalating to L2. If Xero confirms an active platform incident, the cause is an external dependency failure. Document the incident start time and wait for Xero resolution; no internal fix is possible.

**Bus factor (R-16):** All architecture decisions, token handling logic, Fuse.js weight rationale, and incident learnings are documented in `architecture_final.md`, `implementation_plan.md`, this runbook, and the risk register. If SH-003 is unavailable, a second developer can be onboarded using these documents without requiring tribal knowledge transfer.

**Wrong invoice escalation threshold:** Since all invoices are created as DRAFT in Xero, no invoice is sent to a client without manual authorization in Xero by the accounts team. This provides a review window before any client-facing financial impact. L3 escalation is only required if an incorrect DRAFT was AUTHORIZED in Xero and dispatched to a client.

---

## 6. Maintenance Procedures

### 6.1 Daily

| Task | Method | Alert Condition |
|------|--------|----------------|
| SQLite backup | Copy database file to backup location (network share or cloud folder) | Backup file older than 25 hours |
| Check pending invoices | `GET /api/xero/health` and inspect `pendingInvoices` field | Any `created_invoices` row with `status = PENDING_XERO` for more than 30 minutes |
| Xero daily API counter review | Review via health endpoint or Prometheus dashboard | `X-DayLimit-Remaining` below 500 triggers `XeroDailyLimitApproaching` warning |

**Daily backup command:**

```bash
# Copy with date-stamped filename
cp /path/to/invoice-system.db /path/to/backups/invoice-system-$(date +%Y%m%d).db

# Retain last 30 days; remove older backups
find /path/to/backups -name "invoice-system-*.db" -mtime +30 -delete

# Verify the backup integrity
sqlite3 /path/to/backups/invoice-system-$(date +%Y%m%d).db "PRAGMA integrity_check;"
```

### 6.2 Weekly

| Task | Method | Alert Condition |
|------|--------|----------------|
| Token health check | Call `GET /api/xero/health` via cron job | `refreshTokenExpiresIn` below 1,209,600 seconds (14 days) triggers `XeroTokenExpiringSoon` warning |
| Review error logs | Search application logs for ERROR-level entries | Any new error pattern not seen in the previous week warrants investigation |
| Next.js security advisories | Check GitHub security feed for `nextjs/next.js` | Any critical CVE affecting Next.js >= 15.2.3 requires immediate patch review (R-09) |
| xero-node release notes | Check `XeroAPI/xero-node` GitHub releases | Breaking changes or security patches require build testing before scheduling an upgrade |

**Weekly token health cron example:**

```bash
# crontab entry — every Monday at 08:00 MYT (00:00 UTC)
0 0 * * 1 curl -sf http://localhost:3000/api/xero/health >> /var/log/xero-health-weekly.log 2>&1
```

### 6.3 Monthly

| Task | Method | Notes |
|------|--------|-------|
| Fuse.js match accuracy review | Analyze Phase 1 staff correction data; compare `invoice_history` suggestions vs actual submissions | Target: ContactName accuracy >= 90%, AccountCode accuracy >= 85% (per SLO dashboard spec). Re-weight fields if correction rate for any field is consistently high. |
| xero-node SDK update (if patch available) | `npm update xero-node`, then `npm run build`, then end-to-end invoice submission test | Only update if a security or bug fix is relevant to this system. The April 2026 Employee endpoint deprecation does not affect this project. |
| Risk register review | Cross-reference `research/risk_register.md` with observed system behavior and any incidents from the past month | Update probability and impact assessments. Escalate any newly HIGH risks to L3. |
| Error budget review | Calculate 30-day rolling consumption across SLO-001 through SLO-006 | If any SLO is at ORANGE (80-100% budget consumed), pause new feature work and prioritize reliability improvements as defined in `slo.md` Section 3.2. |
| Dependency audit | `npm audit` | Patch any HIGH or CRITICAL vulnerabilities before the next development sprint. |

---

## Revision History

| Date | Version | Author | Change Summary |
|------|---------|--------|----------------|
| 2026-03-10 | 1.0 | Developer (SH-003) | Initial version — Japanese language, covers OAuth, rate limit, API down, DB corruption, wrong invoice, mutex deadlock |
| 2026-03-10 | 2.0 | Developer (SH-003) | Full rewrite — English, aligned with risk register R-01 through R-16, SLO error budget thresholds, structured INC-001 through INC-008 with Detection/Diagnosis/Fix/Verification/Post-Mortem sections, standardized severity matrix |
