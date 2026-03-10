# Compliance Notes - Xero Invoice Auto-Input System

**Date:** 2026-03-10
**Jurisdiction:** Malaysia (Johor Bahru), Xero API Terms

---

## 1. Xero API Terms of Use Compliance

### Applicable Terms
- [Xero App Terms and Conditions](https://developer.xero.com/documentation/guides/developer-terms-and-conditions/)
- [Xero Privacy Policy](https://www.xero.com/us/legal/privacy/)
- [Xero API Fair Use Policy](https://developer.xero.com/documentation/best-practices/api-call-efficiencies/)

### Key Requirements and Our Compliance

#### a. Single Tenant / Internal Tool Classification
This system connects to a single Xero organization (one company's Xero account). It is an internal business tool, not a multi-tenant SaaS application.

| Requirement | Our Approach | Status |
|------------|-------------|--------|
| App must not share one user's data with another | Single tenant only; all data belongs to the connected organization | Compliant |
| Apps must not violate Xero's data use restrictions | Data used only to create invoices in the connected account | Compliant |
| Must not use Xero data to train AI/ML models | Historical data (18,860 CSV records) was exported by the company from their own Xero account. Fuse.js uses it only for fuzzy string matching (not ML model training). | Compliant |
| Must not cache or store Xero data beyond operational need | Contacts and account codes are cached with TTLs (1h/24h) for rate limit efficiency. Invoice history pre-dates this system (company's own export). | Compliant |

#### b. OAuth2 Scope Minimization
We request only the minimum scopes required:
- `openid`, `profile`, `email` - required for Auth.js session
- `offline_access` - required for token refresh
- `accounting.transactions` - required to create invoices
- `accounting.contacts` - required to read contact list
- `accounting.settings` - required to read tracking categories

Scopes NOT requested (because not needed): `accounting.attachments`, `accounting.budgets`, `accounting.reports`, `payroll.*`

#### c. Granular Scope Migration
- Our app is being created on 2026-03-10, which is AFTER the March 2, 2026 cutoff.
- **Action Required:** We must use granular scopes from day one per Xero's policy.
- However, as of 2026-03-10, granular scopes are not yet available (available from April 2026 per Xero's announcement).
- **Resolution:** Start with broad scopes; migrate to `accounting.invoices` + `accounting.contacts` + `accounting.settings` immediately when granular scopes become available (target: May 2026).
- **Hard deadline:** September 2027 migration deadline per Xero.

#### d. Rate Limit Compliance
- We implement a request queue capped at 50 requests/minute (10 below the 60/min limit).
- Exponential backoff on HTTP 429 responses.
- We cache frequently read data (contacts, tracking categories) to minimize API calls.
- This is consistent with Xero's official best practices documentation.

#### e. App Tier
- This is an internal tool for a single organization.
- Under the March 2026 commercial tier model, a 1-connection internal app qualifies for the free Starter tier ($0 AUD/month).
- No commercial distribution is planned; this does not trigger any paid tier.

---

## 2. Malaysian Personal Data Protection Act (PDPA) 2010

### Applicability
The Malaysian Personal Data Protection Act 2010 (PDPA) applies to any person processing personal data in Malaysia for commercial purposes. This system processes:
- Contact names (property owners, tenants - individuals)
- Email addresses (where present in Xero contacts)
- Property addresses

### Data Processed

| Data Field | Personal Data? | Legal Basis |
|-----------|----------------|-------------|
| Contact name (owner/tenant) | Yes (individuals) | Contractual necessity (property management services) |
| Email address | Yes | Contractual necessity |
| Property address | Yes | Contractual necessity |
| Invoice amounts | Financial record, not personal data in isolation | Contractual necessity |
| Invoice dates | Not personal data | N/A |

### Compliance Obligations

#### a. Purpose Limitation (Section 6)
All personal data is processed solely for the purpose of creating and managing invoices for property management services. Data will not be used for any other purpose (e.g., marketing, profiling).

**Implementation:** SQLite `contacts_cache` and `invoice_history` tables contain only data needed for invoice matching. No behavioral or preference data is stored.

#### b. Disclosure (Section 7)
Data subjects (owners/tenants) were informed that their data is held by the property management company as part of their management agreement. The invoice system is an internal operational tool, not a third-party data processor requiring separate notification.

#### c. Security of Personal Data (Section 9)
Xero OAuth tokens are encrypted with AES-256-GCM before storage. The SQLite database file is stored locally on the company's own server (or authorized internal machine), not on a third-party cloud.

| Security Control | Implementation |
|-----------------|----------------|
| Access tokens encrypted | AES-256-GCM, key in env var never committed to git |
| Database access | Local SQLite file, restricted to application process |
| HTTPS | All connections to Xero API and browser are TLS 1.3 |
| Authentication | Auth.js v5 session with secure cookie (httpOnly, sameSite=strict) |
| No password storage | Xero handles authentication; no passwords stored locally |

#### d. Retention Limitation (Section 10)
The historical invoice data in `invoice_history` reflects the company's own historical records (exported from Xero). The `created_invoices` table is a local audit log of system activity.

**Retention Policy:**
- `contacts_cache`: Sync copy of live Xero data. Purged and rebuilt on sync.
- `created_invoices`: Retain 7 years (Malaysian accounting records requirement under the Income Tax Act 1967 and Companies Act 2016).
- `xero_tokens`: Delete on user deactivation or system decommission.

#### e. Right to Access and Correction (Sections 11-12)
Individuals can request access to or correction of their personal data by contacting the property management company directly. No special system feature is required for this internal tool; requests are handled operationally.

### PDPA Summary

| Principle | Status |
|-----------|--------|
| General principle (consent/legitimate interest) | Compliant - contractual necessity |
| Notice and choice | Compliant - within existing management agreement |
| Disclosure | Compliant - internal tool |
| Security | Compliant - AES-256-GCM, local storage, TLS |
| Retention | Compliant - 7-year policy for financial records |
| Data integrity | Compliant - data sourced from company's own Xero account |
| Access | Compliant - handled operationally |

---

## 3. API Key and Credential Security

### Credentials in Scope

| Credential | Storage | Access |
|-----------|---------|--------|
| XERO_CLIENT_ID | `.env.local` (never committed) | Server process only |
| XERO_CLIENT_SECRET | `.env.local` (never committed) | Server process only |
| ENCRYPTION_KEY (32-byte hex) | `.env.local` (never committed) | Server process only |
| NEXTAUTH_SECRET | `.env.local` (never committed) | Server process only |
| Xero Access Token | SQLite (AES-256-GCM encrypted) | TokenManager only |
| Xero Refresh Token | SQLite (AES-256-GCM encrypted) | TokenManager only |

### Key Security Rules

1. `.env.local` must be listed in `.gitignore`. Never commit credentials.
2. `ENCRYPTION_KEY` must be generated with `openssl rand -hex 32` and stored securely outside the codebase (password manager, 1Password, etc.).
3. Rotate `ENCRYPTION_KEY` if the server or git repository is believed to be compromised. All stored tokens must be re-encrypted after rotation.
4. The Xero Developer Portal client secret should be rotated annually or immediately if compromised.
5. The `xero_tokens` table should be accessible only to the application database user. Apply OS-level file permissions to the SQLite file (owner read/write only: `chmod 600 app.db`).
6. No credential should appear in server logs, error messages, or API responses. Use structured logging with a field allowlist.

### Secret Rotation Procedure

```
1. Generate new ENCRYPTION_KEY: openssl rand -hex 32
2. Run migration script: decrypt all xero_tokens with old key, re-encrypt with new key
3. Update .env.local with new ENCRYPTION_KEY
4. Restart application
5. Verify token refresh still works (GET /api/xero/health)
6. Destroy old key material
```

---

## 4. Token Storage Security

### AES-256-GCM Implementation

The token storage uses AES-256-GCM with the following properties:

| Property | Value |
|---------|-------|
| Algorithm | AES-256-GCM (AEAD) |
| Key length | 256 bits (32 bytes) |
| IV length | 96 bits (12 bytes, randomly generated per encryption) |
| Auth tag length | 128 bits (16 bytes) |
| Key source | `ENCRYPTION_KEY` environment variable |
| Storage format | base64(IV + AuthTag + Ciphertext) |

GCM mode provides both encryption and authentication. Any tampering with the stored ciphertext will be detected when decrypting (auth tag verification failure). This prevents an attacker who can write to the database from substituting a different token.

### What is NOT Encrypted
- `tenant_id`, `tenant_name`, `expires_at`, `updated_at` in `xero_tokens` - these are not sensitive credentials.
- The `expires_at` field stored in plain text allows the TokenManager to check expiry without decryption.

### Session Security (Auth.js)
- Auth.js v5 uses encrypted JWT by default (signed with NEXTAUTH_SECRET, using JWE if configured).
- Session cookies use `HttpOnly`, `Secure`, `SameSite=Lax` attributes.
- Session max age should be set to match the active working day (8-10 hours).

---

## 5. Summary Compliance Checklist

| Area | Requirement | Status |
|------|------------|--------|
| Xero ToS | Scope minimization | Compliant |
| Xero ToS | Rate limit respect | Compliant |
| Xero ToS | No ML training on Xero data | Compliant |
| Xero ToS | Granular scopes migration by Sep 2027 | Planned - migrate May 2026 |
| Xero ToS | Single tenant (internal app) | Compliant |
| PDPA | Purpose limitation | Compliant |
| PDPA | Security | Compliant (AES-256-GCM) |
| PDPA | Retention | Compliant (7-year policy) |
| PDPA | Data subject rights | Compliant (handled operationally) |
| Security | No credentials in code | Compliant (.env.local + .gitignore) |
| Security | Token encryption | Compliant (AES-256-GCM) |
| Security | HTTPS | Compliant (TLS for all external calls) |
| Security | CVE patches | Compliant (Next.js >= 15.2.3) |
