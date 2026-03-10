# Step 1: Intelligence Report - Xero Invoice Auto-Input System

**Date:** 2026-03-10
**Purpose:** Research findings to inform architecture and implementation decisions

---

## 1. Xero API Latest Changes 2025-2026

### Key Findings

#### Granular Scopes Migration (Critical)
- **Apps created on/after 2 March 2026** must use new granular scopes immediately
- Existing apps must migrate by **September 2027** (granular scopes available from April 2026)
- Broad `accounting.transactions` scope is being split into:
  - `accounting.invoices` / `accounting.invoices.read` (covers invoices, credit notes, linked transactions, purchase orders, quotes, repeating invoices, items)
  - `accounting.payments` / `accounting.payments.read`
  - `accounting.banktransactions` / `accounting.banktransactions.read`
  - `accounting.manualjournals` / `accounting.manualjournals.read`
- Scopes for settings, contacts, attachments, and budgets are **not changing**
- Source: [Upcoming changes to Xero Accounting API Scopes](https://devblog.xero.com/upcoming-changes-to-xero-accounting-api-scopes-705c5a9621a0)
- Source: [Scopes Documentation](https://developer.xero.com/documentation/guides/oauth2/scopes/)

#### API Deprecations & Decommissions

| API / Endpoint | Deadline | Impact |
|---|---|---|
| Accounting Activities API | April 6, 2026 | Account Usage, Lock History, Report History, User Activities endpoints disabled |
| Classic Expenses API (ExpenseClaims) | February 2026 | Endpoint access disabled |
| Employees Endpoint (Accounting API) | Early 2026 | Deprecated due to global Payrun product discontinuation |

- Source: [Xero Changelog](https://developer.xero.com/changelog)
- Source: [Xero November 2025 Updates](https://www.oreateai.com/blog/xeros-november-2025-updates-navigating-api-changes-and-enhancements/fac63bc7498dae1daef48c55eb9ebcce)

#### Other Notable Changes (2025)
- **Tracking Categories**: 100-character limit enforced for option names (Feb 2025)
- **AU Payroll POST PayRuns**: Now single pay run per request only (Nov 2025)
- **Credit Notes Webhooks**: New webhook schema for credit notes (closed beta, Dec 2025)
- **Account Deletion**: Accounts with payment services can no longer be deleted via API
- **App Tier Changes**: Commercial tiering model based on connections and API usage effective 2 March 2026

### Relevance to Our Project
- **CRITICAL**: Since our app will be created after March 2, 2026, we MUST use granular scopes from day one
- Required scopes: `accounting.invoices`, `accounting.contacts.read`, `accounting.settings.read` (for tracking categories)
- The Activities API deprecation does not impact our invoice creation use case
- Tracking category 100-char limit is relevant for property names

### Risks
- Granular scopes are brand new; documentation and SDK support may have edge cases
- API data cannot be used to train AI/ML models (policy restriction)
- Commercial tier changes may affect cost at scale

---

## 2. xero-node SDK Latest Version and Updates

### Key Findings

- **Latest version**: `14.0.0` (released March 5, 2025)
  - Added 2.0 endpoints for Timesheets in AU Payroll
  - Removed Accounting Activities Finance API
  - Added QualifyingEarnings for AU payroll
- **Previous version**: `13.4.0` (January 28, 2025)
  - Credit notes webhooks schema additions
- **Package**: `npm i xero-node` (NOT `xero-node-sdk` which is discontinued)
- **Deprecation notice**: Migration to supported alternatives before **April 28, 2026**
- Source: [xero-node npm](https://www.npmjs.com/package/xero-node)
- Source: [xero-node GitHub Releases](https://github.com/XeroAPI/xero-node/releases)

### Relevance to Our Project
- Use `xero-node@14.0.0` as our SDK
- SDK is auto-generated from Xero-OpenAPI spec, so granular scopes should work transparently
- The April 2026 deprecation notice needs monitoring - may indicate a v15 migration or new SDK approach

### Risks
- Deprecation notice for April 28, 2026 suggests possible breaking changes or SDK restructuring
- Need to watch for SDK updates supporting granular scopes natively

---

## 3. Next.js 15 + Accounting API Integration Best Practices

### Key Findings

#### Route Handlers (App Router)
- Define API endpoints in `route.ts` files exporting HTTP method handlers (GET, POST, PUT, DELETE)
- Use standard Web Request/Response APIs
- In Next.js 15+, GET handlers default to **dynamic (uncached)**; opt into caching with `export const revalidate = <seconds>`
- Source: [Next.js API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)
- Source: [Building APIs with Next.js](https://nextjs.org/blog/building-apis-with-nextjs)

#### Security Best Practices
- Never hardcode API keys; use environment variables
- Validate and sanitize all external API data
- Use CORS to restrict API access to trusted domains
- Verify webhook signatures from providers
- Source: [Next.js API Best Practices 2025](https://medium.com/@lior_amsalem/nextjs-api-best-practice-2025-250c0a6514b9)

#### Rate Limiting
- Implement rate limiting middleware to protect against abuse
- Use libraries like `next-rate-limit` or custom token bucket implementations

#### Server Actions for External APIs
- Next.js Server Actions can call external APIs directly from server components
- Useful for form submissions that trigger Xero API calls
- Source: [Auth0: Using Next.js Server Actions to Call External APIs](https://auth0.com/blog/using-nextjs-server-actions-to-call-external-apis/)

### Relevance to Our Project
- Use App Router with Route Handlers for Xero OAuth callbacks and API proxy endpoints
- Server Actions for invoice creation forms
- Environment variables for Xero client_id/client_secret
- Implement rate limiting middleware to avoid hitting Xero API limits

### Risks
- Token management across server components requires careful session/state handling
- Server Actions are POST-only; need Route Handlers for OAuth redirect flows

---

## 4. Invoice Automation Competitors

### Key Findings

| Tool | Xero Rating | Pricing (Business) | Key Strength | Key Weakness |
|---|---|---|---|---|
| **Datamolino** | 4.9 stars | £17-55/mo (100-500 docs) | Line items included, PDF auto-split, unlimited users | Smaller brand recognition |
| **Dext Prepare** | 4.8 stars | £28.75-56.25/mo (250-500 docs) | High-volume per-client pricing | User limits, expensive at scale |
| **AutoEntry** | 4.7 stars | £23-99/mo (100-500 docs) | Pay-per-credit flexibility | Bank statements cost 2x, acquired by Sage |
| **Hubdoc** | 3.3 stars | Free with Xero | Included in Xero subscription | Limited features, poor reviews, no line items |

#### Accountancy Firm Pricing (70 clients, 3,500 docs/month)
- Datamolino: £560/mo
- AutoEntry: £595/mo
- Dext Prepare: £730.20/mo
- Hubdoc: Not suitable at this scale

- Source: [Datamolino 2026 Comparison](https://www.datamolino.com/blog/pricing-and-features-autoentry-vs-hubdoc-vs-dext-vs-datamolino-in-2026/)
- Source: [Dext vs Hubdoc](https://www.fahimai.com/dext-vs-hubdoc)
- Source: [Best Invoice Data Extraction Software 2026](https://www.gotofu.com/blog/best-invoice-data-extraction-software)

### Relevance to Our Project
- Our system differentiates by being **purpose-built for property management** with Xero integration
- Competitors are generic OCR/data-entry tools; we can add property-specific logic (tracking categories for properties, recurring tenant invoices)
- Hubdoc being free with Xero is a baseline competitor; we must offer significantly more value
- None of these tools offer deep property management workflow integration

### Risks
- Dext and Datamolino have strong OCR capabilities we would need to match or integrate with
- If we later add OCR, we compete directly with established players

---

## 5. Property Management Accounting Automation Trends 2026

### Key Findings

- **Market size**: USD 6.53 billion in 2026, projected USD 9.93 billion by 2031 (8.74% CAGR)
- **Cloud dominance**: Cloud-based solutions account for 60%+ market share
- **AI as standard**: AI-driven reporting and automation becoming table stakes
- **Integration trend**: All-in-one platforms replacing fragmented tools; leasing workflows connecting directly to accounting
- **Compliance drivers**: ASC 842 and IFRS 16 lease accounting standards driving adoption in NA and Europe
- **Key players**: AppFolio (#1), Buildium, Entrata, Rent Manager
- Source: [Property Management Software Market](https://www.mordorintelligence.com/industry-reports/property-management-software-market)
- Source: [Property Management Accounting Software Boom 2026](https://www.exoedge.com/2025/12/26/the-future-of-real-estate-operations/)
- Source: [Best Property Management Software 2026](https://www.appfolio.com/blog/best-property-management-softwares-compared-2026)

### Relevance to Our Project
- Strong market tailwind for property management automation
- Gap exists for lightweight Xero-native solutions (major players are full platforms)
- Our tool fills the niche between full property management platforms and generic invoice tools
- Automated invoicing with tracking categories maps directly to the "integrated accounting" trend

### Risks
- Large platforms (AppFolio, Buildium) may add deeper Xero integration
- Market expects AI capabilities as standard in 2026

---

## 6. Xero API Rate Limits and Bulk Invoice Best Practices

### Key Findings

#### Rate Limits (per tenant, per app)

| Limit Type | Value | Scope |
|---|---|---|
| Concurrent | 5 API calls in progress | Per tenant, per app |
| Per Minute | 60 calls | Per tenant, per app |
| Per Day | 5,000 calls | Per tenant, per app |
| App-Wide Minute | 10,000 calls | Across all tenants |

#### Response Headers
- `X-DayLimit-Remaining` - remaining daily calls
- `X-MinLimit-Remaining` - remaining minute calls
- `X-AppMinLimit-Remaining` - remaining app-wide minute calls
- Exceeding limits returns **HTTP 429**

#### Bulk Invoice Creation Strategy
- Batch up to **50 invoices per request** (practical ceiling; max request size 3.5MB)
- Theoretical daily capacity: ~833 invoices (assuming 6 API calls per invoice)
- Use POST/PUT Invoices endpoint with array of invoice objects
- Cache frequently accessed data (contacts, tracking categories) locally
- Use webhooks for real-time updates instead of polling

- Source: [Xero Rate Limits](https://developer.xero.com/documentation/best-practices/api-call-efficiencies/rate-limits)
- Source: [OAuth 2.0 API Limits](https://developer.xero.com/documentation/guides/oauth2/limits/)
- Source: [Xero API Rate Limits Guide](https://coefficient.io/xero-api/xero-api-rate-limits)
- Source: [Xero Invoices Sync Limits](https://satvasolutions.com/blog/xero-invoices-sync-api-limits-guide)

### Relevance to Our Project
- Property management typically handles dozens to low hundreds of invoices per month - well within limits
- Batch 50 invoices per API call for efficiency
- Implement rate limit tracking using response headers
- Cache contacts and tracking categories to reduce API calls

### Risks
- 60 calls/minute is tight for real-time interactive use
- Need exponential backoff strategy for 429 responses
- Daily limit of 5,000 may constrain large property portfolios during month-end

---

## 7. OAuth2 Token Refresh Patterns for Xero

### Key Findings

#### Token Lifetimes
- **Access token**: 30 minutes
- **Refresh token**: 60 days (rolling; refreshed each time it's used)

#### Refresh Flow
1. POST to `https://identity.xero.com/connect/token`
2. Include `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token`
3. Replace stored refresh token with new one from response
4. **Grace period**: If response is lost, old refresh token remains valid for 30 minutes

#### Implementation Pattern
- Store token set (access_token, refresh_token, expiry, tenant_id) in database per user
- Before each API call: check if access_token is expired, refresh if needed
- The xero-node SDK provides built-in token refresh support
- Implement a token refresh middleware/wrapper that handles refresh transparently

- Source: [Xero OAuth2 Auth Flow](https://developer.xero.com/documentation/guides/oauth2/auth-flow/)
- Source: [Xero Token Types](https://developer.xero.com/documentation/guides/oauth2/token-types)
- Source: [Xero OAuth2 FAQ](https://developer.xero.com/faq/oauth2)

### Relevance to Our Project
- Must implement persistent token storage (database, not session/memory)
- Proactive refresh strategy: refresh 5 minutes before expiry to avoid failed API calls
- Handle concurrent refresh requests (mutex/lock to prevent multiple simultaneous refreshes)
- 60-day refresh token expiry means users must re-authenticate if inactive for 2 months

### Risks
- If refresh token expires (60-day inactivity), user must re-authorize from scratch
- Concurrent requests can cause race conditions on token refresh
- Token storage requires encryption at rest for security

---

## 8. Xero Tracking Categories API Usage

### Key Findings

#### API Endpoints
- `GET /api.xro/2.0/TrackingCategories` - List all tracking categories
- `PUT /api.xro/2.0/TrackingCategories` - Create a tracking category
- `POST /api.xro/2.0/TrackingCategories/{TrackingCategoryID}` - Update a tracking category
- `DELETE /api.xro/2.0/TrackingCategories/{TrackingCategoryID}` - Delete a tracking category
- Options (sub-items) managed via nested endpoints

#### Limits
- Maximum **2 active tracking categories** per Xero organization
- **100-character limit** on tracking option names (enforced since Feb 2025, returns 400 error)

#### Usage in Invoices
- Tracking is applied at the **line item level**, not invoice level
- Each line item can have up to 2 tracking category options (one per active category)
- Specify `TrackingCategoryID` and `TrackingOptionID` in the `Tracking` array of each line item

#### Example Structure
```json
{
  "LineItems": [{
    "Description": "Rent",
    "Quantity": 1,
    "UnitAmount": 1500.00,
    "AccountCode": "200",
    "Tracking": [{
      "TrackingCategoryID": "xxx-xxx",
      "TrackingOptionID": "yyy-yyy"
    }]
  }]
}
```

- Source: [Tracking Categories API](https://developer.xero.com/documentation/api/accounting/trackingcategories)
- Source: [Tracking Category Mapping Best Practices](https://developer.xero.com/documentation/best-practices/categorising-transactions/tracking-category-mapping/)

### Relevance to Our Project
- Use tracking categories for **property identification** (e.g., "Property" tracking category with options like "Building A", "Building B")
- Second tracking category available for another dimension (e.g., "Cost Centre", "Department")
- Must cache tracking categories/options locally - they change infrequently
- 100-char limit accommodates most property names
- Max 2 tracking categories is a hard Xero limitation; plan property taxonomy accordingly

### Risks
- Only 2 tracking categories available - if client already uses both, no room for property tracking
- Property names over 100 characters will be rejected
- Tracking options cannot be easily bulk-created; need to build them one-by-one

---

## Summary: Architecture Implications

### Must-Have Requirements
1. **Granular OAuth2 scopes** from day one (`accounting.invoices`, `accounting.contacts.read`, `accounting.settings.read`)
2. **xero-node v14.0.0** with token persistence in database
3. **Batch invoice creation** (up to 50 per request) with rate limit tracking
4. **Tracking category caching** with property-to-option mapping
5. **Proactive token refresh** with mutex to prevent race conditions

### Architecture Recommendations
- Next.js 15 App Router with Route Handlers for OAuth and API proxy
- Server Actions for invoice creation workflows
- Database-backed token storage with encryption
- Local cache layer for contacts, tracking categories, account codes
- Rate limit middleware using Xero response headers
- Exponential backoff for 429 responses

### Key Constraints
- 60 API calls/minute, 5,000/day per tenant
- Max 2 tracking categories per Xero org
- 50 invoices per batch request (3.5MB limit)
- 30-min access token, 60-day refresh token
- 100-char tracking option name limit
