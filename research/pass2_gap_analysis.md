# Pass 2 Gap Analysis - Xero API Integration Invoice System

**Date:** 2026-03-10
**Build Target:** Xero API連携インボイス自動入力システム

---

## 1. xero-node SDK vs Direct REST API

### Resolution: USE xero-node SDK v14.0.0

**Finding:** Agent B was incorrect. xero-node v14.0.0 exists (released March 5, 2025).

| Version | Release Date |
|---------|-------------|
| 14.0.0  | 2025-03-05  |
| 13.4.0  | 2025-01-28  |
| 13.3.1  | 2025-01-06  |
| 13.3.0  | 2024-11-17  |

**Deprecation Notice:** Only the Employee endpoints (CreateEmployeesAsync, GetEmployeeAsync etc.) are deprecated by April 28, 2026. The SDK itself is NOT deprecated.

**Next.js Compatibility:** Known issue ([#543](https://github.com/XeroAPI/xero-node/issues/543)) - `fs` module error from `got` dependency. Solution: xero-node must ONLY be used in server-side code (API Routes / Route Handlers / Server Actions). No webpack config needed if properly isolated to server-side.

**Decision: Use xero-node v14.0.0 in Next.js API Routes/Route Handlers only.**

- Install: `npm i xero-node@14.0.0`
- NEVER import xero-node in client components
- All Xero calls go through `/app/api/xero/` route handlers

Sources:
- [xero-node npm](https://www.npmjs.com/package/xero-node)
- [GitHub Releases](https://github.com/XeroAPI/xero-node/releases)
- [Issue #543 - Next.js webpack](https://github.com/XeroAPI/xero-node/issues/543)

---

## 2. Granular Scopes (新スコープ)

### Resolution: Use BROAD scopes now, migrate later

**Timeline:**
| Date | Event |
|------|-------|
| 2026-03-02 | Apps created ON/AFTER this date MUST use granular scopes |
| 2026-04 | Granular scopes available for existing apps |
| 2027-09 | Deadline for all apps to migrate |

**Our app was created BEFORE March 2, 2026** → We can continue using broad scopes until September 2027.

**Current Broad Scopes to Use:**
```
openid profile email
offline_access
accounting.transactions
accounting.contacts
accounting.settings
```

**Granular Scopes (for future migration):**
- `accounting.transactions` will split into: `accounting.transactions.invoices`, `accounting.transactions.creditnotes`, etc.
- `accounting.contacts` and `accounting.settings` scopes are NOT changing per Xero's announcement.

**Recommendation:** Start with broad scopes. Plan migration to granular scopes by mid-2027.

Sources:
- [Upcoming Changes to Xero Accounting API Scopes (Feb 2026)](https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0)
- [Xero Scopes Documentation](https://developer.xero.com/documentation/guides/oauth2/scopes/)
- [Xero Developer FAQ](https://developer.xero.com/faq)

---

## 3. Auth.js v5 Xero Provider

### Resolution: No built-in provider. Use custom OIDC provider.

**There is NO existing Xero provider in Auth.js/NextAuth.js.** Must create a custom one.

**Xero supports OpenID Connect.** The well-known configuration is at:
```
https://identity.xero.com/.well-known/openid-configuration
```

**Key Endpoints (verified):**
| Endpoint | URL |
|----------|-----|
| Issuer | `https://identity.xero.com` |
| Authorization | `https://login.xero.com/identity/connect/authorize` |
| Token | `https://identity.xero.com/connect/token` |
| UserInfo | `https://identity.xero.com/connect/userinfo` |
| Revocation | `https://identity.xero.com/connect/revocation` |

**Supported grant types:** `authorization_code`, `client_credentials`, `refresh_token`, `delegation`
**Auth methods:** `client_secret_basic`, `client_secret_post`

**Auth.js v5 Custom Provider Configuration:**
```typescript
// auth.ts
import NextAuth from "next-auth"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "xero",
      name: "Xero",
      type: "oidc",
      issuer: "https://identity.xero.com",
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid profile email offline_access accounting.transactions accounting.contacts accounting.settings",
        },
      },
      // Xero tokens expire in 30 minutes - must handle refresh
      token: {
        url: "https://identity.xero.com/connect/token",
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        // Xero requires tenant selection after auth
        // Store tenantId after /connections call
      }
      return token
    },
  },
})
```

**Important Notes:**
- Xero access tokens expire after **30 minutes**
- After OAuth, must call `GET https://api.xero.com/connections` to get tenantId
- Must implement token refresh logic (refresh_token grant)

Sources:
- [Auth.js Custom OAuth Provider Guide](https://authjs.dev/guides/configuring-oauth-providers)
- [Xero OAuth 2.0 Overview](https://developer.xero.com/documentation/guides/oauth2/overview/)
- [Xero Auth Flow](https://developer.xero.com/documentation/guides/oauth2/auth-flow/)

---

## 4. Xero API Invoice Creation - Exact Fields

### POST /api.xro/2.0/Invoices

**Complete JSON Structure:**
```json
{
  "Invoices": [
    {
      "Type": "ACCPAY",
      "Contact": {
        "ContactID": "00000000-0000-0000-0000-000000000000"
      },
      "Date": "2026-03-10",
      "DueDate": "2026-04-10",
      "InvoiceNumber": "INV-001",
      "Reference": "Project ABC / Unit 17-07",
      "Status": "DRAFT",
      "LineAmountTypes": "Exclusive",
      "LineItems": [
        {
          "Description": "Cleaning service - March 2026",
          "Quantity": 1.0,
          "UnitAmount": 150.00,
          "AccountCode": "200",
          "TaxType": "OUTPUT",
          "Tracking": [
            {
              "TrackingCategoryID": "00000000-0000-0000-0000-000000000000",
              "TrackingOptionID": "00000000-0000-0000-0000-000000000000"
            }
          ]
        }
      ]
    }
  ]
}
```

**Field Details:**

| Field | Required | Notes |
|-------|----------|-------|
| Type | Yes | `ACCPAY` (bills/payable) or `ACCREC` (sales/receivable) |
| Contact | Yes | Must include `ContactID` (UUID). Can also use `Name` for auto-match |
| Date | Recommended | Invoice date. Defaults to today if omitted |
| DueDate | Optional | Can be set explicitly OR auto-calculated from Contact's payment terms |
| InvoiceNumber | Optional | **Omitting auto-generates from Organisation Invoice Settings** |
| Reference | Optional | Free text reference field |
| Status | Optional | `DRAFT` (default), `SUBMITTED`, `AUTHORISED` |
| LineAmountTypes | Optional | `Exclusive`, `Inclusive`, `NoTax` |

**TrackingCategories in LineItems:**
- Tracking is set at the **LineItem level**, not invoice level
- Each LineItem can have up to 2 TrackingCategories
- Requires both `TrackingCategoryID` and `TrackingOptionID` (UUIDs)
- Alternative: Can use `Name` and `Option` strings instead of IDs

```json
"Tracking": [
  {
    "Name": "Region",
    "Option": "Iskandar"
  },
  {
    "Name": "Project",
    "Option": "Suasana 17-07"
  }
]
```

**DueDate Behavior:**
- If set explicitly: uses the provided date
- If omitted: auto-calculated from the Contact's default payment terms
- If Contact has no payment terms: defaults to invoice date

Sources:
- [Xero Invoices API](https://developer.xero.com/documentation/api/accounting/invoices)
- [Xero TrackingCategories API](https://developer.xero.com/documentation/api/accounting/trackingcategories)
- [Creating Invoices Best Practices](https://developer.xero.com/documentation/best-practices/data-integrity/creating-invoices)

---

## 5. Token Encryption Best Practice

### Resolution: AES-256-GCM with node:crypto

**AES-256-GCM is the correct choice.** It provides both encryption AND authentication (AEAD).

**Implementation:**
```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // 96 bits recommended for GCM
const TAG_LENGTH = 16 // 128 bits

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as: iv + tag + ciphertext (all base64)
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(encoded: string, key: Buffer): string {
  const data = Buffer.from(encoded, 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}
```

**Key Management:**
| Approach | Recommendation |
|----------|---------------|
| Key source | `ENCRYPTION_KEY` env var (32 bytes hex = 64 chars) |
| Key generation | `openssl rand -hex 32` |
| Key storage | `.env.local` (never committed) |
| In production | Use platform secret management (Vercel env, AWS Secrets Manager) |

**SQLite Schema for Token Storage:**
```sql
CREATE TABLE xero_tokens (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Why AES-256-GCM over alternatives:**
- GCM provides authentication tag (detects tampering) - CBC does not
- GCM is faster (parallelizable) than CBC
- No padding oracle attacks (unlike CBC)
- Built into Node.js crypto - no extra dependencies

Sources:
- [Node.js Crypto AES-256-GCM Gist](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81)
- [Node.js AES-GCM with IV + Salt](https://gist.github.com/AndiDittrich/4629e7db04819244e843)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)

---

## 6. Xero Contacts API - Search by Name

### Resolution: Use WHERE filter with Name.Contains()

**API Endpoint:** `GET /api.xro/2.0/Contacts`

**Search Methods:**

```
// Exact match
GET /api.xro/2.0/Contacts?where=Name=="Suasana Iskandar Malaysia"

// Contains (partial match - RECOMMENDED)
GET /api.xro/2.0/Contacts?where=Name.Contains("Suasana")

// Starts with
GET /api.xro/2.0/Contacts?where=Name.StartsWith("Suasana")

// Search parameter (simpler, searches across Name, AccountNumber, ContactNumber, etc.)
GET /api.xro/2.0/Contacts?searchTerm=Suasana
```

**Matching Strategy for "Suasana Iskandar 17-07 Nur Nadzira":**

The project name + unit format needs to be mapped to a Xero Contact. Strategy:

1. **Lookup Table Approach (Recommended):**
   - Maintain a local SQLite mapping table: `project_unit` → `xero_contact_id`
   - Pre-populate from Xero Contacts list
   - Cache and periodically sync

2. **Dynamic Search Approach:**
   - Extract project name ("Suasana Iskandar")
   - Use `Name.Contains("Suasana Iskandar")` to find matches
   - Present matches to user if multiple results

3. **Hybrid:** Cache + fallback to API search

**Special Characters:** Double quotes in contact names must be escaped with `""`:
```
Name.Contains("The ""Quote"" Company")
```

**Performance Note:** Complex WHERE queries can timeout on large organizations. Keep queries simple (use `==` when possible).

Sources:
- [Xero Contacts API](https://developer.xero.com/documentation/api/accounting/contacts)
- [Xero Community - Finding Contacts](https://community.wappler.io/t/request-for-help-regarding-xero-api-how-to-use-where-to-find-a-contact-in-xero/53973)

---

## Summary Decision Matrix

| Topic | Decision | Confidence |
|-------|----------|------------|
| SDK Choice | xero-node v14.0.0 (server-side only) | HIGH |
| Scopes | Broad scopes now, granular later (before 2027-09) | HIGH |
| Auth | Auth.js v5 custom OIDC provider with issuer=identity.xero.com | HIGH |
| Invoice Fields | POST /Invoices with Tracking at LineItem level | HIGH |
| Token Encryption | AES-256-GCM via node:crypto, key from env var | HIGH |
| Contact Search | Name.Contains() + local cache table | HIGH |
