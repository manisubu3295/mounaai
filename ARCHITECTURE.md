# PocketComputer — Enterprise AI Assistant Platform
## Product Architecture & Implementation Specification
**Version:** 1.0.0
**Author:** Principal Architect — Aadhirai Innovations
**Status:** Implementation-Ready
**Date:** 2026-03-30

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Product Scope](#2-product-scope)
3. [User Personas](#3-user-personas)
4. [High-Level Functional Modules](#4-high-level-functional-modules)
5. [End-to-End User Workflows](#5-end-to-end-user-workflows)
6. [Detailed Functional Requirements](#6-detailed-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [System Architecture](#8-system-architecture)
9. [Recommended Technology Stack](#9-recommended-technology-stack)
10. [LangChain vs Custom Tool Layer](#10-langchain-vs-custom-tool-layer)
11. [Data Model / Database Schema](#11-data-model--database-schema)
12. [API Design](#12-api-design)
13. [Connector Framework Design](#13-connector-framework-design)
14. [Prompt Masking / Redaction Engine](#14-prompt-masking--redaction-engine)
15. [LLM Provider Abstraction Layer](#15-llm-provider-abstraction-layer)
16. [Chat UX Specification](#16-chat-ux-specification)
17. [RBAC and Permissions](#17-rbac-and-permissions)
18. [Error Handling Strategy](#18-error-handling-strategy)
19. [Audit, Monitoring, and Observability](#19-audit-monitoring-and-observability)
20. [Subscription and Upgrade Logic](#20-subscription-and-upgrade-logic)
21. [Security Architecture](#21-security-architecture)
22. [Implementation Phases](#22-implementation-phases)
23. [Engineering Folder Structure](#23-engineering-folder-structure)
24. [Coding Standards & Architecture Rules](#24-coding-standards--architecture-rules)
25. [UI Design System Guidance](#25-ui-design-system-guidance)
26. [Developer Starter Plan](#26-developer-starter-plan)
27. [Final Recommendation Summary](#27-final-recommendation-summary)

---

## 1. Product Vision

### What It Is

PocketComputer is a **multi-tenant enterprise AI assistant platform** that enables organizations to deploy an intelligent, configurable AI assistant connected to their own data sources — APIs and databases — while ensuring sensitive data never leaves the server boundary unmasked.

It provides a clean, executive-grade chat interface powered by Google Gemini as the default reasoning engine, with full configurability of the LLM provider, endpoint, and model. Every interaction is mediated server-side: the browser never touches customer data, credentials, or raw LLM responses containing PII.

### Who It Is For

- **Software teams** at mid-to-large enterprises who need a private AI assistant over their internal APIs and databases
- **Operations and analytics teams** who query proprietary business data via natural language
- **IT administrators** who need secure, auditable, role-controlled access to LLM capabilities
- **Aadhirai Innovations** as an ISV selling this as a white-label or branded SaaS product

### Core Problem It Solves

Enterprises want the productivity benefits of AI assistants but cannot use public LLM interfaces because:
1. Sensitive PII, financial, and operational data cannot leave their system perimeter unmasked
2. LLMs should not have direct database access
3. Credentials and API keys must be server-side only
4. Conversations must be auditable
5. Different teams need different data access levels

PocketComputer solves all five by design.

### Commercial Positioning

- **Free tier:** Single user, Gemini-powered, manual API/DB config, limited history
- **Pro tier:** Multi-user, multi-connector, advanced masking, audit logs, priority support (enquiry via WhatsApp for custom pricing)
- **Enterprise tier:** Full multi-tenancy, SSO, dedicated deployment, custom SLA

---

## 2. Product Scope

### In Scope — V1

- Single-page enterprise chat UI with thread history and new chat creation
- Tenant onboarding and user authentication (JWT-based)
- Gemini as default LLM with configurable endpoint URL, API key, and model
- API connector: configure base URL, auth, headers, request/response schema mapping
- Database connector: PostgreSQL and MySQL, server-side only, read-only parameterized queries
- Server-side prompt masking engine with configurable field rules
- Tool execution layer — server resolves data before sending context to Gemini
- RBAC: Admin, Analyst, Viewer roles
- Audit log table with structured entries per action
- Free vs Pro plan gating with WhatsApp upgrade redirect
- Admin configuration console
- Connection test endpoint for both API and DB connectors

### Out of Scope — V1

- SSO / SAML / LDAP integration
- File upload and document ingestion (RAG)
- Real-time streaming SSE (polling acceptable in V1)
- Connector marketplace
- Custom branding per tenant
- Workflow / automation triggers
- Email or Slack notifications
- Vector database / embedding store
- LangGraph or agent orchestration loops
- Mobile native app

### Future Roadmap




- **V2:** Streaming responses, RAG over uploaded documents, connector marketplace
- **V3:** LangGraph multi-step agent reasoning, workflow triggers, SSO
- **V4:** White-label SDK, embedded widget, custom model fine-tuning support

---

## 3. User Personas

### 3.1 Business Admin (Tenant Admin)

- **Role:** Owns the account, manages users, configures the LLM, sets masking rules
- **Technical level:** Medium — comfortable with API keys and credentials, not a developer
- **Goals:** Get the assistant running against their internal data without involving IT every time
- **Pain points:** Scared of PII leaks; needs auditability; wants simple UI
- **Key screens:** Config page, Connector management, Audit logs, User management

### 3.2 Technical Integrator (Developer / DevOps)

- **Role:** Sets up API and DB connectors, defines schema mappings, tests connections
- **Technical level:** High — familiar with REST APIs, SQL, JSON schemas
- **Goals:** Expose internal API or DB to the assistant safely and precisely
- **Pain points:** Does not want to give full DB access; needs granular query control
- **Key screens:** Connector config, Schema mapping editor, Connection test, Preview payload

### 3.3 Internal Analyst / End User

- **Role:** Uses the chat interface daily to query business data via natural language
- **Technical level:** Low — not a developer
- **Goals:** Get answers quickly without writing SQL or calling APIs manually
- **Pain points:** Frustrated by slow dashboards; wants conversational data access
- **Key screens:** Chat interface, Thread history, Source panel

### 3.4 Aadhirai Admin / Support Team

- **Role:** Platform-level administrator managing all tenants
- **Technical level:** High
- **Goals:** Monitor platform health, manage billing, support enterprise clients
- **Key screens:** Super-admin console (separate from tenant scope), tenant audit logs

---

## 4. High-Level Functional Modules

### 4.1 Authentication & Tenant Onboarding

Handles user registration, login, JWT issuance, refresh token rotation, and tenant provisioning. Each tenant is isolated at the row level via a `tenant_id` foreign key. On first login, a default tenant workspace is created with default LLM config pointing to Gemini.

### 4.2 Chat Workspace

The primary user interface. Renders the active conversation thread. Handles user input, sends messages to the backend `/api/chat/message` endpoint, polls for or receives the assistant response, and renders formatted markdown output with source attribution.

### 4.3 Conversation / Thread Management

Persists named chat threads per user per tenant. Supports creating, renaming, archiving, and deleting threads. Threads surface in the left sidebar with timestamps and a truncated preview of the last message.

### 4.4 Prompt Masking Engine

A server-side pipeline stage that inspects the outbound context (retrieved data + user message) before it reaches the LLM. Applies tenant-configured masking rules: field name patterns, regex rules, full redaction, or partial masking (e.g., `****1234`). Logs what was masked without logging the unmasked value.

### 4.5 LLM Provider Configuration

Stores per-tenant LLM provider config: provider name, API key (encrypted at rest), base URL, model name, timeout, max tokens, temperature. The LLM adapter resolves this config at request time. Default is Gemini (`https://generativelanguage.googleapis.com`). Fully swappable.

### 4.6 API Connector Configuration

Allows tenants to define external API integrations: base URL, authentication type (Bearer, API Key, Basic, OAuth2 client credentials), headers, query params, and request body templates using `{{variable}}` interpolation. Response path mapping extracts specific fields from the API response for tool context.

### 4.7 Database Connector Configuration

Allows tenants to register database connections: type (PostgreSQL, MySQL), host, port, database name, username, password (encrypted). Credentials are validated server-side. Only pre-defined parameterized query templates are executed. Direct arbitrary SQL is never accepted from the client.

### 4.8 Schema Mapping / Response Transformer

A per-connector JSON configuration that maps API response fields or DB columns to normalized field names the assistant can reference. Supports aliasing, type coercion, nested path extraction (`$.data.items[0].name`), and field inclusion/exclusion.

### 4.9 Tool Execution Layer

The server-side orchestration engine. When the LLM returns a tool call intent (or when the system detects a connector should be invoked), the tool execution layer:
1. Resolves which connector to call
2. Injects parameters extracted from the user message
3. Executes the call server-side
4. Applies the schema transformer
5. Applies the masking engine
6. Returns normalized context back to the LLM for reasoning

### 4.10 Upgrade / Plan Gating

Certain features are gated behind the Pro plan. When a Free user attempts a gated action, they see a clear, non-intrusive upgrade modal with a "Talk to Us on WhatsApp" CTA that opens a pre-filled WhatsApp deep link. Upgrade events are logged.

### 4.11 Audit Logs

Every significant action (login, config change, connector execution, masking event, LLM call, upgrade event) is written to the `audit_logs` table with actor, tenant, action, timestamp, IP, and a sanitized payload. PII is never written to audit logs.

### 4.12 RBAC & Permissions

Three roles: `TENANT_ADMIN`, `ANALYST`, `VIEWER`. Role enforcement happens at the API middleware layer — not just the UI. Each route is annotated with required permissions. Roles are scoped per tenant.

### 4.13 Admin Management Console

A dedicated settings area separate from the chat UI. Contains: LLM config, Connector management, Masking rules, User management, Audit log viewer, Plan status, and Connection health dashboard.

---

## 5. End-to-End User Workflows

### 5.1 New Tenant Setup

```
1. User navigates to /signup
2. Enters name, email, company name, password
3. Backend:
   a. Validates email uniqueness across tenants
   b. Creates tenant record with status=ACTIVE, plan=FREE
   c. Creates user record with role=TENANT_ADMIN
   d. Creates default llm_provider_config (Gemini, no key yet)
   e. Issues JWT + refresh token
4. User is redirected to /onboarding
5. Onboarding wizard prompts: "Add your Gemini API key to get started"
6. User enters API key → encrypted and stored in provider_configs
7. Onboarding complete → redirect to /chat
```

### 5.2 Configure Gemini API

```
1. Admin navigates to /settings/llm
2. Sees current config: Provider=Gemini, URL=default, Model=gemini-1.5-pro, Key=masked
3. Admin can:
   a. Change API key (re-enters, saved encrypted)
   b. Change model name (dropdown or free text)
   c. Change base URL (advanced — override Gemini endpoint)
   d. Set temperature, max_tokens
4. "Test Connection" button:
   a. Backend sends a minimal prompt to LLM using this config
   b. Returns: connected / error + message
5. On Save:
   a. Validate key format
   b. Encrypt and upsert provider_configs
   c. Write audit log: "LLM config updated"
```

### 5.3 Create a New Chat

```
1. User clicks "New Chat" in sidebar
2. Frontend:
   a. POST /api/chats → creates new chat thread
   b. Returns chat_id, name="New Chat", created_at
3. Sidebar updates with new thread at top
4. Chat panel clears → shows empty state: "Ask me anything..."
5. User types message and hits Send
6. Frontend: POST /api/chats/:id/messages { content: "..." }
7. Backend pipeline executes (see 5.7)
8. Response renders in chat thread
9. If first message: chat thread is auto-named from message summary
```

### 5.4 Connect an API

```
1. Admin navigates to /settings/connectors → "Add Connector" → "API"
2. Fills in:
   - Name: "CRM API"
   - Base URL: https://crm.internal.com/api
   - Auth type: Bearer
   - Token: [entered, encrypted server-side]
   - Headers: Content-Type: application/json
3. Defines endpoint template:
   - Path: /customers/{{customer_id}}
   - Method: GET
4. Clicks "Test Connection"
   a. Backend sends test request with sample params
   b. Returns: status code, response preview
5. Saves connector
6. Audit log: "API connector 'CRM API' created"
```

### 5.5 Define Request/Response Schema Mapping

```
1. After connector is saved, click "Configure Mapping"
2. Admin enters sample API response JSON (paste or fetch from test)
3. System parses and renders field tree
4. Admin maps:
   - $.data.customer.full_name → alias: customer_name
   - $.data.customer.email → alias: customer_email (mark as maskable)
   - $.data.account.balance → alias: account_balance (mark as maskable)
5. Admin selects which fields to include in LLM context
6. Saves mapping → stored as connector_schema_mappings JSON
7. Preview: "LLM will see: { customer_name: '...', account_balance: '[MASKED]' }"
```

### 5.6 Connect a Database

```
1. Admin navigates to /settings/connectors → "Add Connector" → "Database"
2. Selects type: PostgreSQL
3. Fills: host, port, database, username, password
4. Clicks "Test Connection"
   a. Backend opens test connection, runs SELECT 1
   b. Returns: connected / error details (sanitized — no credential echo)
5. Admin defines query templates:
   - Name: "Get customer orders"
   - SQL: SELECT order_id, product, amount FROM orders WHERE customer_id = $1
   - Params: [{ name: "customer_id", source: "user_message_extracted" }]
6. System validates SQL:
   - Must be SELECT only
   - No DDL/DML keywords allowed
   - Parameterized only — no string interpolation
7. Saves connector → DB creds encrypted at rest
8. Audit log: "DB connector 'Orders DB' created"
```

### 5.7 Ask a Natural Language Question (Full Pipeline)

```
1. User types: "Show me the last 5 orders for customer John"
2. Frontend: POST /api/chats/:id/messages { content: "..." }
3. Backend — MessageController receives request
4. Step A — Intent Classification:
   - Quick LLM call (or regex/keyword match for V1) determines if tool use is needed
   - Detects: "orders", "customer" → maps to "Orders DB" connector
5. Step B — Parameter Extraction:
   - Extracts "John" as customer name
   - Queries DB connector: SELECT customer_id FROM customers WHERE name ILIKE $1
   - Resolves customer_id = 42
6. Step C — Tool Execution:
   - Executes "Get customer orders" template with params { customer_id: 42 }
   - Returns raw DB rows
7. Step D — Schema Transformation:
   - Maps columns to aliased fields per connector_schema_mapping
8. Step E — Masking:
   - Applies masking rules: email → [REDACTED], account_balance → ****
   - Logs: { masked_fields: ["email"], tenant_id: ..., chat_id: ... }
9. Step F — Context Assembly:
   - Assembles: system prompt + masked data context + conversation history + user message
10. Step G — LLM Call:
    - Sends assembled prompt to Gemini via provider adapter
    - Gemini reasons on masked, normalized context
    - Returns natural language response
11. Step H — Response:
    - Stores assistant message in chat_messages
    - Logs tool_run record
    - Writes audit_log entry
    - Returns response to frontend
12. Frontend renders response with optional source attribution badge
```

### 5.8 User Hits Pro Gate — WhatsApp Redirect

```
1. Analyst clicks "Connect Second Connector" (Pro feature)
2. System checks: tenant.plan === FREE
3. Modal appears:
   - Title: "Unlock Pro Capabilities"
   - Body: "Connect unlimited data sources, advanced masking, and full audit logs."
   - CTA button: "Talk to Us on WhatsApp"
4. On button click:
   a. Frontend logs upgrade_request event to backend: POST /api/upgrade/request
   b. Backend logs: { tenant_id, user_id, feature_attempted, timestamp }
   c. Frontend opens WhatsApp deep link:
      https://wa.me/91XXXXXXXXXX?text=Hi+I%27m+interested+in+PocketComputer+Pro
5. Separate browser tab opens WhatsApp
6. whatsapp_redirect_logs record created
```

### 5.9 Admin Reviews Logs and Connector Health

```
1. Admin navigates to /settings/audit
2. Filters by: date range, action type, user
3. Table shows: timestamp, user, action, connector/chat involved, IP address
4. Clicks row → expanded detail panel (no PII shown)
5. Navigates to /settings/connectors
6. Each connector shows health badge: HEALTHY / DEGRADED / UNREACHABLE
7. Health is determined by last connection test timestamp + error rate
8. Admin can trigger manual "Retest Connection" per connector
9. Connector test result written to audit log
```

---

## 6. Detailed Functional Requirements

### 6.1 Authentication Module

**Objective:** Secure user identity, session management, and tenant scoping.

**Features:**
- Email/password registration and login
- JWT access token (15 min expiry) + HTTP-only refresh token (7 days)
- Refresh token rotation on use
- Logout invalidates refresh token
- Password hashing: bcrypt with cost factor 12
- Per-tenant user limit enforced on registration

**Inputs:** email, password, tenant_id (resolved from subdomain or session context)
**Outputs:** access_token, refresh_token (cookie), user profile
**Validation:**
- Email must be valid format and unique per tenant
- Password min 8 chars, 1 uppercase, 1 number
- Rate limit: 5 failed login attempts → 15-min lockout

**Error Cases:**
- Invalid credentials → 401 with generic "Invalid email or password"
- Account locked → 423 with retry-after header
- Token expired → 401 with `code: TOKEN_EXPIRED`
- Refresh token reuse (rotation violation) → revoke entire session family

**Security Rules:**
- Tokens never stored in localStorage — access token in memory, refresh token in HTTP-only SameSite=Strict cookie
- No credential data in audit logs
- Brute force protection at middleware level

**Audit:** Login success, login failure (with IP), logout, token refresh

---

### 6.2 Chat Module

**Objective:** Manage conversation threads and message persistence.

**Features:**
- Create, list, rename, archive, delete chat threads
- Send user messages, receive assistant responses
- Store full message history per thread
- Auto-name thread from first message (truncated summary)
- Thread pagination (20 threads per page in sidebar)

**Inputs:** tenant_id, user_id, chat_id, message content
**Outputs:** chat object, message array, assistant response message
**Validation:**
- Message content max 4000 characters
- Cannot send to archived thread
- User can only access their own threads (row-level)

**Error Cases:**
- Thread not found → 404
- Message too long → 400 with char count
- LLM provider not configured → 422 with guidance message

**Audit:** Thread created, thread deleted, message sent (no content logged), LLM call initiated

---

### 6.3 LLM Provider Config Module

**Objective:** Store and manage tenant LLM configuration securely.

**Features:**
- Store provider name, base URL, encrypted API key, model, temperature, max_tokens
- Test connection before save
- Display masked API key (last 4 chars visible)
- Support multiple providers per tenant (active flag determines which is used)

**Inputs:** provider_name, api_key, base_url, model, temperature, max_tokens
**Outputs:** provider_config_id, masked status
**Validation:**
- API key required before first chat is permitted
- base_url must be a valid HTTPS URL
- temperature: 0.0–1.0
- max_tokens: 256–8192

**Security:** API key encrypted with AES-256-GCM before storage. Key is never returned in GET responses.

---

### 6.4 Connector Configuration Module

**Objective:** Allow tenants to register API and DB data sources.

**Features (API):**
- Name, base URL, auth config, headers, endpoint templates
- Request body template with `{{variable}}` substitution
- Response path extractor (JSONPath)

**Features (DB):**
- Connection string assembly from individual fields
- Schema discovery (table list, column list — read metadata only)
- Named query templates with typed parameters
- SQL allowlist validation (SELECT only)

**Inputs:** connector_type, connection details, query/endpoint templates
**Outputs:** connector_id, test_result, last_tested_at
**Validation:**
- DB: no DDL keywords (CREATE, DROP, ALTER, INSERT, UPDATE, DELETE, EXEC, TRUNCATE)
- DB: parameterized queries only
- API: base_url must be HTTPS (configurable to allow HTTP for internal use with explicit override)
- Max 1 connector on Free plan, unlimited on Pro

---

### 6.5 Masking Rules Module

**Objective:** Configure which data fields are masked before LLM context assembly.

**Features:**
- Field name patterns (exact, glob, regex)
- Masking strategies: FULL_REDACT, PARTIAL_MASK, TOKENIZE
- Per-connector rule sets
- Global default rules per tenant
- Preview tool: shows how a sample payload would be masked

**Validation:**
- Regex patterns must be valid
- Tokenize strategy requires active token store
- Rules are applied in order (first match wins)

**Audit:** Rule created/modified/deleted, fields masked per request (field names only, not values)

---

### 6.6 Upgrade / Plan Module

**Objective:** Gate Pro features, capture upgrade intent, redirect to WhatsApp.

**Features:**
- Feature gating middleware checks plan tier before action
- Upgrade modal with WhatsApp CTA
- Logs upgrade request event
- WhatsApp URL is configurable in platform settings

**Inputs:** tenant_id, feature_attempted
**Outputs:** whatsapp_redirect_url, upgrade_request_id

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target |
|--------|--------|
| Chat message API p95 latency (excl. LLM) | < 200ms |
| LLM response time (Gemini p95) | < 8s |
| Connector execution (API) | < 3s timeout |
| Connector execution (DB query) | < 5s timeout |
| UI initial load (LCP) | < 2.5s |
| Auth endpoint | < 100ms |

### 7.2 Security

- All traffic over TLS 1.2+
- API keys and DB passwords encrypted at rest (AES-256-GCM)
- Encryption key managed separately from application config (environment variable or KMS)
- No secrets in git, logs, or API responses
- OWASP Top 10 compliance
- SQL injection: only parameterized queries, never string concatenation
- SSRF prevention: outbound URL allowlist per tenant
- CSRF: SameSite cookies + origin validation for state-changing requests

### 7.3 Availability

- Target: 99.5% uptime for V1 (single-region)
- Graceful degradation: if LLM is down, return informative error, do not lose message
- Connector failures do not crash the chat session — return partial response with error note

### 7.4 Scalability

- Stateless API servers — horizontally scalable behind load balancer
- Database connection pooling via PgBouncer or Prisma pool settings
- Redis for session/cache — shared across instances
- Background jobs (connector tests, async tasks) via Bull queue

### 7.5 Observability

- Structured JSON logging (Winston) with: tenant_id, user_id, request_id, action
- Request tracing via correlation ID header propagated through all layers
- Metrics: LLM call count, latency, error rate; connector call count, latency
- Health check endpoint: `/health` returns DB, Redis, LLM provider status
- Error alerting threshold: >5% error rate on any endpoint triggers alert

### 7.6 Maintainability

- Strict TypeScript — no `any` in production code
- Services separated by domain boundary
- DTO validation at every API boundary (Zod)
- All DB queries through ORM — no raw SQL in application code (except schema discovery)
- Environment-based configuration — no hardcoded values

### 7.7 Extensibility

- Connector framework built on interface — new connector types added without modifying core
- LLM provider built on interface — adding OpenAI, Claude, Mistral requires only new adapter
- Masking engine uses strategy pattern — new masking strategies added independently

### 7.8 Compliance Readiness

- Audit log retention: 90 days default, configurable
- PII minimization: masking engine prevents PII from reaching LLM
- GDPR-friendly: user data deletion capability at tenant level
- Logs never contain unmasked sensitive field values

### 7.9 Tenant Isolation

- All DB queries include `WHERE tenant_id = $tenantId` enforced at service layer
- Connector credentials are tenant-scoped and inaccessible across tenants
- LLM provider configs are tenant-scoped
- Audit logs are tenant-scoped

---

## 8. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                         │
│  Chat UI │ Config Console │ Connector UI │ Audit Viewer             │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS REST
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Gateway / Reverse Proxy                     │
│              (Nginx or Caddy — TLS termination, rate limiting)      │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Node.js / Express Backend                        │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │ Auth Middleware│  │ RBAC Middleware│  │ Rate Limit Middleware  │  │
│  └───────────────┘  └───────────────┘  └────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Route Controllers                        │    │
│  │  AuthController │ ChatController │ ConnectorController      │    │
│  │  ConfigController │ AuditController │ UpgradeController     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Service Layer                          │    │
│  │                                                             │    │
│  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │    │
│  │  │ ChatService  │   │ToolExecEngine│   │ MaskingEngine  │  │    │
│  │  └──────────────┘   └──────────────┘   └────────────────┘  │    │
│  │                                                             │    │
│  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │    │
│  │  │ConnectorSvc  │   │ LLMAdapter   │   │ AuditService   │  │    │
│  │  └──────────────┘   └──────────────┘   └────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Infrastructure Layer                       │    │
│  │  PrismaClient │ RedisClient │ SecretManager │ HttpClient   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────┬─────────────────────┬──────────────────┬─────────────────┘
           │                     │                  │
           ▼                     ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐
│   PostgreSQL     │  │     Redis        │  │  External Services      │
│                  │  │  (Session cache, │  │                         │
│  - users         │  │   rate limiter,  │  │  ┌───────────────────┐  │
│  - tenants       │  │   job queue)     │  │  │  Gemini API       │  │
│  - chats         │  └──────────────────┘  │  │  (or custom URL)  │  │
│  - connectors    │                        │  └───────────────────┘  │
│  - audit_logs    │                        │                         │
│  - ...           │                        │  ┌───────────────────┐  │
└──────────────────┘                        │  │ Customer APIs     │  │
                                            │  │ Customer DBs      │  │
                                            │  └───────────────────┘  │
                                            └─────────────────────────┘
```

### Message Pipeline (Detailed)

```
User Message
     │
     ▼
[1] ChatController.sendMessage()
     │
     ▼
[2] MessagePipelineService.execute()
     │
     ├─► [3] ConnectorResolver — determine which connector(s) are relevant
     │
     ├─► [4] ParameterExtractor — extract entities from user message
     │
     ├─► [5] ToolExecutionEngine — execute connector(s) server-side
     │         ├── ApiConnector.execute()
     │         └── DbConnector.execute()
     │
     ├─► [6] SchemaTransformer — normalize raw result to mapped fields
     │
     ├─► [7] MaskingEngine.apply() — redact/mask sensitive fields
     │         └── AuditService.logMaskingEvent()
     │
     ├─► [8] ContextAssembler — build final prompt context
     │         ├── System prompt
     │         ├── Conversation history (last N turns)
     │         ├── Masked data context
     │         └── User message
     │
     ├─► [9] LLMAdapter.complete() — send to Gemini / configured provider
     │
     ├─► [10] ResponseParser — extract assistant text
     │
     └─► [11] ChatRepository.saveMessage() + AuditService.logToolRun()
```

---

## 9. Recommended Technology Stack

### Frontend

| Component | Choice | Justification |
|-----------|--------|---------------|
| Framework | React 18 + TypeScript | Battle-tested, large ecosystem, strong typing |
| Build tool | Vite | Fast HMR, excellent TypeScript support, simple config |
| Styling | Tailwind CSS v3 | Utility-first, consistent spacing, no CSS drift |
| UI Components | shadcn/ui (Radix primitives) | Headless, accessible, composable — no opinionated lock-in |
| State management | Zustand | Minimal, typed, no boilerplate. Redux is overkill for V1 |
| Server state | TanStack Query (React Query) | Cache, refetch, loading states — replaces manual fetch logic |
| Forms | React Hook Form + Zod | Performance-first forms with schema validation |
| Routing | React Router v6 | Industry standard, supports nested routes cleanly |
| Icons | Lucide React | Clean, consistent, tree-shakeable |
| Markdown render | react-markdown + remark-gfm | Renders LLM markdown output safely |

### Backend

| Component | Choice | Justification |
|-----------|--------|---------------|
| Runtime | Node.js 20 LTS | Stable, async I/O, excellent ecosystem for HTTP+DB+LLM |
| Language | TypeScript 5 | Type safety, refactor confidence, enterprise standard |
| Framework | Express.js | Minimal, well-understood, no magic. Fastify is also valid but Express has wider team familiarity |
| ORM | Prisma | Strong TypeScript types from schema, excellent migrations, readable query API. Drizzle is lighter but Prisma's codegen is superior for team velocity |
| DB | PostgreSQL 15 | ACID, JSON support, row-level security, battle-tested |
| Cache | Redis 7 | Session storage, rate limiter backing, Bull queue broker |
| Job Queue | BullMQ | Redis-backed, typed jobs, retry support — needed for async connector tests |
| HTTP client | Axios with interceptors | Timeout config, request/response interceptors for logging |
| Validation | Zod | Runtime type safety at API boundary, shared schemas with frontend |
| Logging | Winston + structured JSON | Correlates logs across services with request_id |
| Encryption | Node.js `crypto` (AES-256-GCM) | No external dependency for field-level encryption |

### Infrastructure

| Component | Choice | Justification |
|-----------|--------|---------------|
| Deployment | Docker + Docker Compose (V1), migrate to Railway or Render | Simple ops, reproducible environment |
| Reverse proxy | Nginx | TLS termination, rate limiting, static file serving |
| Auth | Custom JWT (jsonwebtoken) + HTTP-only cookies | Full control, no third-party dependency for V1 |
| Secret store | Environment variables + encrypted DB fields (V1) → HashiCorp Vault or AWS Secrets Manager (V2) | Practical for V1, upgradeable path |
| Monitoring | Pino + custom metrics endpoint → Prometheus + Grafana (V2) | Start simple, upgrade when needed |

**Why not Next.js for V1?**
Next.js adds SSR complexity and route convention opinions that create friction for a chat SPA with a decoupled backend. A Vite SPA + dedicated Express API is cleaner, more testable, and easier to deploy independently.

**Why not Bun/Deno?**
Production ecosystem maturity. Node.js 20 LTS has proven stability for enterprise API servers. Bun is promising but not yet battle-tested at enterprise scale.

---

## 10. LangChain vs Custom Tool Layer

### Recommendation: No LangChain in V1. Custom orchestration only.

**Verdict: Custom tool execution pipeline with direct Gemini API calls.**

### Why LangChain is Rejected for V1

1. **Abstraction cost is high.** LangChain wraps LLM calls, tools, and memory in layers that make debugging production issues opaque. When Gemini returns an unexpected format, you need to understand LangChain's internals to trace the failure.

2. **Version instability.** LangChain's Python and JS versions have undergone multiple breaking API redesigns. For a production system being sold to enterprise clients, framework churn is a liability.

3. **Over-engineered for the task.** V1 has a linear pipeline: extract parameters → call connector → mask → assemble context → call LLM. This is 5 clean service functions. LangChain adds agent loop complexity that is unnecessary and unsafe when you need predictable, auditable tool execution.

4. **Multi-agent orchestration is not needed in V1.** The assistant calls one connector per request and reasons on that data. LangChain's value is in multi-step agent loops — which is V3 territory.

5. **Security concern.** LangChain's function-calling abstractions can make it harder to enforce strict parameter allowlisting and SQL injection prevention. Direct control is safer.

### Custom Pipeline Advantages

- Full visibility into every stage (masking, tool execution, context assembly)
- Easier to audit and add compliance hooks
- No dependency on third-party framework versioning
- Faster response — no abstraction overhead

### When LangGraph Should Be Introduced

**V3 — multi-step reasoning and workflow agents.**

LangGraph (the state-machine successor to LangChain agents) becomes relevant when:
- The assistant needs to plan across multiple tool calls (e.g., "get customer → check orders → check payments → summarize status")
- Retry and fallback loops are needed at the agent level
- The system needs to maintain working memory across long-running tasks

At that point, LangGraph's graph-based state machine is the right abstraction. Until then, a linear custom pipeline is more reliable, faster, and more secure.

---

## 11. Data Model / Database Schema

### 11.1 tenants

**Purpose:** Top-level isolation unit. Every resource belongs to a tenant.

```sql
tenants {
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  name          VARCHAR(255) NOT NULL
  slug          VARCHAR(100) UNIQUE NOT NULL  -- used in subdomain
  plan          ENUM('FREE', 'PRO', 'ENTERPRISE') DEFAULT 'FREE'
  status        ENUM('ACTIVE', 'SUSPENDED', 'DELETED') DEFAULT 'ACTIVE'
  settings      JSONB DEFAULT '{}'            -- tenant-level preferences
  created_at    TIMESTAMPTZ DEFAULT NOW()
  updated_at    TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.2 users

**Purpose:** Individual user accounts scoped to a tenant.

```sql
users {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL REFERENCES tenants(id)
  email           VARCHAR(255) NOT NULL
  password_hash   VARCHAR(255) NOT NULL
  full_name       VARCHAR(255)
  role            ENUM('TENANT_ADMIN', 'ANALYST', 'VIEWER') NOT NULL
  status          ENUM('ACTIVE', 'INACTIVE', 'LOCKED') DEFAULT 'ACTIVE'
  failed_attempts INT DEFAULT 0
  locked_until    TIMESTAMPTZ
  last_login_at   TIMESTAMPTZ
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()

  UNIQUE(tenant_id, email)
}
```

---

### 11.3 refresh_tokens

**Purpose:** HTTP-only refresh token management with rotation and family tracking.

```sql
refresh_tokens {
  id          UUID PRIMARY KEY
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE
  tenant_id   UUID REFERENCES tenants(id)
  token_hash  VARCHAR(255) NOT NULL UNIQUE
  family_id   UUID NOT NULL  -- all tokens in rotation chain share family_id
  is_valid    BOOLEAN DEFAULT TRUE
  expires_at  TIMESTAMPTZ NOT NULL
  created_at  TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.4 chats

**Purpose:** Conversation thread container.

```sql
chats {
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id   UUID NOT NULL REFERENCES tenants(id)
  user_id     UUID NOT NULL REFERENCES users(id)
  title       VARCHAR(255) DEFAULT 'New Chat'
  status      ENUM('ACTIVE', 'ARCHIVED', 'DELETED') DEFAULT 'ACTIVE'
  metadata    JSONB DEFAULT '{}'  -- connected connector ids, etc
  created_at  TIMESTAMPTZ DEFAULT NOW()
  updated_at  TIMESTAMPTZ DEFAULT NOW()
}

INDEX idx_chats_user ON chats(user_id, tenant_id, status, created_at DESC)
```

---

### 11.5 chat_messages

**Purpose:** Individual messages within a thread.

```sql
chat_messages {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE
  tenant_id       UUID NOT NULL REFERENCES tenants(id)
  role            ENUM('USER', 'ASSISTANT', 'SYSTEM') NOT NULL
  content         TEXT NOT NULL
  token_count     INT               -- approximate token count
  tool_run_id     UUID              -- FK to tool_runs if assistant msg used tool
  model_used      VARCHAR(100)      -- which model generated this response
  latency_ms      INT               -- LLM response latency
  created_at      TIMESTAMPTZ DEFAULT NOW()
}

INDEX idx_messages_chat ON chat_messages(chat_id, created_at ASC)
```

---

### 11.6 llm_providers

**Purpose:** Catalog of supported LLM provider types (platform-level, not tenant-level).

```sql
llm_providers {
  id            UUID PRIMARY KEY
  name          VARCHAR(100) NOT NULL  -- 'gemini', 'openai', 'custom'
  default_url   VARCHAR(500) NOT NULL
  is_active     BOOLEAN DEFAULT TRUE
}
```

---

### 11.7 provider_configs

**Purpose:** Per-tenant LLM configuration with encrypted API key.

```sql
provider_configs {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL REFERENCES tenants(id)
  provider_id     UUID NOT NULL REFERENCES llm_providers(id)
  api_key_enc     TEXT NOT NULL       -- AES-256-GCM encrypted
  base_url        VARCHAR(500)        -- overrides provider default_url if set
  model           VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-pro'
  temperature     DECIMAL(3,2) DEFAULT 0.7
  max_tokens      INT DEFAULT 2048
  timeout_ms      INT DEFAULT 30000
  is_active       BOOLEAN DEFAULT TRUE
  last_tested_at  TIMESTAMPTZ
  test_status     ENUM('UNTESTED', 'OK', 'FAILED') DEFAULT 'UNTESTED'
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()

  UNIQUE(tenant_id, provider_id)  -- one config per provider per tenant
}
```

---

### 11.8 api_connectors

**Purpose:** External API integration configuration.

```sql
api_connectors {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL REFERENCES tenants(id)
  name            VARCHAR(255) NOT NULL
  description     TEXT
  base_url        VARCHAR(500) NOT NULL
  auth_type       ENUM('NONE','BEARER','API_KEY','BASIC','OAUTH2_CLIENT') NOT NULL
  auth_config_enc TEXT                -- encrypted JSON: { token, key, username, password, etc }
  default_headers JSONB DEFAULT '{}'  -- non-sensitive default headers
  status          ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE'
  last_tested_at  TIMESTAMPTZ
  test_status     ENUM('UNTESTED','OK','FAILED') DEFAULT 'UNTESTED'
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.9 api_connector_endpoints

**Purpose:** Individual endpoint templates per API connector.

```sql
api_connector_endpoints {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  connector_id    UUID NOT NULL REFERENCES api_connectors(id) ON DELETE CASCADE
  tenant_id       UUID NOT NULL
  name            VARCHAR(255) NOT NULL
  description     TEXT
  method          ENUM('GET','POST','PUT','PATCH') NOT NULL
  path_template   VARCHAR(500) NOT NULL  -- e.g. /customers/{{customer_id}}
  query_params    JSONB DEFAULT '{}'     -- static + template params
  body_template   JSONB                  -- body template with {{vars}}
  timeout_ms      INT DEFAULT 10000
  retry_count     INT DEFAULT 1
}
```

---

### 11.10 db_connectors

**Purpose:** Database connection configuration.

```sql
db_connectors {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL REFERENCES tenants(id)
  name            VARCHAR(255) NOT NULL
  db_type         ENUM('POSTGRESQL','MYSQL') NOT NULL
  host            VARCHAR(500) NOT NULL
  port            INT NOT NULL
  database_name   VARCHAR(255) NOT NULL
  username_enc    TEXT NOT NULL  -- encrypted
  password_enc    TEXT NOT NULL  -- encrypted
  ssl_mode        ENUM('DISABLE','REQUIRE','VERIFY-CA','VERIFY-FULL') DEFAULT 'REQUIRE'
  status          ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE'
  last_tested_at  TIMESTAMPTZ
  test_status     ENUM('UNTESTED','OK','FAILED') DEFAULT 'UNTESTED'
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.11 db_query_templates

**Purpose:** Pre-defined, parameterized query templates per DB connector.

```sql
db_query_templates {
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  connector_id  UUID NOT NULL REFERENCES db_connectors(id) ON DELETE CASCADE
  tenant_id     UUID NOT NULL
  name          VARCHAR(255) NOT NULL
  description   TEXT
  sql_template  TEXT NOT NULL  -- SELECT ... WHERE col = $1 AND other = $2
  params        JSONB NOT NULL -- [{ name, type, source: 'user_input'|'extracted' }]
  timeout_ms    INT DEFAULT 5000
}
```

---

### 11.12 connector_schema_mappings

**Purpose:** Field aliasing and normalization for connector output.

```sql
connector_schema_mappings {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  connector_id    UUID NOT NULL  -- polymorphic: api or db connector id
  connector_type  ENUM('API','DB') NOT NULL
  tenant_id       UUID NOT NULL
  field_mappings  JSONB NOT NULL
  /*
  field_mappings structure:
  [
    {
      "source_path": "$.data.customer.email",
      "alias": "customer_email",
      "type": "string",
      "include_in_context": true,
      "maskable": true
    }
  ]
  */
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.13 masking_rules

**Purpose:** Configurable field masking rules per tenant.

```sql
masking_rules {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL REFERENCES tenants(id)
  name            VARCHAR(255) NOT NULL
  match_type      ENUM('FIELD_NAME','REGEX','GLOB') NOT NULL
  match_pattern   VARCHAR(500) NOT NULL
  strategy        ENUM('FULL_REDACT','PARTIAL_MASK','TOKENIZE') NOT NULL
  mask_config     JSONB DEFAULT '{}'
  -- PARTIAL_MASK: { show_last: 4, char: '*' }
  -- TOKENIZE: { prefix: 'TOKEN_' }
  priority        INT DEFAULT 100  -- lower number = higher priority
  is_active       BOOLEAN DEFAULT TRUE
  created_at      TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.14 tool_runs

**Purpose:** Execution record for every connector invocation during a chat turn.

```sql
tool_runs {
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL
  chat_id         UUID NOT NULL REFERENCES chats(id)
  message_id      UUID REFERENCES chat_messages(id)
  connector_id    UUID NOT NULL
  connector_type  ENUM('API','DB') NOT NULL
  endpoint_name   VARCHAR(255)
  params_used     JSONB  -- sanitized params (no secrets)
  status          ENUM('SUCCESS','FAILED','TIMEOUT') NOT NULL
  latency_ms      INT
  masked_fields   JSONB  -- list of field names that were masked
  error_message   TEXT   -- sanitized error if failed
  created_at      TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.15 audit_logs

**Purpose:** Immutable, structured audit trail.

```sql
audit_logs {
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id   UUID NOT NULL
  user_id     UUID REFERENCES users(id)
  action      VARCHAR(255) NOT NULL  -- e.g. 'connector.create', 'llm.call', 'masking.applied'
  resource_type VARCHAR(100)         -- 'connector', 'chat', 'user', 'config'
  resource_id VARCHAR(255)
  ip_address  INET
  user_agent  TEXT
  payload     JSONB DEFAULT '{}'    -- sanitized context, NO PII, NO secrets
  status      ENUM('SUCCESS','FAILURE') NOT NULL
  created_at  TIMESTAMPTZ DEFAULT NOW()
}

INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC)
INDEX idx_audit_user ON audit_logs(user_id, created_at DESC)
```

---

### 11.16 subscription_plans

**Purpose:** Platform-level plan definitions.

```sql
subscription_plans {
  id            UUID PRIMARY KEY
  name          VARCHAR(100) NOT NULL  -- 'FREE', 'PRO', 'ENTERPRISE'
  max_users     INT                    -- NULL = unlimited
  max_connectors INT                   -- 1 for FREE
  features      JSONB NOT NULL         -- feature flag map
  created_at    TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.17 upgrade_requests

**Purpose:** Capture upgrade intent before WhatsApp redirect.

```sql
upgrade_requests {
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id         UUID NOT NULL
  user_id           UUID NOT NULL
  feature_attempted VARCHAR(255)
  whatsapp_opened   BOOLEAN DEFAULT FALSE
  created_at        TIMESTAMPTZ DEFAULT NOW()
}
```

---

### 11.18 whatsapp_redirect_logs

**Purpose:** Track every WhatsApp upgrade redirect.

```sql
whatsapp_redirect_logs {
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
  upgrade_request_id UUID REFERENCES upgrade_requests(id)
  tenant_id         UUID NOT NULL
  user_id           UUID NOT NULL
  redirect_url      TEXT NOT NULL
  created_at        TIMESTAMPTZ DEFAULT NOW()
}
```

---

## 12. API Design

All routes prefixed with `/api/v1`. All endpoints require `Authorization: Bearer <access_token>` unless marked public. All responses use envelope: `{ success: boolean, data: T | null, error: ErrorObject | null }`.

---

### 12.1 Auth

```
POST   /api/v1/auth/register
  Body: { email, password, full_name, company_name }
  Response: { user, access_token }
  Auth: Public
  Notes: Creates tenant + admin user. Rate limited: 10/hr per IP.

POST   /api/v1/auth/login
  Body: { email, password }
  Response: { user, access_token } + Set-Cookie: refresh_token (HTTP-only)
  Auth: Public
  Rate limit: 5 failures → lockout

POST   /api/v1/auth/refresh
  Cookie: refresh_token
  Response: { access_token }
  Auth: Refresh token (cookie)

POST   /api/v1/auth/logout
  Response: 204
  Action: Invalidates refresh token

GET    /api/v1/auth/me
  Response: { user }
  Auth: Required
```

---

### 12.2 Chats

```
GET    /api/v1/chats
  Query: { page, limit, status }
  Response: { chats: Chat[], total, page }
  Auth: Required

POST   /api/v1/chats
  Body: { title? }
  Response: { chat: Chat }
  Auth: Required

GET    /api/v1/chats/:id
  Response: { chat, messages: Message[] }
  Auth: Required | Ownership check

PATCH  /api/v1/chats/:id
  Body: { title?, status? }
  Response: { chat }
  Auth: Required | Ownership check

DELETE /api/v1/chats/:id
  Response: 204
  Auth: Required | Ownership check

POST   /api/v1/chats/:id/messages
  Body: { content: string }
  Response: { message: AssistantMessage }
  Auth: Required
  Notes: Triggers full message pipeline. Synchronous for V1.
  Validation: content max 4000 chars, chat must be ACTIVE
```

---

### 12.3 LLM Provider Config

```
GET    /api/v1/settings/llm
  Response: { config } (api_key masked to last 4)
  Auth: TENANT_ADMIN

PUT    /api/v1/settings/llm
  Body: { provider_id, api_key?, base_url?, model, temperature, max_tokens }
  Response: { config }
  Auth: TENANT_ADMIN
  Notes: api_key is optional — only updated if provided

POST   /api/v1/settings/llm/test
  Response: { status: 'OK' | 'FAILED', message? }
  Auth: TENANT_ADMIN
  Notes: Tests current saved config
```

---

### 12.4 API Connectors

```
GET    /api/v1/connectors/api
  Response: { connectors: ApiConnector[] }
  Auth: TENANT_ADMIN | ANALYST (read-only)

POST   /api/v1/connectors/api
  Body: { name, base_url, auth_type, auth_config, default_headers }
  Response: { connector }
  Auth: TENANT_ADMIN
  Plan gate: FREE → max 1 connector

GET    /api/v1/connectors/api/:id
  Response: { connector, endpoints, mapping }
  Auth: TENANT_ADMIN

PATCH  /api/v1/connectors/api/:id
  Body: partial fields
  Response: { connector }
  Auth: TENANT_ADMIN

DELETE /api/v1/connectors/api/:id
  Response: 204
  Auth: TENANT_ADMIN

POST   /api/v1/connectors/api/:id/test
  Response: { status, response_preview }
  Auth: TENANT_ADMIN

POST   /api/v1/connectors/api/:id/endpoints
  Body: { name, method, path_template, query_params, body_template }
  Response: { endpoint }
  Auth: TENANT_ADMIN

PUT    /api/v1/connectors/api/:id/mapping
  Body: { field_mappings: FieldMapping[] }
  Response: { mapping }
  Auth: TENANT_ADMIN
```

---

### 12.5 DB Connectors

```
GET    /api/v1/connectors/db
POST   /api/v1/connectors/db
  Body: { name, db_type, host, port, database_name, username, password, ssl_mode }
  Plan gate: FREE → max 1 connector total (shared with API)

GET    /api/v1/connectors/db/:id
PATCH  /api/v1/connectors/db/:id
DELETE /api/v1/connectors/db/:id

POST   /api/v1/connectors/db/:id/test
  Response: { status, tables_discovered: string[] }

GET    /api/v1/connectors/db/:id/schema
  Response: { tables: [{ name, columns: [{ name, type }] }] }
  Notes: Metadata only — no data rows

POST   /api/v1/connectors/db/:id/queries
  Body: { name, description, sql_template, params }
  Validation: SQL must start with SELECT, no DDL/DML keywords

PUT    /api/v1/connectors/db/:id/mapping
  Body: { field_mappings }
```

---

### 12.6 Masking Rules

```
GET    /api/v1/settings/masking
POST   /api/v1/settings/masking
  Body: { name, match_type, match_pattern, strategy, mask_config, priority }

PATCH  /api/v1/settings/masking/:id
DELETE /api/v1/settings/masking/:id

POST   /api/v1/settings/masking/preview
  Body: { sample_payload: object }
  Response: { masked_payload, fields_masked: string[] }
  Auth: TENANT_ADMIN
  Notes: Does not store data — preview only
```

---

### 12.7 Upgrade

```
POST   /api/v1/upgrade/request
  Body: { feature_attempted? }
  Response: { upgrade_request_id, whatsapp_url }
  Auth: Required
  Notes: Logs event, returns pre-filled WhatsApp URL
```

---

### 12.8 Audit Logs

```
GET    /api/v1/audit
  Query: { page, limit, action?, user_id?, from_date?, to_date? }
  Response: { logs: AuditLog[], total }
  Auth: TENANT_ADMIN
```

---

### 12.9 Health

```
GET    /health
  Response: { status, db, redis, llm_provider }
  Auth: Public (internal monitoring)
```

---

## 13. Connector Framework Design

### 13.1 Connector Interface

```typescript
interface ConnectorExecutionResult {
  raw: unknown;
  transformed: Record<string, unknown>;
  masked: Record<string, unknown>;
  masked_fields: string[];
  latency_ms: number;
  connector_id: string;
}

interface IConnector {
  type: 'API' | 'DB';
  test(): Promise<{ ok: boolean; message?: string }>;
  execute(params: Record<string, unknown>): Promise<ConnectorExecutionResult>;
}
```

### 13.2 API Connector Design

```typescript
class ApiConnector implements IConnector {
  // Stored config (loaded from DB, credentials decrypted server-side)
  private config: ApiConnectorConfig;

  // Builds full URL from base_url + path_template + resolved params
  private buildUrl(endpoint: ApiEndpoint, params: Record<string, unknown>): string

  // Resolves {{variable}} tokens in templates
  private resolveTemplate(template: string, params: Record<string, unknown>): string

  // Injects auth header based on auth_type
  private buildAuthHeaders(): Record<string, string>

  // Executes with configured timeout and retry
  async execute(params): Promise<ConnectorExecutionResult>
}
```

**Auth type handling:**

| Auth Type | Implementation |
|-----------|----------------|
| NONE | No auth header |
| BEARER | `Authorization: Bearer {token}` |
| API_KEY | Custom header or query param (configurable) |
| BASIC | `Authorization: Basic base64(user:pass)` |
| OAUTH2_CLIENT | Server-side client_credentials token fetch + cache in Redis (5 min TTL) |

**Pagination:** Supported via cursor or page-based config on the endpoint. Tool layer requests page 1 only for V1 (configurable limit).

**Retry:** Max 2 retries on 5xx or timeout. Exponential backoff: 500ms, 1000ms. No retry on 4xx.

---

### 13.3 DB Connector Design

```typescript
class DbConnector implements IConnector {
  private pool: pg.Pool | mysql.Pool;  // connection pool, initialized lazily

  // Validates SQL at template save time
  static validateSql(sql: string): { valid: boolean; reason?: string }

  // Executes a named template with typed params
  async executeTemplate(
    templateId: string,
    params: Record<string, unknown>
  ): Promise<ConnectorExecutionResult>

  // Schema discovery — metadata only
  async discoverSchema(): Promise<TableSchema[]>

  // Connection test
  async test(): Promise<{ ok: boolean; message?: string }>
}
```

**SQL Safety Controls:**

```typescript
const FORBIDDEN_SQL_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'COPY', 'VACUUM', 'ANALYZE',
  '--', ';', '/*', '*/'
];

function validateSqlTemplate(sql: string): ValidationResult {
  const normalized = sql.trim().toUpperCase();

  // Must start with SELECT
  if (!normalized.startsWith('SELECT')) {
    return { valid: false, reason: 'Only SELECT statements are permitted' };
  }

  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return { valid: false, reason: `Forbidden keyword: ${keyword}` };
    }
  }

  // Must use $1, $2 params — not string interpolation
  if (/{{\w+}}/.test(sql)) {
    return { valid: false, reason: 'Use $1 parameter style, not template variables' };
  }

  return { valid: true };
}
```

**Connection pooling:** Max 5 connections per DB connector. Pools are keyed by `connector_id` and stored in a `Map` on the connector service. Idle timeout: 30 seconds. Pools closed when connector is deleted.

**SSL:** All DB connections require SSL in production. `ssl_mode: REQUIRE` minimum.

---

## 14. Prompt Masking / Redaction Engine

### 14.1 Architecture

The masking engine is a pure transformation function — it takes data in, applies rules, returns masked data + metadata. No side effects except audit logging.

```typescript
interface MaskingResult {
  masked_data: Record<string, unknown>;
  masked_fields: string[];       // field names that were masked
  masking_applied: boolean;
}

class MaskingEngine {
  constructor(private rules: MaskingRule[]) {}

  apply(data: Record<string, unknown>): MaskingResult {
    // Deep-walk the data object
    // For each leaf value, check if the key matches any rule
    // Apply first matching rule (by priority)
    // Return modified copy — never mutate input
  }
}
```

### 14.2 Masking Strategies

**FULL_REDACT:**
```
customer_email: "john@example.com" → customer_email: "[REDACTED]"
```

**PARTIAL_MASK:** (show last N chars)
```
account_number: "1234567890" → account_number: "******7890"
```

**TOKENIZE:**
```
ssn: "123-45-6789" → ssn: "TOKEN_a3f9c2"
(Token stored in Redis with 1hr TTL — not restored to LLM context)
```

### 14.3 Rule Matching

```typescript
type MatchType = 'FIELD_NAME' | 'REGEX' | 'GLOB';

function matchesRule(fieldName: string, rule: MaskingRule): boolean {
  switch (rule.match_type) {
    case 'FIELD_NAME': return fieldName === rule.match_pattern;
    case 'REGEX':      return new RegExp(rule.match_pattern, 'i').test(fieldName);
    case 'GLOB':       return minimatch(fieldName, rule.match_pattern);
  }
}
```

**Default system rules (always applied, cannot be disabled):**
- `*password*` → FULL_REDACT
- `*secret*` → FULL_REDACT
- `*token*` → FULL_REDACT
- `*api_key*` → FULL_REDACT

**Tenant-configurable rules** layered on top, processed by priority order.

### 14.4 What Is Never Sent to LLM

- Raw unmasked PII fields after masking rules apply
- Database credentials
- API keys or tokens
- Internal IP addresses
- System user IDs (opaque references only)

### 14.5 Preview Capability

`POST /api/v1/settings/masking/preview` accepts a sample JSON payload and returns the masked version. This is server-side only — the preview endpoint never stores the sample data. Useful for admins to verify masking rules before going live.

### 14.6 Audit

For every request, the masking engine emits:
```json
{
  "action": "masking.applied",
  "masked_fields": ["customer_email", "account_balance"],
  "rule_names_applied": ["Email Redaction", "Financial Mask"],
  "connector_id": "...",
  "chat_id": "..."
}
```
**Never logged:** the actual values before or after masking.

---

## 15. LLM Provider Abstraction Layer

### 15.1 Provider Interface

```typescript
interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMCompletionRequest {
  messages: LLMMessage[];
  model: string;
  temperature: number;
  max_tokens: number;
}

interface LLMCompletionResponse {
  content: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  finish_reason: 'stop' | 'length' | 'error';
  latency_ms: number;
}

interface ILLMProvider {
  name: string;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}
```

### 15.2 Gemini Adapter (Default)

```typescript
class GeminiProvider implements ILLMProvider {
  name = 'gemini';

  constructor(private config: ProviderConfig) {}

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Map messages to Gemini's contents format
    // POST to {base_url}/models/{model}:generateContent?key={api_key}
    // Parse candidates[0].content.parts[0].text
    // Normalize to LLMCompletionResponse
    // Handle errors: 400 (bad request), 401 (invalid key), 429 (rate limit), 500
  }
}
```

**Gemini-specific notes:**
- System prompt injected as first `user` turn followed by `model` acknowledgment (Gemini does not have a dedicated system role in all versions)
- `generationConfig.stopSequences` used for structured output hints
- Token counting via `countTokens` endpoint before large context submissions

### 15.3 Error Normalization

```typescript
type LLMErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CONTEXT_TOO_LARGE'
  | 'MODEL_NOT_FOUND'
  | 'PROVIDER_UNREACHABLE'
  | 'RESPONSE_MALFORMED'
  | 'TIMEOUT';

class LLMError extends Error {
  constructor(
    public code: LLMErrorCode,
    public message: string,
    public retryable: boolean,
    public provider: string
  ) {}
}
```

### 15.4 Retry and Timeout

- Timeout: configurable per tenant, default 30s
- Retry: 1 retry on `PROVIDER_UNREACHABLE` or `RATE_LIMIT_EXCEEDED` (with 2s delay)
- No retry on `INVALID_API_KEY`, `CONTEXT_TOO_LARGE`, `MODEL_NOT_FOUND`

### 15.5 Provider Resolution

```typescript
class LLMProviderFactory {
  static async resolve(tenantId: string): Promise<ILLMProvider> {
    const config = await providerConfigRepo.getActive(tenantId);
    if (!config) throw new Error('No LLM provider configured');

    const decryptedKey = cryptoService.decrypt(config.api_key_enc);

    switch (config.provider.name) {
      case 'gemini': return new GeminiProvider({ ...config, api_key: decryptedKey });
      case 'openai': return new OpenAIProvider({ ...config, api_key: decryptedKey });
      default:       return new GenericOpenAICompatProvider({ ...config, api_key: decryptedKey });
    }
  }
}
```

---

## 16. Chat UX Specification

### 16.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐  ┌─────────────────────────────────────┐ │
│  │  LEFT SIDEBAR       │  │  CHAT PANEL                         │ │
│  │  (260px fixed)      │  │  (flex-1)                           │ │
│  │                     │  │                                     │ │
│  │  [Logo / Brand]     │  │  ┌──────────────────────────────┐   │ │
│  │                     │  │  │  THREAD HEADER               │   │ │
│  │  [+ New Chat]       │  │  │  Thread title | Model badge  │   │ │
│  │                     │  │  │  Connector indicator         │   │ │
│  │  ── Today ──        │  │  └──────────────────────────────┘   │ │
│  │  > Chat 1 title     │  │                                     │ │
│  │  > Chat 2 title     │  │  ┌──────────────────────────────┐   │ │
│  │  ── Yesterday ──    │  │  │  MESSAGE THREAD              │   │ │
│  │  > Chat 3 title     │  │  │  (scrollable)                │   │ │
│  │                     │  │  │                              │   │ │
│  │  ── Settings ──     │  │  │  [User bubble]               │   │ │
│  │  Configuration      │  │  │  [Assistant bubble]          │   │ │
│  │  Connectors         │  │  │  [Source attribution]        │   │ │
│  │  Audit Logs         │  │  └──────────────────────────────┘   │ │
│  │  Plan: Free [↑]     │  │                                     │ │
│  └─────────────────────┘  │  ┌──────────────────────────────┐   │ │
│                            │  │  INPUT AREA                  │   │ │
│                            │  │  [textarea] [Send]           │   │ │
│                            │  └──────────────────────────────┘   │ │
│                            └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 16.2 Sidebar

- **Width:** 260px, collapsible to 48px (icon-only mode) on narrow viewports
- **New Chat button:** Prominent, top of sidebar, icon + text. On mobile: icon only.
- **Thread list:** Grouped by date (Today, Yesterday, Last 7 Days, Older). Each item shows truncated title (max 28 chars) + relative timestamp. Active thread highlighted with accent left border.
- **Thread actions (on hover):** Rename (pencil icon), Archive (box icon), Delete (trash icon) — right-side micro-actions.
- **Settings section:** Bottom of sidebar. Links to Config, Connectors, Audit. Plan badge shows "Free" or "Pro". Free shows subtle upgrade nudge.

### 16.3 Chat Panel

**Thread Header (top bar):**
- Thread title (editable inline on click)
- Model badge: `gemini-1.5-pro` pill — neutral gray background, monospace font
- Connector indicator: shows which connector(s) are active for this chat (e.g., "CRM API" chip)

**Message Thread:**
- User messages: right-aligned, muted background, no avatar
- Assistant messages: left-aligned, white card, subtle shadow, avatar initials
- Timestamps: shown on hover (micro-interaction)
- Copy button on assistant messages (hover)
- Markdown rendered: code blocks with syntax highlighting (Prism), bold, lists, tables
- **Loading state:** Three-dot animated pulse with "Thinking..." label
- **Streaming state (V2):** Token-by-token reveal with blinking cursor

**Source Attribution Panel:**
- Collapsed by default — "Sources" button at bottom of assistant message
- Expands to show: connector name, query/endpoint used, timestamp of data fetch
- Never shows raw data — only metadata

**Input Area:**
- `<textarea>` with auto-expand (max 5 rows)
- Character counter (4000 max) — appears when >80% full
- Send button with keyboard shortcut (⌘Enter / Ctrl+Enter)
- Disabled state when pipeline is running
- Connector context selector (optional in V1 — auto-detected)

### 16.4 Empty States

**No chats:** Large centered illustration (minimal SVG), "Start a new conversation" text, prominent "New Chat" button.

**No connectors configured:** Assistant response includes inline CTA: "Connect a data source in Settings to enable personalized answers." — non-blocking, informational.

**No LLM key configured:** Blocking empty state with direct link to LLM Config page.

### 16.5 Configuration Pages

**/settings/llm:**
- Clean form card: Provider (select), API Key (password input + test button), Base URL (text, placeholder = default), Model, Temperature (slider), Max Tokens
- "Test Connection" button with loading state → green check or red error inline
- Save button — disabled until changes are made

**/settings/connectors:**
- List of connectors with type badge (API / DB), status dot (green/red), last tested time
- "Add Connector" button → slides in right panel or modal with type selector
- Each connector card: name, status, health, edit/delete/test actions

**/settings/masking:**
- Table of rules with columns: Name, Match Type, Pattern, Strategy, Priority, Active toggle
- Add rule → inline row expansion or modal
- Preview panel: paste sample JSON, see masked output

### 16.6 Upgrade CTA

- In sidebar footer: "Free Plan" badge → clicking opens Upgrade modal
- Modal: clean 2-column layout, feature comparison (Free vs Pro), single CTA "Talk to Us on WhatsApp"
- CTA button: WhatsApp green (`#25D366`), WhatsApp icon, "Talk to Us on WhatsApp" text
- Modal does NOT auto-close after click — user closes it manually

### 16.7 Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| ≥1280px | Full sidebar + chat panel |
| 768–1279px | Sidebar collapses to icon rail |
| <768px | Sidebar hidden behind hamburger, chat full width |

---

## 17. RBAC and Permissions

### Role Definitions

| Permission | TENANT_ADMIN | ANALYST | VIEWER |
|------------|:---:|:---:|:---:|
| Create/delete users | ✓ | ✗ | ✗ |
| Configure LLM provider | ✓ | ✗ | ✗ |
| Create/edit connectors | ✓ | ✗ | ✗ |
| View connector list | ✓ | ✓ | ✗ |
| Configure masking rules | ✓ | ✗ | ✗ |
| View audit logs | ✓ | ✗ | ✗ |
| Create new chat | ✓ | ✓ | ✗ |
| Send messages | ✓ | ✓ | ✗ |
| View own chats | ✓ | ✓ | ✓ |
| View all tenant chats | ✓ | ✗ | ✗ |
| Request upgrade | ✓ | ✓ | ✗ |
| Test connector | ✓ | ✗ | ✗ |
| Preview masking | ✓ | ✗ | ✗ |

### Enforcement

Role checks are enforced at the middleware layer via a `requireRole(role: Role | Role[])` middleware applied per route — not in the controller. UI hides inaccessible elements but backend always re-validates. UI-only enforcement is never acceptable.

---

## 18. Error Handling Strategy

### Error Response Contract

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;        // machine-readable
    message: string;     // human-readable (safe for display)
    details?: unknown;   // additional context (no secrets)
    request_id: string;  // for support correlation
  };
}
```

### Error Catalog

| Scenario | HTTP Code | Error Code | Message | Retry? |
|----------|-----------|------------|---------|--------|
| Invalid LLM API key | 422 | `LLM_INVALID_KEY` | "LLM API key is invalid. Update it in Settings." | No |
| LLM provider unreachable | 503 | `LLM_UNAVAILABLE` | "The AI provider is currently unavailable. Try again shortly." | Yes (auto) |
| LLM timeout | 504 | `LLM_TIMEOUT` | "The AI took too long to respond. Try a shorter question." | No |
| Prompt too large | 422 | `CONTEXT_TOO_LARGE` | "Your question combined with the data context is too large. Simplify the question." | No |
| DB connector unreachable | 503 | `CONNECTOR_DB_UNREACHABLE` | "Cannot reach the configured database. Check connector settings." | Yes (manual) |
| DB query timeout | 504 | `CONNECTOR_DB_TIMEOUT` | "Database query timed out." | No |
| Invalid schema mapping | 422 | `MAPPING_INVALID` | "Connector schema mapping is misconfigured." | No |
| SQL injection attempt | 400 | `QUERY_UNSAFE` | "This query template contains restricted keywords." | No |
| Unauthorized access | 403 | `FORBIDDEN` | "You do not have permission to perform this action." | No |
| Connector execution failed | 500 | `CONNECTOR_EXEC_FAILED` | "Data connector failed to execute." | No |
| Masked field conflict | 422 | `MASKING_CONFLICT` | "A required field is marked as maskable but is needed for query execution." | No |
| Plan limit exceeded | 402 | `PLAN_LIMIT_EXCEEDED` | "Upgrade to Pro to access this feature." | No |

### Connector Failure Handling

When a connector fails during message pipeline:
1. Tool run is logged with status=FAILED
2. Masking engine is skipped (no data to mask)
3. Context is assembled without connector data
4. LLM is asked to respond: "I couldn't retrieve the requested data at this time. [error_type]. The assistant still answers if possible from conversation context."
5. Response includes a "⚠ Data unavailable" indicator in UI

---

## 19. Audit, Monitoring, and Observability

### 19.1 What Must Be Logged

| Event | Fields Logged |
|-------|---------------|
| User login | user_id, tenant_id, ip, success/failure |
| User logout | user_id, tenant_id |
| Token refresh | user_id, tenant_id |
| LLM config update | tenant_id, admin_user_id, fields_changed (names only, not values) |
| LLM call | tenant_id, user_id, chat_id, model, input_tokens, output_tokens, latency_ms, status |
| Connector created/updated/deleted | tenant_id, admin_id, connector_id, connector_name |
| Connector test | connector_id, status, latency_ms |
| Connector execution | tool_run_id, connector_id, connector_type, latency_ms, status, masked_fields |
| Masking applied | chat_id, connector_id, field_names_masked (not values) |
| Masking rule change | tenant_id, admin_id, rule_id, action |
| Upgrade request | tenant_id, user_id, feature_attempted |
| WhatsApp redirect | tenant_id, user_id, redirect_time |
| Message sent | chat_id, user_id, char_count (no content) |
| RBAC violation attempt | user_id, route, required_role |

### 19.2 What Must NEVER Be Logged

- LLM prompt content or completion content
- User message content
- Unmasked field values
- API keys, tokens, passwords
- Raw database query results
- Personal identifiers (email, phone, SSN) — except user.email in auth context with appropriate access control

### 19.3 Metrics

**LLM metrics (tracked in Redis counters, flushed to DB hourly):**
- `llm.calls.total` per tenant
- `llm.calls.error` per tenant
- `llm.latency.p95` per tenant
- `llm.tokens.input.total` per tenant
- `llm.tokens.output.total` per tenant

**Connector metrics:**
- `connector.calls.total` per connector_id
- `connector.calls.error` per connector_id
- `connector.latency.p95` per connector_id

**Application metrics:**
- Request rate per endpoint
- Error rate per endpoint
- Active sessions

### 19.4 Health Check

```json
GET /health

{
  "status": "OK",
  "timestamp": "2026-03-30T10:00:00Z",
  "components": {
    "database": { "status": "OK", "latency_ms": 4 },
    "redis": { "status": "OK", "latency_ms": 1 },
    "llm_provider": { "status": "OK", "last_checked": "..." }
  }
}
```

### 19.5 Structured Log Format

```json
{
  "timestamp": "2026-03-30T10:00:00.000Z",
  "level": "info",
  "request_id": "req_abc123",
  "tenant_id": "ten_xyz",
  "user_id": "usr_123",
  "action": "llm.call",
  "duration_ms": 2340,
  "status": "success",
  "model": "gemini-1.5-pro",
  "tokens": { "input": 512, "output": 256 }
}
```

---

## 20. Subscription and Upgrade Logic

### 20.1 Plan Feature Matrix

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Users | 1 | 10 | Unlimited |
| Connectors (total) | 1 | Unlimited | Unlimited |
| Chat threads | 50 | Unlimited | Unlimited |
| Message history | 7 days | 90 days | Configurable |
| Masking rules | 5 | Unlimited | Unlimited |
| Audit log retention | 7 days | 90 days | Configurable |
| LLM provider change | ✗ | ✓ | ✓ |
| Multiple LLM providers | ✗ | ✗ | ✓ |
| Schema discovery | ✓ | ✓ | ✓ |
| Connector health dashboard | ✗ | ✓ | ✓ |
| Priority support | ✗ | ✓ | ✓ + SLA |

### 20.2 Feature Gate Implementation

```typescript
async function requirePlan(
  tenantId: string,
  feature: PlanFeature,
  next: () => Promise<void>
): Promise<void> {
  const tenant = await tenantRepo.findById(tenantId);
  const plan = await planRepo.findByName(tenant.plan);

  if (!plan.features[feature]) {
    throw new PlanGateError(feature, tenant.plan);
  }

  await next();
}

// Applied in service layer, not just controller
// Example:
await requirePlan(tenantId, 'MULTIPLE_CONNECTORS', async () => {
  await connectorService.create(data);
});
```

### 20.3 Upgrade Flow

```
1. PlanGateError thrown in service layer
2. API returns 402 with { code: 'PLAN_LIMIT_EXCEEDED', feature: '...' }
3. Frontend intercepts 402 globally (React Query onError)
4. UpgradeModal opens
5. User clicks "Talk to Us on WhatsApp"
6. Frontend: POST /api/v1/upgrade/request { feature_attempted }
7. Backend returns { whatsapp_url }
8. Frontend: window.open(whatsapp_url, '_blank')
9. whatsapp_redirect_logs entry created
```

**WhatsApp URL format:**
```
https://wa.me/91XXXXXXXXXX?text=Hi%20Aadhirai%20Innovations%2C%20I%27m%20interested%20in%20PocketComputer%20Pro.%20Tenant%3A%20{tenant_slug}
```
The tenant slug is appended so the sales team knows who is enquiring.

---

## 21. Security Architecture

### 21.1 Encryption at Rest

**Field-level encryption** for all secrets using AES-256-GCM:
```typescript
interface EncryptedValue {
  ciphertext: string;  // base64
  iv: string;          // base64, 12 bytes
  tag: string;         // base64, 16 bytes (GCM auth tag)
}

class CryptoService {
  private key: Buffer;  // 32 bytes, from env: ENCRYPTION_KEY

  encrypt(plaintext: string): string  // returns JSON-stringified EncryptedValue
  decrypt(encrypted: string): string
}
```

Fields encrypted: `provider_configs.api_key_enc`, `api_connectors.auth_config_enc`, `db_connectors.username_enc`, `db_connectors.password_enc`.

**Database at rest:** Encrypted volume (handled at infrastructure level — cloud provider EBS/disk encryption).

### 21.2 Secret Management

- V1: `ENCRYPTION_KEY` stored as environment variable — never in code, never in git
- V1: All service config via environment variables, loaded via `dotenv` in development only
- V2+: Migrate to AWS Secrets Manager or HashiCorp Vault with automatic rotation
- `.env` files are in `.gitignore`. `.env.example` is committed with placeholder values only.

### 21.3 Backend-Only Connector Access

Enforced by design:
- Browser never receives DB credentials — they are written to the DB encrypted and never returned via API (no GET endpoint returns raw credentials)
- API connectors are called from the Node.js server only — browser makes requests to `/api/v1/chats/:id/messages` only
- Tool execution is synchronous within the message pipeline — no client-side tool execution capability exists

### 21.4 SQL Injection Prevention

- Parameterized queries only (`$1`, `$2`) — Prisma's query builder for application queries, `pg` driver parameterized queries for connector execution
- SQL template validation at save time (keyword allowlist)
- No string concatenation into SQL anywhere in the codebase — enforced by ESLint rule and code review

### 21.5 SSRF Prevention

```typescript
const SSRF_BLOCKLIST = [
  /^10\./,           // RFC1918
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // RFC1918
  /^192\.168\./,     // RFC1918
  /^127\./,          // loopback
  /^169\.254\./,     // link-local
  /^::1$/,           // IPv6 loopback
  /^fc00:/,          // IPv6 ULA
  /^metadata\.google\.internal/,  // GCP metadata
  /^169\.254\.169\.254/,          // AWS metadata
];

function validateOutboundUrl(url: string): void {
  const parsed = new URL(url);

  // Resolve hostname to IP and check against blocklist
  // For V1: block known private ranges by hostname pattern
  // For V2: DNS resolution + IP check

  for (const pattern of SSRF_BLOCKLIST) {
    if (pattern.test(parsed.hostname)) {
      throw new SecurityError('URL points to a private or internal address');
    }
  }
}
```

Tenant-configured outbound URLs (API connector base URLs) are validated through this function at save time and at execution time.

### 21.6 Rate Limiting

```typescript
// Applied via rate-limiter-flexible + Redis
const limits = {
  auth_login:    { points: 5,   duration: 900 },  // 5 per 15 min per IP
  auth_register: { points: 10,  duration: 3600 }, // 10 per hour per IP
  chat_message:  { points: 60,  duration: 60 },   // 60 per min per user
  llm_call:      { points: 20,  duration: 60 },   // 20 per min per tenant
  connector_test:{ points: 10,  duration: 60 },   // 10 per min per user
  api_global:    { points: 1000,duration: 60 },   // global fallback
};
```

### 21.7 CSRF & XSS Protections

- **CSRF:** Refresh token uses SameSite=Strict cookie. State-changing requests require `Authorization` header (which CSRF cannot forge cross-origin). No cookie-only auth for mutations.
- **XSS:** All LLM output rendered via `react-markdown` with `rehype-sanitize`. No `dangerouslySetInnerHTML`. Content Security Policy header set by Nginx.
- **CSP header:**
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'
  ```

### 21.8 Additional Headers (Nginx)

```nginx
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options DENY;
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
```

### 21.9 PII Minimization in Prompt Construction

```typescript
function assemblePrompt(
  systemPrompt: string,
  conversationHistory: LLMMessage[],
  maskedData: Record<string, unknown>,
  userMessage: string
): LLMMessage[] {
  // Verify maskedData has no fields that match known PII patterns
  // before assembling — defence-in-depth double check
  const piiFields = detectPiiFields(maskedData);
  if (piiFields.length > 0) {
    throw new SecurityError(`PII detected in context after masking: ${piiFields.join(', ')}`);
  }

  return [
    { role: 'user',      content: systemPrompt },
    { role: 'assistant', content: 'Understood. I am ready to assist.' },
    ...conversationHistory.slice(-10),  // last 10 turns only
    { role: 'user',      content: buildContextMessage(maskedData, userMessage) }
  ];
}
```

---

## 22. Implementation Phases

### Phase 1: Core Platform Foundation (Weeks 1–4)

**Goal:** Working chat UI with Gemini integration, auth, and basic admin config.

- [ ] Project scaffolding (monorepo, TypeScript configs, ESLint, Prettier)
- [ ] PostgreSQL schema + Prisma migrations (users, tenants, chats, chat_messages, llm_providers, provider_configs)
- [ ] Auth module: register, login, JWT, refresh token, logout
- [ ] LLM provider config module (Gemini default)
- [ ] Chat API: create thread, send message, retrieve history
- [ ] Gemini provider adapter with error normalization
- [ ] Basic message pipeline (no connectors yet): user message → Gemini → response
- [ ] Chat UI: sidebar, thread list, input area, message rendering
- [ ] New Chat functionality
- [ ] LLM Config settings page
- [ ] Docker Compose for local dev (API + DB + Redis)
- [ ] Health check endpoint

**Deliverable:** Working AI chat assistant with Gemini, auth, and LLM config. No connectors yet.

---

### Phase 2: Connector Framework (Weeks 5–9)

**Goal:** API and DB connector support, schema mapping, tool execution, masking.

- [ ] API connector CRUD + endpoint templates
- [ ] DB connector CRUD + query templates + SQL validation
- [ ] Connection test endpoints (both connector types)
- [ ] Schema transformer (JSONPath mapping)
- [ ] Masking engine (FULL_REDACT, PARTIAL_MASK)
- [ ] Tool execution engine (parameter extraction + connector invocation)
- [ ] Message pipeline updated to include tool execution stage
- [ ] Connector configuration UI
- [ ] Schema mapping UI
- [ ] Masking rules UI + preview endpoint
- [ ] Source attribution in chat response
- [ ] Connector health indicator in UI
- [ ] Audit log table + write events for all connector actions

**Deliverable:** Full connector framework. Users can connect APIs and DBs, query data through the assistant.

---

### Phase 3: Enterprise Hardening (Weeks 10–13)

**Goal:** RBAC, audit logs, plan gating, upgrade flow, security hardening.

- [ ] RBAC middleware (role-based route protection)
- [ ] User management (admin can add/remove users)
- [ ] Plan feature gating (connector limits, user limits)
- [ ] Upgrade modal + WhatsApp redirect flow
- [ ] Upgrade/redirect audit logging
- [ ] Audit log viewer UI (filterable table)
- [ ] Rate limiting (Redis-backed, per-user and per-tenant)
- [ ] SSRF prevention for API connector URLs
- [ ] CSP headers + security headers via Nginx config
- [ ] Field-level encryption for all secrets
- [ ] Error handling standardization (error contract across all routes)
- [ ] Input validation (Zod schemas on all endpoints)

**Deliverable:** Production-hardened platform. Safe to demo to enterprise clients.

---

### Phase 4: Advanced Capabilities (Weeks 14–18)

**Goal:** Observability, performance, streaming, extensibility.

- [ ] Structured logging (Winston, request_id propagation)
- [ ] LLM usage metrics (tokens, latency, per tenant)
- [ ] Connector telemetry dashboard
- [ ] SSE streaming for chat responses
- [ ] Token counting before LLM call (prevent oversized prompts)
- [ ] BullMQ for async connector test jobs
- [ ] Tenant settings page (preferences, branding color — minimal)
- [ ] Schema discovery UI (table browser for DB connectors)
- [ ] Multi-provider support (OpenAI-compatible endpoint)
- [ ] Soft-delete and data retention policies
- [ ] Performance testing and connection pool tuning

**Deliverable:** Production-ready v1.0. Suitable for enterprise pilot customers.

---

## 23. Engineering Folder Structure

```
pocketcomputer/
├── apps/
│   ├── web/                          # React SPA
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui base components
│   │   │   │   ├── chat/             # ChatThread, MessageBubble, InputArea
│   │   │   │   ├── sidebar/          # Sidebar, ThreadList, ThreadItem
│   │   │   │   ├── settings/         # LLMConfigForm, ConnectorForm, MaskingRules
│   │   │   │   ├── upgrade/          # UpgradeModal, PlanBadge
│   │   │   │   └── shared/           # Layout, PageHeader, EmptyState, ErrorBoundary
│   │   │   ├── pages/
│   │   │   │   ├── ChatPage.tsx
│   │   │   │   ├── SettingsPage.tsx
│   │   │   │   ├── ConnectorsPage.tsx
│   │   │   │   ├── AuditPage.tsx
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   └── OnboardingPage.tsx
│   │   │   ├── hooks/                # useChat, useConnectors, useLLMConfig, useUpgrade
│   │   │   ├── stores/               # Zustand: authStore, uiStore
│   │   │   ├── services/             # API client functions (TanStack Query wrappers)
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── chat.service.ts
│   │   │   │   ├── connector.service.ts
│   │   │   │   └── config.service.ts
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts     # Axios instance with interceptors
│   │   │   │   ├── query-client.ts   # TanStack Query client config
│   │   │   │   └── utils.ts
│   │   │   ├── types/                # Shared TypeScript types
│   │   │   ├── constants/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts
│   │
│   └── api/                          # Node.js/Express backend
│       ├── src/
│       │   ├── controllers/
│       │   │   ├── auth.controller.ts
│       │   │   ├── chat.controller.ts
│       │   │   ├── connector.controller.ts
│       │   │   ├── config.controller.ts
│       │   │   ├── audit.controller.ts
│       │   │   └── upgrade.controller.ts
│       │   ├── services/
│       │   │   ├── auth.service.ts
│       │   │   ├── chat.service.ts
│       │   │   ├── message-pipeline.service.ts
│       │   │   ├── connector.service.ts
│       │   │   ├── masking.service.ts
│       │   │   ├── schema-transformer.service.ts
│       │   │   ├── audit.service.ts
│       │   │   ├── upgrade.service.ts
│       │   │   └── plan-gate.service.ts
│       │   ├── connectors/
│       │   │   ├── interface.ts          # IConnector interface
│       │   │   ├── api-connector.ts      # ApiConnector implementation
│       │   │   ├── db-connector.ts       # DbConnector implementation
│       │   │   ├── connector-factory.ts  # resolves connector by type/id
│       │   │   └── sql-validator.ts      # SQL safety validation
│       │   ├── llm/
│       │   │   ├── interface.ts          # ILLMProvider interface
│       │   │   ├── gemini.provider.ts
│       │   │   ├── openai-compat.provider.ts
│       │   │   ├── provider-factory.ts
│       │   │   └── context-assembler.ts
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts
│       │   │   ├── rbac.middleware.ts
│       │   │   ├── rate-limit.middleware.ts
│       │   │   ├── tenant.middleware.ts
│       │   │   ├── request-id.middleware.ts
│       │   │   └── error-handler.middleware.ts
│       │   ├── repositories/
│       │   │   ├── chat.repository.ts
│       │   │   ├── connector.repository.ts
│       │   │   ├── user.repository.ts
│       │   │   ├── tenant.repository.ts
│       │   │   ├── provider-config.repository.ts
│       │   │   └── audit.repository.ts
│       │   ├── crypto/
│       │   │   └── crypto.service.ts     # AES-256-GCM encrypt/decrypt
│       │   ├── validation/
│       │   │   ├── auth.schema.ts        # Zod schemas
│       │   │   ├── chat.schema.ts
│       │   │   ├── connector.schema.ts
│       │   │   └── config.schema.ts
│       │   ├── jobs/                     # BullMQ job processors
│       │   │   └── connector-test.job.ts
│       │   ├── types/
│       │   │   ├── express.d.ts          # Extend Request type
│       │   │   └── index.ts
│       │   ├── config/
│       │   │   └── env.ts                # Validated env config (Zod)
│       │   ├── lib/
│       │   │   ├── prisma.ts             # PrismaClient singleton
│       │   │   ├── redis.ts              # Redis client singleton
│       │   │   ├── logger.ts             # Winston logger
│       │   │   └── http-client.ts        # Axios instance for outbound calls
│       │   ├── routes/
│       │   │   └── index.ts              # Route aggregator
│       │   ├── app.ts                    # Express app setup
│       │   └── server.ts                 # Entry point
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── .env.example
│       └── tsconfig.json
│
├── packages/
│   └── shared-types/                 # Shared TS types (API contracts)
│       ├── src/
│       │   ├── api.types.ts
│       │   ├── chat.types.ts
│       │   └── connector.types.ts
│       └── package.json
│
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   │   └── nginx.conf
│   └── scripts/
│       ├── db-seed.ts
│       └── generate-encryption-key.ts
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── package.json                      # Workspace root
├── turbo.json                        # Turborepo config (optional)
└── ARCHITECTURE.md                   # This document
```

---

## 24. Coding Standards & Architecture Rules

### 24.1 Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Files | kebab-case | `message-pipeline.service.ts` |
| Classes | PascalCase | `MessagePipelineService` |
| Functions | camelCase | `assemblePromptContext()` |
| Constants | UPPER_SNAKE | `MAX_MESSAGE_LENGTH` |
| DB columns | snake_case | `tenant_id`, `created_at` |
| API routes | kebab-case | `/api/v1/api-connectors` |
| Env vars | UPPER_SNAKE | `ENCRYPTION_KEY`, `DATABASE_URL` |
| React components | PascalCase | `MessageBubble.tsx` |
| Hooks | camelCase with `use` prefix | `useConnectors.ts` |
| Types/interfaces | PascalCase | `ConnectorExecutionResult` |

### 24.2 Service Boundaries

- **Controllers** receive HTTP requests, validate input (via Zod), call one service method, return response. No business logic.
- **Services** contain business logic. No direct Prisma calls — delegate to repositories.
- **Repositories** contain all database queries. Return domain objects, not Prisma models.
- **Infrastructure layer** (prisma, redis, logger, http-client) has no business logic.

**Cross-cutting:** `AuditService` and `CryptoService` are injected into services that need them — not called from controllers.

### 24.3 DTO Validation

Every incoming request body and query param is validated with a Zod schema before reaching the controller handler:

```typescript
// Validation middleware factory
function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.flatten(),
          request_id: req.id
        }
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
```

### 24.4 Error Contracts

All errors thrown in services extend `AppError`:

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public retryable: boolean = false
  ) { super(message); }
}

class PlanGateError extends AppError { ... }
class SecurityError extends AppError { ... }
class ConnectorError extends AppError { ... }
class LLMError extends AppError { ... }
```

Global error handler middleware catches all `AppError` subclasses and formats the response envelope. Uncaught errors become 500 with sanitized message.

### 24.5 TypeScript Rules

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

`// @ts-ignore` and `as any` are blocked via ESLint. All Prisma query results typed through generated client — no manual type casting.

### 24.6 Test Strategy

| Layer | Type | Tools |
|-------|------|-------|
| Services (business logic) | Unit | Vitest + mock repositories |
| Connectors | Integration | Testcontainers (real PG/MySQL) |
| Masking engine | Unit | Vitest |
| API routes | Integration | Supertest + test database |
| LLM adapter | Unit | Mock HTTP responses |
| UI components | Component | Vitest + React Testing Library |
| E2E critical paths | E2E | Playwright (P2, not V1) |

**Coverage target:** 80% on service layer and masking engine. 100% on SQL validator.

---

## 25. UI Design System Guidance

### 25.1 Color System

```
Background:    #0F1117  (near-black, not pure black — easier on eyes)
Surface:       #1A1D27  (card backgrounds, sidebar)
Surface-2:     #222636  (elevated surfaces, modals)
Border:        #2E3347  (subtle dividers)
Text-primary:  #F0F2F8  (primary text)
Text-secondary:#8B92A9  (muted labels, timestamps)
Text-disabled: #4A5068  (disabled states)

Accent:        #6B6FD4  (primary action, links — deep indigo/purple)
Accent-hover:  #7C80E0
Accent-subtle: #6B6FD420  (transparent accent for highlights)

Success:       #2FB87E
Warning:       #E6A740
Error:         #E05C5C
Info:          #5B9BD5

WhatsApp:      #25D366  (used exclusively on the upgrade CTA)
```

**Design principle:** Dark theme with deep blue-purple accent. Feels like a premium developer tool — similar to Linear, Vercel, or Raycast. Not a consumer app.

### 25.2 Typography

```
Font-family:  Inter (primary), JetBrains Mono (code blocks, model badges)
Scale:
  --text-xs:   12px / 16px
  --text-sm:   13px / 20px
  --text-base: 14px / 22px
  --text-md:   15px / 24px
  --text-lg:   18px / 28px
  --text-xl:   22px / 32px
  --text-2xl:  28px / 36px

Weight:
  Regular: 400 (body)
  Medium:  500 (labels, subheadings)
  Semibold: 600 (headings, buttons)
```

### 25.3 Spacing

8px base grid. All spacing values are multiples of 4: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

### 25.4 Components

**Cards:**
```
Background: var(--surface)
Border: 1px solid var(--border)
Border-radius: 12px
Padding: 20px 24px
Box-shadow: 0 1px 3px rgba(0,0,0,0.3)
```

**Buttons (Primary):**
```
Background: var(--accent)
Color: white
Border-radius: 8px
Padding: 8px 16px
Font-size: 14px font-weight: 600
Hover: var(--accent-hover) + transform: translateY(-1px)
Transition: 150ms ease
```

**Input fields:**
```
Background: #11141E
Border: 1px solid var(--border)
Border-radius: 8px
Padding: 10px 14px
Color: var(--text-primary)
Focus: border-color: var(--accent) + box-shadow: 0 0 0 3px var(--accent-subtle)
```

**Message bubbles:**
```
User:      Background: #1E2236, Border-radius: 16px 16px 4px 16px, max-width: 72%
Assistant: Background: var(--surface), Border: 1px solid var(--border),
           Border-radius: 4px 16px 16px 16px, max-width: 80%
```

**Badges/Pills:**
```
Model badge:     Background: #1A1D27, Border: 1px solid #2E3347,
                 font-family: mono, font-size: 11px, padding: 2px 8px
Status - OK:     Background: #2FB87E20, Color: #2FB87E
Status - Error:  Background: #E05C5C20, Color: #E05C5C
Plan - Free:     Background: #E6A74020, Color: #E6A740
Plan - Pro:      Background: #6B6FD420, Color: #7C80E0
```

### 25.5 Micro-Interactions

- Hover on thread items: background transitions in 120ms
- Send button: scales to 0.96 on press
- New Chat button: subtle pulse animation on empty state
- Loading state: skeleton shimmer on thread list items
- Connector health dot: green pulse animation when HEALTHY
- Modal: fade + scale-up (opacity 0→1, scale 0.96→1, 200ms)
- Message appear: fade-in 150ms with 8px upward translate
- Error toast: slides in from right, auto-dismisses after 5s

### 25.6 Empty States

```
Style: centered SVG illustration (60px),
       heading in --text-lg semibold,
       subtext in --text-sm --text-secondary,
       CTA button below (only if actionable)
```

---

## 26. Developer Starter Plan

### Recommended Order of Implementation

**Week 1–2: Foundation**
1. Set up monorepo (pnpm workspaces)
2. Backend: TypeScript + Express scaffold with ESLint, Prettier, Vitest
3. DB: PostgreSQL + Prisma schema for users, tenants, chats, messages
4. Auth: register + login + JWT + refresh token
5. Frontend: Vite + React + Tailwind + shadcn/ui scaffold
6. Login/register pages
7. Docker Compose (API + DB + Redis)

**Week 3: Core Chat**
1. Chat CRUD API (create, list, get, delete)
2. Chat message API (send, list)
3. Gemini provider adapter (direct HTTP, no SDK)
4. Basic message pipeline (no tools, just Gemini)
5. Chat UI: sidebar + thread list + message area + input
6. New Chat functionality
7. Auto-naming threads

**Week 4: LLM Config**
1. LLM provider config API (CRUD + test)
2. CryptoService for field encryption
3. Settings page: LLM config form
4. Onboarding flow (API key prompt)
5. Model badge in chat UI

**Week 5–6: API Connector**
1. API connector CRUD + endpoint templates
2. Connection test
3. Schema mapping
4. Tool execution engine (API path)
5. Message pipeline updated with tool execution
6. Connector settings UI

**Week 7–8: DB Connector**
1. DB connector CRUD + query templates
2. SQL validator
3. DB connection pool management
4. Schema discovery
5. Connection test
6. Tool execution engine (DB path)
7. DB connector settings UI

**Week 9: Masking**
1. Masking rules CRUD
2. MaskingEngine implementation (FULL_REDACT + PARTIAL_MASK)
3. Integration into message pipeline
4. Masking rules UI + preview endpoint
5. Audit logging for masking events

**Week 10: RBAC + Plan Gating**
1. Role-based middleware
2. Plan feature matrix
3. Feature gate service
4. Upgrade modal + WhatsApp flow
5. Upgrade request logging

**Week 11: Audit + Hardening**
1. Audit log writer service
2. Audit log viewer API + UI
3. Rate limiting (Redis)
4. SSRF prevention
5. Security headers via Nginx

**Week 12: Polish + Release**
1. Error handling standardization
2. Loading/empty/error states in UI
3. Health check endpoint
4. Basic documentation
5. Environment-based config review
6. Manual QA

### Risk Areas

| Risk | Mitigation |
|------|-----------|
| Gemini API format changes | Isolate in adapter — change one file only |
| DB connection pool exhaustion under load | Configure max pool size + timeout + monitoring |
| Large LLM context (token overflow) | Token count before send, truncate history to last N turns |
| SQL template bypass | Comprehensive SQL validator unit tests + penetration testing |
| SSRF via connector URL | Validate at save AND at execution time |
| Refresh token theft | HTTP-only cookie + rotation + family invalidation on reuse |
| Encryption key loss | Document key rotation procedure before going to production |

### Senior Engineering Advice

1. **Build the masking engine as a pure function first.** It should have zero dependencies and 100% test coverage before anything else touches it. It is your trust anchor.

2. **Write the SQL validator before the DB connector.** Ship the validator tests, then build the connector on top. The order matters for security.

3. **Keep the LLM adapter thin.** Resist the temptation to put business logic in it. It takes messages in, returns a response, normalizes errors — that is all.

4. **Encrypt secrets from day 1.** Retrofitting encryption into an existing schema is painful and error-prone. Do it in migration 001.

5. **Add request_id to every log line from the start.** Debugging production issues without correlation IDs is amateur. Set this up in week 1.

6. **Do not start with streaming.** Polling-based synchronous responses are simpler, easier to debug, and sufficient for V1. Add SSE in Phase 4 when the pipeline is stable.

7. **Rate limiting must be Redis-backed from day 1.** In-memory rate limits are useless with multiple server instances. Even in development, use Redis to avoid surprises.

---

## 27. Final Recommendation Summary

### Architecture Decisions — Rationale

**1. Direct Gemini Integration (No Framework Wrapper)**

For V1, call the Gemini REST API directly using Axios with a thin provider adapter class. This gives you:
- Full control over request format, timeout, retry logic
- Easy debugging — you can log the exact payload in and out
- No framework version dependency
- Simple migration path to other providers (swap the adapter)

The Gemini SDK exists but is not necessary. The API is straightforward and the adapter is ~150 lines.

**2. Custom Orchestration Over Agent Frameworks**

The message pipeline in this system is deterministic and linear: intent → tool → transform → mask → context → LLM → response. This maps to five clean service functions. There is no need for a loop, no uncertainty about which tool to call next, no multi-step planning.

LangChain would add 3 layers of abstraction to a 5-step pipeline. It would obscure the masking stage (critical for compliance), make the tool execution harder to audit, and create dependency on a rapidly-evolving framework. The overhead is unjustified.

**3. LangGraph — Introduce in V3**

When the product roadmap reaches multi-step reasoning — "get customer profile, then check their orders, then summarize their account health" — LangGraph's directed acyclic graph with state machine semantics is the right solution. It handles:
- Multi-step agent cycles
- Conditional tool selection
- Working memory between steps
- Human-in-the-loop checkpoints

Before that, it is premature. The custom pipeline is simpler, faster, and more auditable.

**4. PostgreSQL Over MongoDB**

The data model has clear relational structure: tenants → users → chats → messages, connectors → mappings → masking rules. Relational integrity and tenant-scoped row-level queries are best served by PostgreSQL. JSON fields (JSONB) handle the flexible config payloads (field_mappings, auth_config) without sacrificing relational structure.

**5. Prisma Over Drizzle for V1**

Prisma's code generation produces strongly-typed query results that catch schema/code mismatches at compile time. For a team building quickly, this eliminates a class of runtime bugs. Drizzle is faster and more lightweight but requires more manual type management. The performance difference is irrelevant at V1 scale. Drizzle is a valid choice for V2 if raw query performance becomes a constraint.

**6. Zustand Over Redux**

The frontend state is minimal: current user, current chat, UI flags. Redux's boilerplate is disproportionate. Zustand gives typed stores in ~20 lines. TanStack Query handles all server state — auth, chats, connectors — so Zustand only manages client-local UI state.

**7. Security-First, Not Security-Later**

The masking engine, field encryption, SQL validator, and SSRF prevention are built in Phase 1–2, not tacked on in Phase 3. Security retrofitting is expensive and unreliable. These are architectural constraints, not features.

---

*This document is the authoritative product specification for PocketComputer v1.0.*
*All engineering decisions should be validated against this document.*
*Updates require a version increment and architect sign-off.*

---

**Aadhirai Innovations — Confidential**
