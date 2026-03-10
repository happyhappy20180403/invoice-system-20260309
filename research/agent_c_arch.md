# Agent C: Architecture & Trend Research Report

## 1. Next.js 15 App Router Architecture Patterns

### Server Actions vs Route Handlers

| Aspect | Server Actions | Route Handlers |
|--------|---------------|----------------|
| Use Case | App-internal mutations (form submit, data fetch) | External endpoints, webhooks, OAuth callbacks |
| CSRF | Built-in protection | Manual implementation required |
| Invocation | Direct function call from components | HTTP request (GET/POST/etc.) |
| External Access | Not callable from outside | Accessible via URL |

**Recommendation for this system:**
- **Server Actions**: Fuzzy search, invoice creation, data validation (all internal UI operations)
- **Route Handlers**: Xero OAuth2 callback (`/api/auth/xero/callback`), Xero webhooks (`/api/webhooks/xero`)

### Token Management Strategy

**Proactive refresh with mutex lock (recommended):**

```
Token Refresh Flow:
1. Before each Xero API call, check token expiry
2. If token expires within 5 minutes → trigger refresh
3. Use mutex lock to prevent concurrent refresh (critical for rotating refresh tokens)
4. Store tokens in DB (encrypted), cache in memory
5. If refresh fails → redirect user to re-authorize
```

**Why NOT middleware:**
- Next.js middleware runs in parallel for multiple server components
- Xero uses rotating refresh tokens (one-time use) → race conditions are fatal
- Middleware cannot write to DB reliably

Sources:
- [Next.js Route Handlers and Middleware](https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware)
- [Next.js Server Actions vs API Routes](https://dev.to/myogeshchavan97/nextjs-server-actions-vs-api-routes-dont-build-your-app-until-you-read-this-4kb9)
- [Vercel Discussion: Server Actions vs Route Handlers](https://github.com/vercel/next.js/discussions/72919)
- [Next.js Discussion: Token Refresh in Middleware](https://github.com/vercel/next.js/discussions/78604)

---

## 2. Open-Source Project & Community Research

### Relevant GitHub Projects

| Project | Description | Relevance |
|---------|-------------|-----------|
| [XeroAPI/xero-node](https://github.com/XeroAPI/xero-node) | Official Xero Node SDK (OAuth2) | Core dependency |
| [XeroAPI/xero-node-oauth2-app](https://github.com/XeroAPI/xero-node-oauth2-app) | Official OAuth2 demo app (Express) | Reference for auth flow |
| [XeroAPI/node-oauth2-example](https://github.com/XeroAPI/node-oauth2-example) | Minimal OAuth2 example without SDK | Lightweight reference |
| [XeroAPI/Xero-OpenAPI](https://github.com/XeroAPI/Xero-OpenAPI) | OpenAPI specs for all Xero APIs | Type generation reference |

### Key Finding
No production-grade Next.js + Xero integration exists as open source. All official examples use Express. This project will be somewhat pioneering in the Next.js App Router + xero-node space.

### Fuzzy Search Libraries

| Library | Speed | Best For |
|---------|-------|----------|
| [Fuse.js](https://www.fusejs.io/) | Good for <10K items | Weighted multi-field fuzzy search |
| [quickfuzz](https://littleboy9.github.io/quickfuzz/) | <0.2ms/1K items | Simple label matching |
| [microfuzz](https://github.com/Nozbe/microfuzz) | Very fast, tiny bundle | Autocomplete lists |

**Recommendation**: Fuse.js for this project (18,860 records, multi-field weighted search on Project + Unit + Detail).

---

## 3. Optimal Architecture Design

### Data Flow

```
Staff Input (5 fields)
    ↓
[Server Action] Fuzzy Match Engine
    ├── Historical DB (SQLite/Prisma) → Project/Unit/Detail matching
    ├── Cached Xero Contacts → Contact auto-resolution
    └── Cached Xero Accounts → Account code auto-mapping
    ↓
Auto-filled Invoice Preview (UI)
    ↓ (Staff confirms)
[Server Action] Create Invoice
    ├── Token Manager → Get valid access token (proactive refresh)
    └── xero-node SDK → POST to Xero API
    ↓
Success/Error Response → UI Update
```

### Token Refresh Strategy: Proactive with Mutex

```typescript
// Pseudocode
class TokenManager {
  private mutex = new Mutex();

  async getValidToken(tenantId: string): Promise<string> {
    const tokenSet = await db.getTokenSet(tenantId);

    // Proactive: refresh if expiring within 5 minutes
    if (tokenSet.expiresAt < Date.now() + 5 * 60 * 1000) {
      return this.mutex.runExclusive(async () => {
        // Re-check after acquiring lock (another request may have refreshed)
        const freshSet = await db.getTokenSet(tenantId);
        if (freshSet.expiresAt > Date.now() + 5 * 60 * 1000) {
          return freshSet.accessToken;
        }
        // Perform refresh
        const newTokenSet = await xeroClient.refreshToken(freshSet.refreshToken);
        await db.saveTokenSet(tenantId, newTokenSet);
        return newTokenSet.accessToken;
      });
    }
    return tokenSet.accessToken;
  }
}
```

**Key Points:**
- Xero rotating refresh tokens = each refresh token is one-time use
- Mutex prevents concurrent refresh race conditions
- 5-minute buffer avoids mid-request expiration
- DB storage ensures persistence across server restarts

### Caching Strategy

| Data | Cache Location | TTL | Refresh Trigger |
|------|---------------|-----|-----------------|
| Xero Contacts | Next.js `unstable_cache` + memory | 1 hour | On-demand + background |
| Xero Accounts (Chart of Accounts) | Memory (rarely changes) | 24 hours | Manual/daily |
| Tracking Categories | Memory | 24 hours | Manual/daily |
| Historical Invoice Data | SQLite (persistent) | N/A | Bulk import on setup, incremental sync |
| Fuzzy Search Index | In-memory (Fuse.js instance) | Until rebuild | On historical data update |

**Rate Limit Awareness:**
- 60 calls/min, 5 concurrent/sec → batch reads at startup, cache aggressively
- Use `If-Modified-Since` header where supported to reduce payload
- Queue invoice creation requests to stay within limits

### Historical Data Lookup Optimization

```
18,860 records → Fuse.js in-memory index

Index fields (weighted):
  - Project Name: weight 2.0
  - Unit No: weight 1.5
  - Detail: weight 1.0

Strategy:
1. On server start: load all records into Fuse.js index
2. On input change: Server Action queries Fuse.js (sub-10ms)
3. Return top 5 matches with pre-filled fields (Contact, Account, Tax, etc.)
4. Staff selects best match → all fields auto-populated
```

---

## 4. Architecture Diagram

See: `research/architecture.mermaid` (C4 Context Diagram)

### Component Summary

```
┌─────────────────────────────────────────────────────┐
│  Client Layer                                        │
│  ┌──────────────┐  ┌──────────────────┐             │
│  │ Input Form   │→ │ Invoice Preview  │             │
│  │ (5 fields)   │  │ (auto-filled)    │             │
│  └──────┬───────┘  └────────┬─────────┘             │
├─────────┼───────────────────┼───────────────────────┤
│  Server Actions             │                        │
│  ┌──────┴───────┐  ┌───────┴────────┐              │
│  │ Fuzzy Match  │  │ Create Invoice │              │
│  └──────┬───────┘  └───────┬────────┘              │
├─────────┼───────────────────┼───────────────────────┤
│  Service Layer              │                        │
│  ┌──────┴───────┐  ┌───────┴────────┐              │
│  │ Match Engine │  │ Xero Service   │              │
│  │ (Fuse.js)   │  │ (xero-node)    │              │
│  └──────┬───────┘  └───────┬────────┘              │
│         │          ┌───────┴────────┐              │
│         │          │ Token Manager  │              │
│         │          │ (mutex+proact) │              │
│         │          └───────┬────────┘              │
├─────────┼───────────────────┼───────────────────────┤
│  Data Layer                 │                        │
│  ┌──────┴───────┐  ┌───────┴────────┐              │
│  │ SQLite/Prisma│  │ Cache (memory) │              │
│  │ (18,860 recs)│  │ (contacts/acct)│              │
│  └──────────────┘  └────────────────┘              │
└─────────────────────────────────────────────────────┘
         │                    │
         │         ┌──────────┴──────────┐
         │         │   Xero API          │
         │         │ (OAuth2 + REST)     │
         │         └─────────────────────┘
```

---

## 5. Xero API Community Pain Points & Mitigations

### Known Pain Points

| Pain Point | Impact | Mitigation |
|------------|--------|------------|
| **Rate limit: 60/min** | Blocks high-frequency polling | Aggressive caching, batch reads, queue writes |
| **Concurrent limit: 5/sec** | Parallel requests fail | Serialize Xero calls via queue |
| **Rotating refresh tokens** | Race conditions lose tokens | Mutex lock on refresh, DB persistence |
| **No usage API** | Cannot check remaining quota | Self-track with counter/timestamp |
| **Aged reports: 1 contact at a time** | Slow bulk operations | Not relevant for invoice creation |
| **Webhook reliability** | Occasional missed events | Periodic polling as fallback |
| **30-day refresh token inactivity timeout** | Silent auth failure | Scheduled keep-alive job (weekly token refresh) |

### Recommended Defensive Patterns

1. **Exponential backoff** on 429 (rate limit) responses
2. **Request queue** with max 50 requests/min (leave 10/min buffer)
3. **Token health check** endpoint for monitoring
4. **Graceful degradation**: if Xero is down, allow saving drafts locally
5. **Weekly scheduled token refresh** to prevent 30-day inactivity expiry (even if no invoices are created)

Sources:
- [Xero OAuth 2.0 API Limits](https://developer.xero.com/documentation/guides/oauth2/limits/)
- [Xero Rate Limits Best Practices](https://developer.xero.com/documentation/best-practices/integration-health/rate-limits/)
- [Xero Token Types](https://developer.xero.com/documentation/guides/oauth2/token-types)
- [Xero Rate Limiting - Coefficient](https://coefficient.io/xero-api/xero-api-rate-limits)
- [Redis Caching Strategies: Next.js Production Guide 2025](https://www.digitalapplied.com/blog/redis-caching-strategies-nextjs-production)
- [Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching)
- [Fuse.js Documentation](https://www.fusejs.io/)
- [xero-node SDK](https://github.com/XeroAPI/xero-node)

---

## Summary Decision Matrix

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 15 App Router | SSR + Server Actions + Route Handlers in one |
| Xero SDK | xero-node (official) | Only official Node SDK, TypeScript support |
| Internal API calls | Server Actions | Built-in CSRF, direct function calls, no HTTP overhead |
| External endpoints | Route Handlers | OAuth callback, webhooks need HTTP endpoints |
| Token refresh | Proactive + Mutex | Xero rotating tokens require serialized refresh |
| Fuzzy search | Fuse.js (in-memory) | 18,860 records fits in memory, sub-10ms response |
| Cache | unstable_cache + in-memory Map | Simple, no Redis dependency for single-server deploy |
| Database | SQLite + Prisma | Lightweight, file-based, sufficient for historical data |
| Rate limit handling | Request queue + exponential backoff | Stay within 60/min with safety buffer |
