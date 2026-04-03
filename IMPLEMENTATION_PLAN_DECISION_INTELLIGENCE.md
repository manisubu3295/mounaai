# Decision-Intelligence Implementation Plan

This document translates the target architecture in [DECISION_INTELLIGENCE_PLATFORM_ARCHITECTURE.md](d:/Aadhirai-web/pocketcomputer/DECISION_INTELLIGENCE_PLATFORM_ARCHITECTURE.md) into a concrete implementation path for the current PocketComputer monorepo.

It is intentionally repo-specific. It assumes the existing foundation remains valuable:
- React web shell and authenticated layout already exist.
- Express API, Prisma schema, Redis integration, auth, audit, connector basics, and upgrade gating already exist.
- The current chat-centric experience becomes one module inside a broader decision-intelligence platform rather than the final product boundary.

## 1. Current State Assessment

### Strengths Already Present

Backend foundation already exists in the API app:
- Auth and JWT flow
- Tenant-aware data model base
- LLM provider abstraction
- API and DB connector model
- Masking service
- Audit logging pattern
- Plan gating pattern
- Health endpoint and Redis integration

Frontend foundation already exists in the web app:
- Auth bootstrap and protected routes in [apps/web/src/App.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/App.tsx)
- Shared layout pattern
- Chat UI primitives
- Settings routes for LLM, connectors, and audit

### Structural Gaps Relative to the New Target Product

The current repo is optimized for a secure enterprise AI chat product. The new target product needs broader bounded contexts:
- data ingestion and sync orchestration
- KPI and metrics modeling
- anomaly and insight generation
- decision-center workflows
- workflow trigger management for n8n
- workflow run monitoring
- reports and scheduled intelligence
- domain packs and reusable rule libraries

### Practical Recommendation

Do not replace the current architecture wholesale.

Instead:
1. Keep the existing API and web applications.
2. Reposition chat as one consumer interface for decision intelligence rather than the primary product.
3. Add new bounded contexts in the same monorepo.
4. Introduce workers and automation integration as separate runtime roles.

## 2. Target Repo Evolution

### Recommended Runtime Topology

Keep the current repo structure but grow it into four runtime surfaces:
- `apps/web`: executive UI, insights, decisions, alerts, workflow monitor, settings
- `apps/api`: synchronous control plane, configuration, query APIs, approval actions
- `apps/worker`: analysis jobs, source sync jobs, report jobs, event consumers
- `apps/automation-gateway`: optional dedicated service boundary for n8n trigger/callback orchestration if the API should remain thin

### Recommended Package Expansion

Add the following packages over time:
- `packages/shared-types`
  Purpose: extend current shared contracts to cover KPIs, decisions, alerts, workflow runs, reports, and onboarding.
- `packages/event-contracts`
  Purpose: versioned event payloads for sync, analysis, decisions, and automation.
- `packages/domain-rules`
  Purpose: deterministic KPI formulas, scoring functions, threshold helpers, and domain packs.
- `packages/connector-sdk`
  Purpose: shared connector normalization and health-check primitives if worker and API both need them.
- `packages/ui-system`
  Purpose: optional later extraction of reusable UI primitives and dashboard patterns.

## 3. Recommended Folder Structure

### Near-Term Structure

```text
pocketcomputer/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   └── src/
│   │       ├── analytics/
│   │       ├── automation/
│   │       ├── connectors/
│   │       ├── controllers/
│   │       ├── events/
│   │       ├── jobs/
│   │       ├── llm/
│   │       ├── middleware/
│   │       ├── repositories/
│   │       ├── services/
│   │       ├── validation/
│   │       └── workflows/
│   ├── web/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── alerts/
│   │       │   ├── decisions/
│   │       │   ├── insights/
│   │       │   ├── kpis/
│   │       │   ├── reports/
│   │       │   ├── settings/
│   │       │   └── workflows/
│   │       ├── pages/
│   │       │   ├── alerts/
│   │       │   ├── decisions/
│   │       │   ├── insights/
│   │       │   ├── reports/
│   │       │   └── settings/
│   │       ├── services/
│   │       └── stores/
│   └── worker/
│       └── src/
│           ├── jobs/
│           ├── processors/
│           └── services/
├── packages/
│   ├── domain-rules/
│   ├── event-contracts/
│   └── shared-types/
└── infra/
    ├── docker/
    ├── nginx/
    └── n8n/
```

### Why This Fits the Current Repo

This plan preserves the current investment in:
- `apps/api/src/services`
- `apps/api/src/controllers`
- `apps/web/src/pages`
- `apps/web/src/components`

It adds bounded contexts rather than flattening everything into a single generic services folder.

## 4. Mapping From Current Modules to Future Product Modules

### Existing Modules to Preserve

Keep and evolve:
- [apps/api/src/services/auth.service.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/services/auth.service.ts)
- [apps/api/src/services/audit.service.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/services/audit.service.ts)
- [apps/api/src/services/connector.service.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/services/connector.service.ts)
- [apps/api/src/services/masking.service.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/services/masking.service.ts)
- [apps/api/src/services/plan-gate.service.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/services/plan-gate.service.ts)
- [apps/web/src/pages/settings/LLMConfigPage.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/pages/settings/LLMConfigPage.tsx)
- [apps/web/src/pages/settings/ConnectorsPage.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/pages/settings/ConnectorsPage.tsx)
- [apps/web/src/pages/settings/AuditPage.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/pages/settings/AuditPage.tsx)

### Existing Modules to Reframe

Chat modules become one interaction surface, not the whole product:
- [apps/web/src/pages/ChatPage.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/pages/ChatPage.tsx)
- [apps/api/src/services/chat.service.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/services/chat.service.ts)
- [apps/api/src/services/message-pipeline.service.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/services/message-pipeline.service.ts)

Recommended future role:
- Chat remains available for natural-language analysis and question-answering over insights and connected data.
- Decision-intelligence dashboards become the primary operational UI.

### New Bounded Contexts to Add

Backend:
- `analytics/`
  - `kpi-engine.service.ts`
  - `anomaly-engine.service.ts`
  - `insight-engine.service.ts`
  - `decision-engine.service.ts`
  - `confidence-score.service.ts`
  - `priority-score.service.ts`
- `automation/`
  - `automation-gateway.service.ts`
  - `workflow-registry.service.ts`
  - `workflow-callback.service.ts`
  - `idempotency.service.ts`
- `events/`
  - `event-publisher.ts`
  - `event-consumer.ts`
  - `event-types.ts`
- `jobs/`
  - `analysis-run.job.ts`
  - `source-sync.job.ts`
  - `report-generation.job.ts`

Frontend:
- `pages/insights/InsightsPage.tsx`
- `pages/decisions/DecisionCenterPage.tsx`
- `pages/alerts/AlertsPage.tsx`
- `pages/workflows/WorkflowMonitorPage.tsx`
- `pages/reports/ReportsPage.tsx`
- `pages/settings/N8nIntegrationPage.tsx`

## 5. Data Model Expansion Plan

### Keep Current Base Tables

Retain and extend:
- tenants
- users
- audit_logs
- provider_configs
- api_connectors
- db_connectors
- connector_schema_mappings
- masking_rules

### Add New Core Tables in This Order

Phase A:
- `data_sources`
  Note: this can eventually unify `api_connectors` and `db_connectors`, but do not force that migration immediately.
- `source_sync_runs`
- `kpi_definitions`
- `business_rules`
- `analysis_runs`

Phase B:
- `detected_anomalies`
- `generated_insights`
- `decision_points`
- `decision_approvals`

Phase C:
- `workflow_definitions`
- `automation_triggers`
- `workflow_runs`
- `workflow_callbacks`

Phase D:
- `reports`
- `report_deliveries`
- `notifications`
- `alert_instances`
- `subscription_plan_features`

### Important Modeling Guidance

Do not collapse all decision-intelligence records into generic JSON tables.

Use normalized tables for:
- analysis runs
- anomalies
- insights
- decisions
- workflow execution records

Use JSONB only for:
- dynamic source mappings
- normalized evidence payloads
- AI explanation metadata
- workflow outputs and callback bodies

## 6. API Evolution Plan

### Current Route Surface

Current routes are defined in [apps/api/src/routes/index.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/routes/index.ts):
- `/auth`
- `/chats`
- `/settings`
- `/connectors`
- `/audit`
- `/upgrade`

### Add These Route Groups Next

Phase 1 additions:
- `/data-sources`
- `/kpis`
- `/rules`
- `/analysis-runs`

Phase 2 additions:
- `/insights`
- `/decisions`
- `/alerts`

Phase 3 additions:
- `/automation-triggers`
- `/workflow-runs`
- `/workflow-callbacks/n8n`

Phase 4 additions:
- `/reports`
- `/admin/tenants`
- `/admin/platform-health`

## 7. Frontend Route Evolution Plan

### Current Route Surface

Current routes in [apps/web/src/App.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/App.tsx):
- `/login`
- `/register`
- `/chat`
- `/chat/:id`
- `/settings/llm`
- `/settings/connectors`
- `/settings/audit`

### Target Route Surface

Add routes in this order:

Wave 1:
- `/dashboard`
- `/insights`
- `/decisions`

Wave 2:
- `/alerts`
- `/workflows`
- `/reports`

Wave 3:
- `/settings/kpis`
- `/settings/rules`
- `/settings/n8n`

### Sidebar Evolution

Current sidebar in [apps/web/src/components/sidebar/Sidebar.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/components/sidebar/Sidebar.tsx) is chat-centric.

Refactor it into:
- Overview
- Insights
- Decisions
- Alerts
- Workflows
- Reports
- Chat
- Settings

The current chat-first product navigation should become one section in a broader operating cockpit.

## 8. Phase Plan for This Repo

### Phase 1: Platform Reframing and Shared Contracts

Goal:
- Preserve current functionality while introducing decision-intelligence skeletons.

Work items:
- Extend [packages/shared-types/src/index.ts](d:/Aadhirai-web/pocketcomputer/packages/shared-types/src/index.ts) with KPI, insight, decision, alert, and workflow-run types.
- Add route stubs and service placeholders for `kpis`, `rules`, `analysis-runs`, `insights`, `decisions`, `workflow-runs`.
- Add empty or placeholder pages in web for dashboard, insights, decisions, alerts, workflows, reports.
- Refactor layout navigation.

Deliverable:
- Same running app, but with product skeleton for the new domains.

### Phase 2: KPI and Analysis Domain

Goal:
- Introduce deterministic analysis before automation.

Work items:
- Add Prisma models for KPI definitions, business rules, analysis runs.
- Add services for KPI evaluation and analysis orchestration.
- Add first dashboard page with analysis-run summary.
- Add KPI configuration CRUD and rules CRUD.

Deliverable:
- Platform can define KPIs and run baseline analysis against connectors.

### Phase 3: Insights, Decisions, and Approvals

Goal:
- Convert analysis output into operator-facing actions.

Work items:
- Add anomaly, insight, decision, and approval data models.
- Add insights and decisions APIs.
- Add decision center UI and approval actions.
- Add confidence and priority scoring layer.

Deliverable:
- Platform produces persisted insights and decision points.

### Phase 4: Automation Gateway and n8n Integration

Goal:
- Add loosely coupled workflow triggering.

Work items:
- Add workflow definition table and automation trigger records.
- Add signed outbound webhook service.
- Add signed callback endpoint.
- Add workflow monitor UI.
- Add retry, timeout, and idempotency handling.

Deliverable:
- Approved decisions can trigger reusable n8n workflows through explicit contracts.

### Phase 5: Reporting, Alerting, and Enterprise Hardening

Goal:
- Add operational completeness and production readiness.

Work items:
- Alert center and report center.
- Scheduled report generation jobs.
- Platform-admin observability views.
- Rate limit refinement, secret rotation, delivery telemetry, dead-letter handling.

Deliverable:
- Enterprise-operable product with decisioning, workflows, and reporting.

## 9. Concrete File-Level Starting Backlog

### Backend First Batch

Create:
- `apps/api/src/controllers/kpi.controller.ts`
- `apps/api/src/controllers/rule.controller.ts`
- `apps/api/src/controllers/analysis.controller.ts`
- `apps/api/src/controllers/decision.controller.ts`
- `apps/api/src/controllers/workflow.controller.ts`

Create:
- `apps/api/src/services/kpi.service.ts`
- `apps/api/src/services/rule.service.ts`
- `apps/api/src/services/analysis-run.service.ts`
- `apps/api/src/services/insight.service.ts`
- `apps/api/src/services/decision.service.ts`
- `apps/api/src/services/automation-gateway.service.ts`

Create:
- `apps/api/src/validation/kpi.schema.ts`
- `apps/api/src/validation/rule.schema.ts`
- `apps/api/src/validation/analysis.schema.ts`
- `apps/api/src/validation/workflow.schema.ts`

Update:
- [apps/api/prisma/schema.prisma](d:/Aadhirai-web/pocketcomputer/apps/api/prisma/schema.prisma)
- [apps/api/src/routes/index.ts](d:/Aadhirai-web/pocketcomputer/apps/api/src/routes/index.ts)
- [packages/shared-types/src/index.ts](d:/Aadhirai-web/pocketcomputer/packages/shared-types/src/index.ts)

### Frontend First Batch

Create:
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/pages/insights/InsightsPage.tsx`
- `apps/web/src/pages/decisions/DecisionCenterPage.tsx`
- `apps/web/src/pages/alerts/AlertsPage.tsx`
- `apps/web/src/pages/workflows/WorkflowMonitorPage.tsx`
- `apps/web/src/pages/reports/ReportsPage.tsx`

Create:
- `apps/web/src/services/kpi.service.ts`
- `apps/web/src/services/decision.service.ts`
- `apps/web/src/services/workflow.service.ts`
- `apps/web/src/services/report.service.ts`

Update:
- [apps/web/src/App.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/App.tsx)
- [apps/web/src/components/sidebar/Sidebar.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/components/sidebar/Sidebar.tsx)
- [apps/web/src/components/shared/Layout.tsx](d:/Aadhirai-web/pocketcomputer/apps/web/src/components/shared/Layout.tsx)

## 10. Engineering Rules for the Transition

1. Keep current chat functionality operational while introducing the new bounded contexts.
2. Do not entangle decision generation directly with n8n execution logic.
3. Use the current service/controller style consistently.
4. Keep all workflow payloads versioned and typed.
5. Introduce workers before analysis complexity forces the API into long-running job execution.
6. Preserve tenant isolation in every new table, every route, and every queue payload.
7. Prefer additive migration over destructive schema replacement.

## 11. Recommended Immediate Next Build Slice

The best next implementation slice for this repo is:

Slice name:
- `Decision Intelligence Skeleton`

Scope:
- Add shared types for KPI, Insight, Decision, WorkflowRun.
- Add Prisma models for KPI definitions, analysis runs, insights, decisions.
- Add route/controller/service skeletons for `/kpis`, `/analysis-runs`, `/insights`, `/decisions`.
- Add frontend routes and placeholder pages for Dashboard, Insights, Decisions.
- Refactor sidebar from chat-first to product-first navigation.

Why this slice first:
- It creates the visible product transition in both backend and frontend.
- It does not yet require full n8n integration complexity.
- It preserves the existing chat product while establishing the new operating model.

## 12. Definition of Done for the Next Slice

The next slice is complete when:
- New Prisma schema changes migrate successfully.
- API exposes typed endpoints for KPIs, analysis runs, insights, and decisions.
- Web app renders Dashboard, Insights, and Decisions pages under authenticated routes.
- Sidebar navigation includes the new surfaces.
- Existing chat and settings flows still compile and run.
- Shared types are published and consumed by both API and web packages.
