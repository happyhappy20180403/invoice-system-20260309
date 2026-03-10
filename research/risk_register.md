# Risk Register - Xero Invoice Auto-Input System

**Date:** 2026-03-10
**Version:** 1.0
**Review Cadence:** Monthly during Phase 1; quarterly thereafter.

---

## Risk Matrix

### Probability Scale
- **High:** > 60% chance of occurring
- **Medium:** 20-60% chance
- **Low:** < 20% chance

### Impact Scale
- **Critical:** System unusable; invoices cannot be created; data loss possible
- **High:** Core functionality impaired; manual workaround required
- **Medium:** Feature degraded; minor delay or extra effort
- **Low:** Cosmetic or minor inconvenience

---

## Risk Table

| ID | Risk | Probability | Impact | Risk Level | Mitigation | Alternative / Contingency |
|----|------|------------|--------|------------|------------|--------------------------|
| R-01 | Xero access token expires during form submission, causing invoice creation to fail | High | High | HIGH | Proactive TokenManager refreshes 5 min before expiry with mutex lock. 30-min token lifetime is short; nearly every session will trigger at least one refresh. | Auth.js JWT callback catches refresh failures and redirects user to re-authorize. User is shown a friendly "Session refreshing..." message during in-progress refresh. |
| R-02 | Xero refresh token expires after 60 days of inactivity | Medium | Critical | HIGH | Add a weekly scheduled token health check (`/api/xero/health` called by cron). If token is valid but will expire within 14 days of inactivity, log a warning. Alert admin to log in. | If token has expired: user must re-authorize via Xero OAuth2. Old token cleared from DB. Invoice history and local cache remain intact; no data loss. |
| R-03 | Xero API rate limit (429) hit during batch operations | Medium | High | HIGH | Request queue capped at 50 req/min. Exponential backoff (1s→2s→4s→8s→16s, max 5 retries). Daily limit tracker in system_config. | For Phase 2 batch: process invoices in smaller sub-batches with 2-second pause between batches. Worst case: split batch across two submission sessions. |
| R-04 | xero-node SDK deprecated or significantly changed before April 28, 2026 | Medium | Critical | HIGH | Monitor XeroAPI/xero-node GitHub releases and Xero changelog. The April 2026 deprecation applies only to Employee endpoints (not used by this project). SDK itself is not deprecated. | If SDK becomes unmaintained: migrate to direct `fetch` calls against Xero REST API. All Xero API calls are isolated in `lib/xero/xero-service.ts` — a single migration surface. Estimated migration effort: 3-5 days. |
| R-05 | Granular OAuth2 scope migration required earlier than expected | Low | High | MEDIUM | Monitor Xero devblog. Scope migration target: May 2026 (when granular scopes available). Start with broad scopes. | Auth config is in a single file (`auth.ts`). Scope change requires updating one string. Estimated effort: 1 hour + re-authorization by user. |
| R-06 | Fuzzy match returns poor suggestions (wrong contact or account code) | High | Medium | HIGH | Fuse.js weights tuned from 18,860 historical records. Phase 1 includes 2-week staff feedback collection. After Phase 1, re-weight fields based on observed correction patterns. | All auto-filled fields are editable before submission. Invoice is created as DRAFT in Xero (not AUTHORISED), allowing review in Xero dashboard before sending to clients. DRAFT status prevents accidental sending. |
| R-07 | SQLite database corruption or data loss (local file storage) | Low | Critical | HIGH | SQLite WAL mode enabled (write-ahead logging) reduces corruption risk. Daily file backup to a second location (e.g., network share or cloud folder). | Restore from backup. Invoice history can be re-imported from original CSVs. Created invoices are already in Xero; local audit log can be rebuilt. Token requires re-authorization only. |
| R-08 | Xero Contact not found: new project/unit not yet in Xero contacts | Medium | Medium | MEDIUM | Staff can manually type a contact name in the preview form. The system sends `Name` string (not ContactID) to Xero, which auto-creates or auto-matches the contact if the name matches. Xero API supports contact auto-creation by name. | Add a "Create New Contact" flow in Phase 1 Polish (Week 8): if no match, offer to create contact in Xero via `POST /Contacts`. Pre-fill from staff input. |
| R-09 | Next.js critical vulnerability requires urgent upgrade mid-project | Medium | High | HIGH | Already on Next.js >= 15.2.3 (patches CVE-2025-29927). Keep Next.js pinned but watch for security advisories. Subscribe to Next.js GitHub security advisories. | Next.js minor/patch upgrades are typically non-breaking. Upgrade procedure: `npm update next`, run tests, redeploy. Estimated effort: 0.5-1 day. |
| R-10 | Xero connection count exceeds Starter tier limit (5 connections) | Low | Medium | LOW | This is a single-tenant internal tool. Only 1 connection will be active. Starter tier allows 5 connections. | If multiple staff accounts are needed: consolidate to a single Xero user account for the app connection. If connection count grows to 5+: upgrade to Xero API Core tier (~$35 AUD/month). |
| R-11 | Staff enters incorrect data that creates wrong invoices in Xero | High | High | HIGH | Three safeguards: (1) All invoices created as DRAFT status. (2) Invoice preview shows all fields before submission. (3) created_invoices audit log records all submissions. | Add a 30-second undo window after submission: if staff clicks "Undo", void the draft invoice in Xero (PATCH status to VOIDED). After 30 seconds, invoice remains as DRAFT for manual review in Xero. |
| R-12 | xero-node webpack conflict breaks Next.js build | Low | High | MEDIUM | next.config.ts includes `serverExternalPackages: ['xero-node', 'better-sqlite3']`. Xero-node is never imported in any client component. Known issue (#543) is fully avoided by server-side isolation. | If build fails: replace xero-node with direct `fetch` REST calls in `lib/xero/xero-service.ts`. Pre-written migration plan exists (see R-04). |
| R-13 | Auth.js v5 compatibility issues with custom Xero OIDC provider | Medium | High | HIGH | Auth.js v5 supports custom OIDC providers via issuer discovery (`https://identity.xero.com/.well-known/openid-configuration` verified working). Xero supports `client_secret_basic` and `client_secret_post` auth methods, both supported by Auth.js. | Fallback: implement OAuth2 flow manually using native `fetch` with `node:crypto` for PKCE, without Auth.js. Xero provides reference implementations (xero-node-oauth2-app on GitHub). Estimated effort: 3 days. |
| R-14 | Tracking category already used (max 2 per org; company may have used both slots) | Low | High | MEDIUM | Research phase confirmed tracking categories: TrackingName1="NATURE OF ACCOUNT", TrackingName2="Categories/Projects". Both slots are in use by the company's existing Xero setup. The system reads and uses existing categories; it does not create new ones. | If company changes tracking category structure: update tracking_options cache and the name-to-option mapping table. This is configuration change only, not architectural. |
| R-15 | Phase 3 OCR accuracy too low for production use | Medium | High | MEDIUM | Phase 3 evaluation step (Week 13) tests multiple OCR providers before committing. Success threshold: 80% correct row extraction without correction. If no provider meets threshold, Phase 3 is deferred or replaced with a structured CSV import (lower effort). | Alternative to OCR: provide a downloadable Excel template matching the 5-column input format. Staff fills the template, uploads the file. This achieves the same batch efficiency without OCR risk. Estimated effort: 2 days (vs 17.5 days for full OCR). |
| R-16 | Single developer bus factor: knowledge concentrated in one implementer | Medium | High | MEDIUM | Architecture documents (this file, architecture_final.md, implementation_plan.md) capture all design decisions. Code comments explain non-obvious choices (token mutex, Fuse.js weights). | Onboard a second developer with these documents before Phase 2. Keep a developer journal of production incidents and fixes. |

---

## Top 5 Risks by Risk Level

| Priority | ID | Risk | Risk Level | Owner |
|---------|----|----|-----------|-------|
| 1 | R-01 | Access token expiry during submission | HIGH | Developer |
| 2 | R-04 | xero-node SDK deprecation/breaking change | HIGH | Developer |
| 3 | R-06 | Poor fuzzy match quality | HIGH | Developer + Staff |
| 4 | R-07 | SQLite data loss | HIGH | Developer + IT |
| 5 | R-11 | Staff creates wrong invoices | HIGH | Developer + Staff |

---

## Risk Review Log

| Date | Reviewer | Changes |
|------|---------|---------|
| 2026-03-10 | Architect | Initial version created |

---

## Key Monitoring Actions (Automated)

| Action | Frequency | Alert Condition |
|--------|-----------|----------------|
| Token health check (GET /api/xero/health) | Weekly (cron job) | Refresh token expires within 14 days |
| Daily API call counter | Daily | X-DayLimit-Remaining < 100 |
| Minute-rate monitor | Per API call | X-MinLimit-Remaining < 10 |
| SQLite backup | Daily | Backup file older than 25 hours |
| Pending invoices check | Every 5 minutes | Any row in created_invoices with status=PENDING_XERO |
| Next.js security advisories | Weekly | Manual review of GitHub security feed |
