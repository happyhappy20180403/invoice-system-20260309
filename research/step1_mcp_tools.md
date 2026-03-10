# Step 1: MCP Servers & Tools Research for Xero Invoice Auto-Input System

Research Date: 2026-03-10

---

## 1. Xero-Related MCP Servers

### XeroAPI/xero-mcp-server (Official)
- **GitHub**: https://github.com/XeroAPI/xero-mcp-server
- **Stars**: ~200+ (official Xero repo)
- **What it does**: Official MCP server by Xero. Provides bridge between MCP protocol and Xero API. Supports invoice CRUD, contacts, payments, payroll, bank transactions, manual journals, and reports.
- **Auth**: Two modes - (1) client ID/secret for dev/test, (2) runtime multi-account OAuth2 with PKCE.
- **OAuth Scopes**: accounting.transactions, accounting.contacts, accounting.settings, accounting.reports, payroll.*
- **Relevance**: **CRITICAL** - This is the primary tool for our project. Directly enables AI-driven invoice creation, contact management, and payment processing via Xero API.
- **Listed on**: [mcp.so](https://mcp.so/server/xero-mcp-server/XeroAPI), [mcpservers.org](https://mcpservers.org/servers/XeroAPI/xero-mcp-server), [smithery.ai](https://smithery.ai/servers/@john-zhang-dev/xero-mcp)

### john-zhang-dev/xero-mcp
- **GitHub**: https://github.com/john-zhang-dev/xero-mcp
- **Stars**: ~30+
- **What it does**: Community MCP server for Xero interaction. Available on Smithery.
- **Relevance**: Alternative/reference implementation. Good for comparing approaches.

### CDataSoftware/xero-mcp-server-by-cdata
- **GitHub**: https://github.com/CDataSoftware/xero-mcp-server-by-cdata
- **What it does**: Read-only MCP server connecting to Xero via CData JDBC drivers. Free beta read/write version available.
- **Relevance**: LOW - Read-only; we need write capability for invoice creation.

### XeroAPI/xero-agent-toolkit
- **GitHub**: https://github.com/XeroAPI/xero-agent-toolkit
- **What it does**: Examples for building AI agents with Xero API using various agentic frameworks + Xero MCP Server.
- **Relevance**: **HIGH** - Reference architectures and patterns for our project.

---

## 2. Accounting / Invoice MCP Servers

### markslorach/invoice-mcp
- **GitHub**: https://github.com/markslorach/invoice-mcp
- **Listed on**: [mcpservers.org](https://mcpservers.org/servers/markslorach/invoice-mcp)
- **What it does**: Creates professional PDF invoices using natural language. Supports multiple currencies (GBP, USD, CAD, EUR).
- **Relevance**: MEDIUM - Could be used for generating PDF invoice previews before sending to Xero.

### norman-finance/norman-mcp-server
- **GitHub**: https://github.com/norman-finance/norman-mcp-server
- **What it does**: Connects accounting, invoicing, and VAT filing to Claude/Cursor/any MCP client.
- **Relevance**: MEDIUM - Reference for accounting workflow patterns.

### StupidCodeFactory/freeagent-mcp
- **GitHub**: https://github.com/StupidCodeFactory/freeagent-mcp
- **What it does**: MCP server for FreeAgent accounting API - contacts, invoices, bills, bank transactions.
- **Relevance**: LOW - Different platform, but good architectural reference.

### iamsamuelfraga/mcp-holded
- **GitHub**: https://github.com/iamsamuelfraga/mcp-holded
- **What it does**: MCP server for Holded Invoice API (create, list, update, delete invoices/estimates/credit notes).
- **Relevance**: LOW - Different platform, good reference for invoice CRUD patterns.

### thwinter-ch/milkee-mcp
- **GitHub**: https://github.com/thwinter-ch/milkee-mcp
- **What it does**: MCP server for MILKEE Swiss accounting software. Invoices, projects, tasks, financial reporting.
- **Relevance**: LOW - Reference only.

---

## 3. OAuth2 / Authentication MCP Servers

### atrawog/mcp-oauth-gateway
- **GitHub**: https://github.com/atrawog/mcp-oauth-gateway
- **Stars**: 46
- **What it does**: OAuth 2.1 Authorization Server that adds authentication to ANY MCP server without code modification. Uses GitHub as identity provider.
- **Relevance**: **HIGH** - Could provide auth layer for our system if we build custom MCP components.

### NapthaAI/http-oauth-mcp-server
- **GitHub**: https://github.com/NapthaAI/http-oauth-mcp-server
- **What it does**: Remote MCP server (SSE + Streamable HTTP) implementing MCP spec's authorization extension.
- **Relevance**: MEDIUM - Reference for remote MCP server with OAuth.

### QuantGeekDev/mcp-oauth2.1-server
- **GitHub**: https://github.com/QuantGeekDev/mcp-oauth2.1-server
- **What it does**: Reference implementation of draft MCP OAuth spec.
- **Relevance**: MEDIUM - Reference implementation for understanding MCP auth flows.

### agentic-community/mcp-gateway-registry
- **GitHub**: https://github.com/agentic-community/mcp-gateway-registry
- **What it does**: Enterprise MCP Gateway & Registry with OAuth (Keycloak/Entra), dynamic tool discovery, audit logging.
- **Relevance**: MEDIUM - Enterprise patterns for governed MCP access.

### hyprmcp/mcp-gateway
- **GitHub**: https://github.com/hyprmcp/mcp-gateway
- **What it does**: MCP OAuth Proxy with dynamic client registration, analytics, and firewall for enterprise MCP servers.
- **Relevance**: MEDIUM - Enterprise-grade proxy pattern.

---

## 4. SQLite Database MCP Servers

### modelcontextprotocol/servers (Official SQLite)
- **GitHub**: https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite
- **What it does**: Official MCP SQLite server. SQL queries, business data analysis, auto-generated business insights.
- **Relevance**: **HIGH** - Store historical invoice data, templates, and patterns locally.

### jparkerweb/mcp-sqlite
- **GitHub**: https://github.com/jparkerweb/mcp-sqlite
- **What it does**: Full CRUD operations, database exploration/introspection, custom SQL queries.
- **Relevance**: **HIGH** - More feature-rich than official. Good for local data persistence.

### spences10/mcp-sqlite-tools
- **GitHub**: https://github.com/spences10/mcp-sqlite-tools
- **What it does**: Comprehensive SQLite operations with security features, transaction support, read-only vs destructive operation separation.
- **Relevance**: HIGH - Security-focused; good for production use.

### hannesrudolph/sqlite-explorer-fastmcp-mcp-server
- **GitHub**: https://github.com/hannesrudolph/sqlite-explorer-fastmcp-mcp-server
- **What it does**: Safe read-only SQLite access with query validation. Built on FastMCP.
- **Relevance**: MEDIUM - Read-only; useful for reporting/analytics side.

### sqlitecloud/sqlitecloud-mcp-server
- **GitHub**: https://github.com/sqlitecloud/sqlitecloud-mcp-server
- **What it does**: Cloud-hosted SQLite via MCP. SELECT, INSERT, UPDATE, DELETE.
- **Relevance**: MEDIUM - If we need cloud-hosted persistence.

---

## 5. Xero API + Next.js Integration Projects

### XeroAPI/xero-node (Official SDK)
- **npm**: https://www.npmjs.com/package/xero-node
- **What it does**: Official Xero Node.js SDK for OAuth 2.0. Full API coverage.
- **Known Issue**: Webpack compatibility issue with Next.js (uses Node.js 'fs' module). Must use server-side only (API routes / server components).
- **Relevance**: **CRITICAL** - Primary SDK for our Next.js backend integration.

### XeroAPI/xero-node-oauth2-app
- **GitHub**: https://github.com/XeroAPI/xero-node-oauth2-app
- **What it does**: Demo Node.js app showing xero-node SDK with OAuth2. Reference for auth flow implementation.
- **Relevance**: **HIGH** - Template for our OAuth2 integration.

### Xero Developer Portal
- **URL**: https://developer.xero.com/
- **Resources**: SDKs, getting started guide, API documentation, sample apps.
- **Relevance**: **CRITICAL** - Primary documentation source.

---

## 6. Xero / Accounting Automation Trending Repos

### GitHub Topics: xero, xero-api
- **URL**: https://github.com/topics/xero, https://github.com/topics/xero-api
- **Trends**: Active development in Python scripts for email automation, REST API integrations, invoice management.
- **XeroAPI/xero-node**: Updated 2026-02-20
- **XeroAPI/xero-mcp-server**: Updated 2026-02-15

### 2026 Accounting Automation Trends
- Focus areas: accounts payable automation, routine journal entries, bank statement data extraction, tax research.
- AI-powered invoice processing is a key growth area.
- Xero automation = applying non-manual workflows to optimize repetitive tasks.

---

## Recommended Architecture Stack

Based on research, the recommended MCP stack for our project:

| Component | Tool | Purpose |
|-----------|------|---------|
| **Xero Integration** | `XeroAPI/xero-mcp-server` | Invoice CRUD, contacts, payments via MCP |
| **Node.js SDK** | `xero-node` | Direct API calls from Next.js API routes |
| **Local DB** | `jparkerweb/mcp-sqlite` or official SQLite MCP | Historical data, templates, caching |
| **Auth Reference** | `atrawog/mcp-oauth-gateway` | OAuth2 patterns for secure access |
| **Agent Patterns** | `XeroAPI/xero-agent-toolkit` | Reference architectures |
| **Invoice PDF** | `markslorach/invoice-mcp` | Optional: PDF preview generation |

### Key Considerations
1. **xero-node + Next.js**: Must use server-side only (API routes) due to 'fs' module dependency
2. **MCP Server**: Official Xero MCP server is actively maintained (last update: 2026-02-15)
3. **OAuth2**: Xero uses OAuth 2.0 with PKCE - xero-mcp-server handles this natively
4. **SQLite**: Good for local caching of invoice templates, history, and AI-generated patterns
