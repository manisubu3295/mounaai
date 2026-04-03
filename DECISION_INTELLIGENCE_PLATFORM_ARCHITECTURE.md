# 1. Executive Summary

This product is a multi-tenant decision-intelligence and automation platform for operational businesses. Its purpose is to ingest business data, normalize and analyze it, identify issues and opportunities, generate decision points with business context, and trigger automation workflows through a self-hosted n8n environment.

The primary strategic design choice is strict loose coupling between the core platform and the automation engine. The application owns the business model, tenant model, KPI semantics, analysis logic, recommendation generation, approvals, reporting, auditability, and commercial packaging. n8n is treated as an external automation runtime responsible for orchestrating actions, integrations, retries, notifications, and multi-step operational workflows. This separation ensures that the product retains defensible intellectual property in the core platform while using n8n as a replaceable execution layer.

Target users are business owners, operations leaders, analysts, technical admins, and integrators who need a production-grade system that converts raw operational data into actionable decisions and controlled automation. The platform is designed for vertical expansion across pharmacy, retail, manufacturing, services, distribution, finance operations, and internal enterprise use cases.

This architecture is commercially attractive because it offers a clear progression from insight visibility to recommendation quality to operational action. Customers do not buy workflow tooling alone; they buy improved operating decisions, reduced latency in responding to business events, auditability, and reusable automation capability across departments.

Why self-hosted n8n is the right approach:
- It accelerates integration delivery without embedding core intelligence into low-code workflow definitions.
- It supports enterprise control over data residency, security, network boundaries, and connector governance.
- It reduces time-to-value for notifications, approvals, escalations, and external system orchestration.
- It can be replaced later because the platform interacts with it only through explicit contracts: events, webhooks, invocation APIs, callbacks, and workflow status updates.

# 2. Product Positioning

What the platform is:
- A business decision-intelligence platform with integrated automation triggering.
- A multi-tenant SaaS-ready product that turns operational data into insights, decisions, and governed actions.
- A reusable analytics-and-automation control plane for multiple business domains.

What the platform is not:
- Not a generic BI dashboarding tool focused only on charts.
- Not an ETL warehouse platform.
- Not an AI chatbot with vague recommendations and no operational traceability.
- Not an n8n wrapper where workflow definitions contain the product's core business logic.
- Not a single-domain custom solution locked to one industry.

Who it serves:
- SME and mid-market operators needing better daily decisions.
- Multi-site businesses needing anomaly detection, escalation, and action tracking.
- Enterprise departments needing governed automation tied to business analysis.
- Technical teams that need a platform foundation, not a one-off workflow stack.

Business problem solved:
- Operational systems produce data but not consistently useful decisions.
- Businesses often discover problems too late because monitoring is fragmented and passive.
- Teams struggle to translate KPI shifts into prioritized actions.
- Automation is often deployed as isolated scripts or workflow tools with no business context, governance, or reuse model.

Why customers buy it:
- Faster detection of operational issues and revenue leakage.
- Better prioritization through decision scoring and business context.
- Controlled automation with approvals, audit trails, and retries.
- Reduced dependence on ad hoc spreadsheets and disconnected dashboards.
- A platform that can evolve into multiple domain solutions without re-architecting.

# 3. Core Product Capabilities

Business data ingestion:
- Connects to APIs, operational databases, flat files, and scheduled imports.
- Supports schema mapping, source validation, source health monitoring, and tenant-isolated connector configs.
- Uses read-only ingestion patterns by default.

KPI analysis:
- Defines domain-specific and cross-domain metrics with formulas, thresholds, weights, trends, and targets.
- Evaluates KPIs on schedules or on-demand.
- Supports snapshot comparison, trend deltas, threshold drift, and rolling windows.

Anomaly detection:
- Detects rule-based anomalies, sudden deltas, volume deviations, rate shifts, outliers, and sustained trends.
- Supports deterministic baseline rules and optionally AI-generated narrative explanations.

Insight generation:
- Converts analysis output into normalized insights: what changed, why it matters, what evidence supports it, and how urgent it is.
- Groups signals across sources to reduce noise.

Decision-point recommendations:
- Produces recommended actions with expected business impact, confidence level, urgency, and owner suggestions.
- Distinguishes insight from decision from automation recommendation.

Workflow automation triggers:
- Allows manual, policy-based, threshold-based, and scheduled triggers into external automation workflows.
- Uses an automation gateway instead of direct hard-coded calls from business modules.

Scheduled intelligence reports:
- Generates daily, weekly, monthly, and ad hoc reports for executives, managers, and operators.
- Supports tenant branding, role-based report visibility, and delivery via n8n notification workflows.

Operational alerts:
- Creates policy-driven alerts for anomalies, breaches, failures, missed SLAs, and unreviewed decisions.
- Supports severity levels, deduplication windows, escalation timers, and suppression policies.

Escalation workflows:
- Triggers notifications, tickets, approval loops, and escalation chains when decision thresholds are crossed or actions remain unresolved.

Human review and approval options:
- Allows users to approve, reject, defer, annotate, and re-route recommended actions before automation execution.
- Maintains a decision log and approval evidence trail.

# 4. Architectural Philosophy

Loose coupling is critical because the decision-intelligence platform and the workflow engine have different strategic purposes.

Tightly coupled app + automation design:
- Analysis logic, business semantics, connector orchestration, and workflow steps are embedded into n8n workflows.
- Product differentiation leaks into workflow definitions.
- Workflow sprawl grows quickly.
- Reuse across domains is poor because logic becomes fragmented.
- Replacement of the automation layer becomes expensive.
- Testing, versioning, auditability, and domain evolution become inconsistent.

Loosely coupled app + automation engine design:
- The app owns data semantics, KPI logic, business rules, scoring, insights, decision records, approvals, and audit trails.
- n8n executes external actions using versioned workflow contracts.
- The interface between the two is explicit and testable.
- The app can swap n8n with another orchestration engine later.
- Workflow teams can evolve automation independently of the decision model.

Recommendation:
- Adopt a loosely coupled architecture with a dedicated automation gateway in the core platform.
- Keep business intelligence, business semantics, prioritization, and decision governance in the app.
- Keep orchestration, retries, integration actions, notifications, and external system automation in n8n.

# 5. High-Level System Architecture

Major components:
- Frontend application
- Backend API and control plane
- Analytics and decision engine
- Data connector layer
- Workflow orchestration interface
- Self-hosted n8n cluster
- Event bus or queue
- PostgreSQL operational database
- Redis cache and ephemeral coordination layer
- Audit logging subsystem
- Monitoring and observability stack

Interaction model:
1. Users access the React frontend for dashboards, insights, decisions, rules, and workflow visibility.
2. The backend API handles authentication, tenant resolution, RBAC, configuration CRUD, analysis requests, and workflow trigger requests.
3. The data connector layer collects and normalizes source data into internal canonical structures.
4. The analytics and decision engine computes KPIs, detects anomalies, produces insights, scores decisions, and writes durable records.
5. Business events are emitted to an event bus or queue such as BullMQ over Redis Streams or a future broker abstraction.
6. The automation gateway consumes workflow-trigger requests and invokes n8n through signed webhooks or versioned workflow APIs.
7. n8n executes downstream actions: notifications, tickets, external updates, report delivery, escalations, approvals, and integration chains.
8. n8n sends signed callbacks back to the platform with workflow status, outputs, failures, and retry outcomes.
9. Audit, metrics, traces, and logs capture every major action across analysis and automation layers.

Recommended logical topology:
- Web app behind Nginx.
- API service horizontally scalable.
- Worker service for analysis jobs and event consumers.
- Redis for queueing, short-lived state, rate limiting, and cache.
- PostgreSQL for platform state and auditability.
- Self-hosted n8n separated into its own deployment boundary and datastore.
- Optional object storage for imports and generated reports.

# 6. Bounded Responsibilities

A. Core App
- Tenant lifecycle and plan management
- User identity, RBAC, session management
- Data source definitions and credential governance
- Source health and sync orchestration requests
- KPI definitions, metric formulas, thresholds, and scoring weights
- Business rules and escalation policies
- Analysis execution and normalized data interpretation
- Insight generation, anomaly records, decision points, approvals, and reasoning evidence
- Workflow trigger requests and idempotency protection
- Decision center, dashboards, reports center, alerts center, workflow monitor
- Audit logging and commercial controls

B. n8n
- Execution of workflow recipes
- External system orchestration
- Notifications and multi-channel dispatch
- Scheduled automation jobs where scheduling belongs to workflow orchestration, not business scoring
- Approval handoff actions into external systems
- Retry chains, fallback notifications, integration-specific transformations
- External integration credentials that are strictly automation-scoped

C. Shared integration contracts
- `workflow.trigger.requested` payload
- Signed outbound webhook schema
- Inbound callback schema for `workflow.started`, `workflow.completed`, `workflow.failed`
- Workflow version reference model
- Correlation IDs, tenant IDs, actor context, retry metadata, idempotency keys

# 7. Detailed User Personas

Business owner:
- Focus: business outcomes, cashflow, risk, margin, growth.
- Needs: concise prioritized decisions, trend visibility, and approval controls.
- Success metric: fewer missed opportunities and faster intervention on high-value problems.

Operations manager:
- Focus: daily operations, SLA breaches, exceptions, staffing, stock, throughput.
- Needs: alerts, recommended actions, escalation workflows, operational drill-downs.

Analyst:
- Focus: KPI design, rule tuning, anomaly validation, performance interpretation.
- Needs: source-level visibility, thresholds, confidence explanation, report design.

Technical admin:
- Focus: source connectivity, credentials, workflow mappings, tenant config, security.
- Needs: safe connector setup, monitoring, webhook verification, secret rotation.

Aadhirai support/admin:
- Focus: tenant health, plan enforcement, support telemetry, operational incidents.
- Needs: super-admin console, tenant diagnostics, audit review, workflow failure visibility.

Workflow designer/integrator:
- Focus: automation logic, external actions, reusable workflow templates.
- Needs: stable contracts, versioned payloads, sandbox testing, idempotent callbacks.

# 8. End-to-End Business Workflows

1. Tenant onboarding
1. Prospect signs up or is provisioned by sales/support.
2. Platform creates tenant, default roles, plan, feature flags, and trial policy.
3. Admin completes organization profile and security settings.
4. Admin configures first data source and first KPI pack.
5. Admin optionally connects n8n endpoint credentials and callback secret.
6. Platform runs a connector validation and a sample analysis.
7. If validation succeeds, onboarding status becomes `ACTIVE`.
8. If validation fails, tenant remains `SETUP_REQUIRED` and receives guided remediation tasks.

2. Data source connection
1. Technical admin chooses source type: API, DB, file, scheduled import.
2. Admin enters connection config, auth method, network profile, sync frequency.
3. Platform validates outbound destination against allowlists and SSRF rules.
4. Platform tests credentials and reads sample schema metadata.
5. Admin maps source fields to canonical business fields.
6. Platform stores encrypted credentials and mapping config.
7. Sync profile becomes `HEALTHY`, `DEGRADED`, or `INVALID`.

3. KPI configuration
1. Analyst selects KPI library template or creates custom KPI.
2. Analyst defines source dependencies, formula, window, thresholds, ownership, and severity.
3. Platform validates field availability and metric formula consistency.
4. KPI is versioned and promoted to active.

4. Business rule definition
1. Analyst defines conditional rules: threshold breach, trend shift, ratio mismatch, multi-signal rule.
2. Rule references KPI IDs, thresholds, severity policy, escalation path, and automation policy.
3. Platform validates rule expressions against supported operators.
4. Rule enters draft, review, and active lifecycle.

5. Daily analysis workflow
1. Scheduler or manual trigger creates an analysis run.
2. Data sync jobs collect latest source data.
3. Normalization layer creates canonical records.
4. KPI engine computes metrics and historical deltas.
5. Anomaly engine detects significant changes.
6. Insight engine groups findings into meaningful narratives.
7. Decision engine produces recommended actions.
8. Events are emitted for downstream alerts and automation eligibility.

6. Anomaly detection workflow
1. Source sync completes.
2. Metrics are recalculated.
3. Rule and statistical anomaly checks run.
4. Anomalies are deduplicated against recent windows.
5. Severity is assigned.
6. Evidence is captured.
7. Alert policy determines whether to notify immediately, aggregate, or wait for human review.

7. Decision-point generation workflow
1. Insights are grouped by business theme.
2. Recommendation engine evaluates candidate actions.
3. Confidence score and action priority are calculated.
4. A decision point record is created with explanation, urgency, and impacted KPIs.
5. If policy allows automatic trigger, a workflow-trigger request is created.
6. If approval is required, decision enters review queue.

8. Approval-required workflow
1. Decision point is marked `APPROVAL_REQUIRED`.
2. Assigned reviewer receives in-app notification and optional external alert.
3. Reviewer sees evidence, confidence, expected impact, and proposed workflow.
4. Reviewer can approve, reject, defer, or request escalation.
5. Decision state and audit trail are updated.
6. On approval, automation trigger request is published.

9. n8n automation trigger workflow
1. Platform creates durable `automation_trigger` record with idempotency key.
2. Event `workflow.trigger.requested` is emitted.
3. Automation gateway resolves workflow ID and version.
4. Gateway signs payload and calls n8n endpoint or enqueues broker message.
5. n8n acknowledges workflow receipt.
6. Platform records `workflow_run` state as `REQUESTED` or `STARTED`.
7. n8n executes actions.
8. n8n callback updates final state.

10. Escalation workflow
1. Alert remains unresolved past SLA.
2. Escalation policy creates a new escalation record.
3. Platform emits `approval.required` or `alert.dispatched` based on policy.
4. n8n sends escalation notifications, creates tickets, or triggers manager escalation.
5. Resolution or timeout updates the escalation trail.

11. Scheduled report workflow
1. Scheduler creates report job.
2. Platform compiles analytics summary, decision status, and key anomalies.
3. AI optionally generates a business-readable narrative.
4. Report artifact is generated.
5. Delivery request is sent to n8n for email, WhatsApp, Slack, Teams, or ticketing distribution.

12. Failed workflow retry and exception workflow
1. n8n returns failure callback or timeout threshold expires.
2. Platform marks workflow run `FAILED` or `TIMED_OUT`.
3. Retry policy checks idempotency and retry budget.
4. If retry allowed, new attempt is issued with same business key and incremented attempt count.
5. If retry exhausted, exception record is created and support/ops are notified.
6. Failed workflow remains visible in workflow monitor until resolved or dismissed.

# 9. Business Analysis Engine Design

Core subsystems:
- KPI library
- Metric normalization engine
- Threshold and rule engine
- Trend and anomaly evaluator
- Business context enricher
- Recommendation engine
- Confidence scoring engine
- Action priority scoring engine
- Explanation generator

KPI library:
- Stores reusable metric definitions by domain and category.
- Examples: stockout rate, sales per hour, fill-rate, gross margin drift, ticket aging, service resolution time, shrinkage, throughput, claim rejection rate.
- Each KPI definition includes formula, unit, window, target, threshold bands, severity weights, and domain applicability.

Metric normalization:
- Converts heterogeneous source structures into canonical measures.
- Handles currency normalization, unit conversion, time normalization, timezone alignment, entity mapping, and null-handling policy.

Threshold rules:
- Deterministic rule engine for exact business conditions.
- Supports hard thresholds, soft thresholds, comparison against baseline, peer comparison, and multi-condition rules.

Anomaly rules:
- Deterministic: threshold breaches, sudden deltas, missing expected events, prolonged degradation.
- Statistical: rolling z-score, percentage deviation, moving average divergence.
- Temporal: recurring trend shifts, weekday versus weekday, shift versus shift.

Trend analysis:
- Rolling period comparisons.
- Slope detection.
- Volatility scoring.
- Sustained deterioration versus isolated blips.

Business context layering:
- Adds tenant settings, location hierarchies, product categories, operating hours, business calendar, campaign periods, supplier schedules, and compliance policies.
- This prevents generic interpretation of domain-specific signals.

Recommendation engine:
- Maps insights into candidate actions.
- Uses rule templates, domain playbooks, current constraints, and workflow capabilities.
- Example: high stockout risk + pending purchase order delay = expedite supplier follow-up, notify branch manager, create replenishment review task.

Confidence scoring:
- Built from source completeness, metric quality, rule certainty, signal convergence, historical consistency, and AI narrative confidence.
- Confidence must never be a raw LLM probability. It is a platform-defined score.

Action priority scoring:
- Combines urgency, estimated business impact, SLA proximity, stakeholder role, revenue/risk exposure, and operational dependency.

Decision explanation generation:
- Produces structured explanations:
  - What happened
  - Which metrics support the finding
  - Why this matters now
  - Recommended action
  - Suggested owner
  - Expected impact
  - Confidence and caveats

Conversion from raw data to action:
1. Raw source data is ingested.
2. Canonical measures are produced.
3. KPIs are calculated.
4. Rule and anomaly evaluators identify meaningful deviations.
5. Signals are grouped into insights.
6. Insights are classified as risk, opportunity, inefficiency, or watch item.
7. Candidate actions are generated.
8. Actions are prioritized into decision points.
9. Approved decisions become automation triggers or tracked tasks.

# 10. AI Usage Strategy

Use AI for:
- Summarization of multi-signal analysis results.
- Pattern explanation in business language.
- Human-readable decision generation.
- Executive report narrative generation.
- Alert narrative generation.
- Root-cause hypothesis generation with explicit caveats.
- Recommendation wording and explanation layering.

Do not use AI for:
- Authoritative KPI computation.
- Threshold evaluation.
- Permission decisions.
- Workflow routing authorization.
- Idempotency handling.
- Compliance-critical rule evaluation.
- Final truth of structured system state.

Deterministic logic should handle:
- KPI calculations
- Threshold breaches
- Rule execution
- Approval policy
- Workflow selection policy where business rules require exact behavior
- Authentication, authorization, tenant isolation, retention, audit enforcement

AI operating model:
- AI sits behind a provider-agnostic abstraction.
- It consumes structured evidence, not raw unlimited dumps.
- Prompts are grounded with canonical metrics, domain config, and strict output schemas.
- AI output is persisted as narrative or explanation, not as the sole source of record.

# 11. n8n Integration Architecture

Integration model:
- App triggers n8n via outbound signed webhook or API invocation.
- n8n reports execution state back via inbound signed callback.
- Optional queue-based dispatch layer can be inserted later.

Required mechanics:
- Workflow identifiers: logical key such as `ops.alert.escalation`.
- Workflow versioning: semantic or integer version pinned in trigger config.
- Environment separation: dev, staging, prod workflow registries.
- Authentication: HMAC-signed payloads, mTLS or API tokens where network permits.
- Idempotency: platform-generated key on every trigger request.
- Timeout: trigger timeout, workflow SLA timeout, callback timeout.
- Retry handling: bounded retries with dedupe protection.
- Callback contract: run ID, workflow key, version, status, timestamps, outputs, error summary.

How the app triggers multiple workflows without hard-coding logic:
- Introduce `workflow_definitions` in the platform.
- Each business rule or decision policy references a workflow definition key.
- The automation gateway resolves tenant-specific workflow binding and active version.
- Payload transformation is driven by template mapping, not scattered application code.

Invocation options:
- Direct webhook: simple, fast, good for synchronous acknowledgment.
- Queue-based dispatch: preferred for resilience and replay in enterprise mode.
- Hybrid: queue in app, webhook consumer adapter into n8n.

# 12. Self-Hosted n8n Deployment Model

Recommended deployment:
- Separate n8n deployment boundary from the core platform.
- Use Docker Compose for SME/self-hosted installations.
- Use Kubernetes-ready manifests or Helm for enterprise scale.

Recommended n8n stack:
- n8n editor/service
- n8n workers for scalable execution
- PostgreSQL dedicated to n8n metadata
- Redis for queue mode if scaling workers
- Nginx reverse proxy with TLS termination
- Secrets stored in Vault, Doppler, SOPS, or platform-native secret manager

Security hardening:
- Restrict inbound access to editor/admin surfaces.
- Isolate n8n network from core app except necessary ingress/egress.
- Enforce HTTPS only.
- Disable unused community packages.
- Separate prod and non-prod n8n instances.
- Use per-environment callback secrets and API tokens.

Operational requirements:
- Regular backups for n8n Postgres.
- Versioned workflow exports.
- Disaster recovery runbooks.
- Worker scaling for high-volume automation.
- Reverse proxy request size and timeout tuning.

# 13. Reusability Strategy

To make automation reusable by other applications:
- Build an automation gateway as an app-agnostic service contract.
- Standardize workflow invocation envelopes with actor, tenant, domain, object type, event type, and payload.
- Maintain reusable workflow classes: notifications, approvals, report delivery, ticket creation, sync orchestration.
- Keep app-specific interpretation outside of n8n.

Reusable patterns:
- Generic notification pipelines
- Generic approval pipelines
- Generic scheduled report delivery
- Generic external webhook dispatch
- Generic incident escalation
- Generic CRM/ERP task creation workflows

# 14. Domain-Agnostic Platform Design

Design rules for domain portability:
- Canonical data model must be abstract: source entity, metric, insight, decision, action, workflow.
- Domain-specific logic lives in versioned templates: KPI packs, rules packs, report packs, and decision playbooks.
- UI labels and dashboard presets can be domain-tailored without changing core engine contracts.

Examples:
- Pharmacy: stockouts, expiries, script turnaround, margin leakage.
- Retail: sell-through, shrinkage, staffing coverage, promotion variance.
- Manufacturing: downtime, scrap rate, throughput, schedule adherence.
- Service ops: ticket aging, utilization, SLA breach risk.

# 15. Functional Modules

Authentication and RBAC
- Objective: secure access control.
- Responsibilities: identity, roles, sessions, permission enforcement.
- Key features: tenant-scoped roles, admin impersonation controls, session revocation.
- Inputs: credentials, SSO assertions later, JWT/session tokens.
- Outputs: authenticated principal, permission claims.
- Validations: password policy, token expiry, role checks.
- Edge cases: locked accounts, stale sessions, tenant suspension.
- Audit: login, logout, role changes, failed access attempts.

Tenant management
- Objective: isolate customers and manage lifecycle.
- Responsibilities: tenant setup, feature flags, plans, status.
- Audit: tenant creation, suspension, plan changes.

Data source management
- Objective: safe source connectivity.
- Responsibilities: source config, secrets, mapping, health, sync schedule.
- Edge cases: rotated credentials, schema drift, partial sync.
- Audit: connection tests, credential changes, failed syncs.

KPI and metrics configuration
- Objective: define measurable business outcomes.
- Responsibilities: KPI packs, formulas, thresholds, ownership.
- Edge cases: missing fields, invalid formulas, overlapping definitions.

Business rules management
- Objective: define meaningful conditions and policies.
- Responsibilities: anomaly policies, escalation rules, automation eligibility.

Analysis engine
- Objective: convert data into evaluated business state.
- Inputs: normalized source data, KPI config, rules.
- Outputs: analysis runs, anomalies, insights.

Decision center
- Objective: operationalize findings.
- Responsibilities: priority queue, approvals, assignment, execution intent.

Alert center
- Objective: manage signal-to-noise discipline.
- Responsibilities: alerts, severity, dedupe, suppression, escalation.

Workflow trigger manager
- Objective: govern outbound automation execution.
- Responsibilities: trigger requests, idempotency, retry budgets, correlation.

n8n integration manager
- Objective: isolate automation-engine specifics.
- Responsibilities: auth, contracts, callbacks, mapping, workflow registry.

Reports center
- Objective: distribute actionable intelligence.
- Responsibilities: report templates, schedule config, report history, delivery status.

Audit logs
- Objective: immutable business and system traceability.

Admin console
- Objective: tenant operations and platform governance.

Subscription and plan controls
- Objective: commercial packaging and enforcement.

# 16. Data Connector Strategy

Supported connector families:
- APIs
- Databases
- File imports
- Scheduled sync feeds

Design principles:
- Read-only by default.
- Canonical mapping layer between source schema and platform schema.
- Per-tenant credential isolation and encryption.
- Source health checks and last-success visibility.
- Drift detection when source schemas change.
- Sync validation before committing new snapshots.

Failure handling:
- Retry transient failures.
- Mark connector degraded on repeated failures.
- Emit `data.sync.failed` events.
- Block downstream analysis when source completeness policies are not met.

# 17. Event-Driven Design

`data.sync.completed`
- Occurs when a source sync finishes successfully.
- Producer: connector runtime.
- Consumers: analysis scheduler, health monitor.
- Payload: tenant_id, source_id, sync_run_id, record_count, duration_ms, completeness_score.

`anomaly.detected`
- Occurs when anomaly engine persists a new anomaly.
- Producer: analysis engine.
- Consumers: alert center, decision engine.
- Payload: anomaly_id, severity, KPI refs, evidence summary.

`decision.generated`
- Occurs when a decision point is created.
- Producer: decision engine.
- Consumers: decision center, approval engine, automation gateway.

`approval.required`
- Occurs when a decision needs human approval.
- Producer: decision policy engine.
- Consumers: notification pipeline, approval UI.

`workflow.trigger.requested`
- Occurs when a decision or rule requests automation.
- Producer: workflow trigger manager.
- Consumers: automation gateway.

`workflow.completed`
- Occurs when n8n callback confirms success.
- Producer: callback handler.
- Consumers: decision center, notifications, reporting.

`workflow.failed`
- Occurs when workflow fails or times out.
- Producer: callback handler or timeout monitor.
- Consumers: retry engine, support alerting, workflow monitor.

`alert.dispatched`
- Occurs when outbound alerting succeeds.
- Producer: alert dispatcher or n8n callback layer.
- Consumers: audit and delivery analytics.

# 18. API Design

Onboarding
- `POST /api/v1/onboarding/tenant`
- Auth: public or invite-based.
- Request: company, admin user, plan seed.
- Response: tenant, admin user, onboarding status.

Data source config
- `POST /api/v1/data-sources`
- `GET /api/v1/data-sources`
- `POST /api/v1/data-sources/:id/test`
- `POST /api/v1/data-sources/:id/sync`

KPI config
- `POST /api/v1/kpis`
- `GET /api/v1/kpis`
- `PATCH /api/v1/kpis/:id`

Rule config
- `POST /api/v1/rules`
- `GET /api/v1/rules`
- `PATCH /api/v1/rules/:id`

Analysis run
- `POST /api/v1/analysis-runs`
- `GET /api/v1/analysis-runs/:id`

Insights listing
- `GET /api/v1/insights?severity=&status=&source_id=`

Decisions listing
- `GET /api/v1/decisions`
- `POST /api/v1/decisions/:id/approve`
- `POST /api/v1/decisions/:id/reject`

Trigger automation
- `POST /api/v1/automation-triggers`
- Request: workflow_key, version, decision_id, payload_override optional.

Workflow status
- `GET /api/v1/workflow-runs`
- `GET /api/v1/workflow-runs/:id`
- `POST /api/v1/workflow-callbacks/n8n`

Reports
- `POST /api/v1/reports`
- `GET /api/v1/reports`

Admin logs
- `GET /api/v1/admin/audit-logs`

Common rules:
- REST-first JSON envelopes.
- Tenant-scoped auth on all non-public endpoints.
- Zod/DTO validation.
- Correlation ID on every response.
- Strict server-side RBAC.

# 19. Database and Data Model

`users`
- Purpose: principals.
- Important fields: id, tenant_id, email, name, status, role_id.

`tenants`
- Purpose: customer accounts.
- Fields: id, name, slug, status, plan_id, settings.

`roles`
- Purpose: permission groupings.

`data_sources`
- Purpose: source definitions.
- Fields: type, status, sync_policy, base_config.

`source_credentials`
- Purpose: encrypted credentials and rotation metadata.

`source_sync_runs`
- Purpose: execution history.

`kpi_definitions`
- Purpose: KPI metadata, formulas, thresholds, versions.

`business_rules`
- Purpose: conditional logic and escalation policy.

`analysis_runs`
- Purpose: durable analysis executions.

`detected_anomalies`
- Purpose: anomaly records with evidence and severity.

`generated_insights`
- Purpose: business-readable findings.

`decision_points`
- Purpose: recommended actions and approval state.

`automation_triggers`
- Purpose: outbound trigger requests with idempotency keys.

`workflow_runs`
- Purpose: workflow lifecycle status.

`workflow_callbacks`
- Purpose: immutable inbound callback payloads.

`reports`
- Purpose: generated report definitions and artifacts.

`notifications`
- Purpose: alert delivery attempts and states.

`audit_logs`
- Purpose: immutable action history.

`subscription_plans`
- Purpose: commercial entitlements.

Relations:
- Tenant owns users, sources, KPIs, rules, runs, insights, decisions, triggers, reports, notifications, and audit logs.
- Decision points link to insights or anomalies and optionally to workflow runs.
- Workflow runs link to automation triggers.

# 20. UI/UX Design Specification

Design principles:
- Premium, low-noise, highly legible, executive-grade.
- Dense where necessary, never cluttered.
- Clear separation between insight, decision, alert, and workflow state.

Key pages:
- Executive dashboard: top KPIs, risk summary, decisions needing attention.
- Insights dashboard: grouped findings, trends, filters, confidence and evidence.
- Decision center: recommended actions, approvals, execution status.
- Alerts center: severity-sorted alerts, dedupe status, escalation timers.
- Workflow monitor: outbound triggers, run status, retries, callback detail.
- Data source config: connectors, health, schema mapping, sync logs.
- KPI config: library, formula editor, threshold settings, ownership.
- Business rules setup: condition builder, escalation policy, workflow binding.
- n8n integration settings: endpoint config, signing secret, workflow registry.
- Reports center: generated reports, schedules, delivery logs.
- Admin console: tenant controls, audit logs, support diagnostics.

Visual language:
- Neutral dark or controlled light enterprise palette.
- Minimal use of high-saturation color reserved for severity or CTA.
- Strong typography hierarchy.
- Tables optimized for scanning.

# 21. Security Architecture

Core controls:
- Tenant isolation in every query and every event payload.
- Secrets encrypted at rest with envelope encryption or AES-256-GCM plus managed rotation.
- RBAC enforced server-side.
- Webhook authentication through HMAC signatures and timestamp validation.
- API token rotation and scoped service credentials.
- TLS everywhere.
- Outbound connector allowlists and SSRF protection.
- DB credentials encrypted separately from general config.
- PII minimization in prompts, logs, reports, and callbacks.
- Secure callback endpoints with replay protection and nonce handling.
- Immutable audit logs for sensitive operations.
- Least privilege across app, workers, n8n, and database roles.

# 22. Reliability and Scalability

Reliability model:
- Async job processing for syncs, analysis runs, report generation, and workflow dispatch.
- Retries with bounded attempts and dead-letter queues.
- Idempotency keys on every workflow trigger and callback.
- Timeout monitors for long-running workflows.
- Graceful degradation when AI providers fail: keep deterministic insight generation alive.
- Backpressure via queue concurrency limits and tenant-level quotas.

Scalability model:
- Stateless API nodes.
- Separate worker pool for heavy analysis.
- Redis-backed queue scaling.
- PostgreSQL with proper indexing, partitioning later for audit and event-heavy tables.
- n8n worker scaling in queue mode.

# 23. Observability and Monitoring

Logs:
- Structured logs with request_id, tenant_id, workflow_run_id, analysis_run_id.

Metrics:
- Connector success/failure rate
- Sync latency
- Analysis duration
- AI call latency and error rate
- Workflow success/failure/timeout counts
- Alert delivery success

Traces:
- Request to analysis to decision to automation trace chain.

Dashboards:
- Connector health dashboard
- Analysis engine latency dashboard
- Workflow reliability dashboard
- Notification delivery dashboard

# 24. Subscription and Commercial Model

Free
- Limited sources
- Daily analysis only
- Basic insights
- Minimal report frequency
- No advanced approvals or external automations

Standard
- More sources
- More frequent analysis
- Basic workflow triggers
- Standard reports and alerts

Pro
- Higher source counts
- Advanced decision scoring
- Approval workflows
- More automation runs
- Escalation workflows
- Scheduled intelligence reports

Enterprise
- Multi-team governance
- Dedicated environments
- SSO and advanced RBAC
- Custom workflow packs
- Full audit and premium support

# 25. Recommended Technology Stack

Frontend:
- React + TypeScript
- Reason: mature ecosystem, high team availability, strong admin/dashboard suitability.

Backend:
- Node.js + TypeScript
- Reason: shared language, fast iteration, strong API and orchestration suitability.

Database:
- PostgreSQL
- Reason: relational integrity, JSONB flexibility, mature operational profile.

Cache:
- Redis
- Reason: queue coordination, rate limiting, caching, short-lived state.

Queue/Eventing:
- BullMQ on Redis initially.
- Reason: practical for product stage, simple operations, adequate for early enterprise rollout.

ORM:
- Prisma.
- Reason: developer productivity, type safety, migration tooling.

Auth:
- JWT plus refresh-token rotation initially, SSO-ready design later.

AI integration:
- Provider-agnostic adapter over OpenAI-compatible and other providers.

Self-hosted n8n stack:
- n8n + PostgreSQL + Redis + Nginx + Docker.

Deployment:
- Docker Compose for single-tenant/self-hosted rollout.
- Kubernetes-ready modular services for scale.

# 26. Folder Structure and Engineering Standards

Repo recommendation:
- Monorepo with apps and packages.

Suggested structure:
```text
apps/
  web/
  api/
  worker/
  automation-gateway/
packages/
  shared-types/
  domain-rules/
  connector-sdk/
  event-contracts/
  ui-system/
infra/
  docker/
  nginx/
  k8s/
docs/
  architecture/
  api/
```

Standards:
- Controllers thin.
- Services own business logic.
- Repositories own persistence.
- DTO validation on every inbound boundary.
- Structured error contracts.
- Request-scoped correlation IDs.
- No tenant-unsafe queries.
- Contract-first event payloads.

Testing strategy:
- Unit tests for scoring, rules, and decision generation.
- Integration tests for connectors and automation gateway.
- Contract tests for webhook payloads and callbacks.
- E2E tests for onboarding, analysis, approval, and workflow monitoring.

# 27. Implementation Roadmap

Phase 1: core platform foundation
- Tenant model, auth, RBAC, source connectors, basic dashboards, audit foundation.

Phase 2: KPI and decision engine
- KPI library, rule engine, anomaly detection, insights, decision center.

Phase 3: n8n automation integration
- Automation gateway, workflow registry, trigger contracts, callbacks, workflow monitor.

Phase 4: enterprise hardening
- SSO, advanced audit, secret rotation, scaling, monitoring, resilience controls.

Phase 5: reusable platform expansion
- Domain packs, reusable workflow catalog, partner/integrator tooling, replaceable automation abstraction.

# 28. Risks and Mitigations

Over-reliance on AI
- Mitigation: deterministic scoring and rules remain authoritative.

n8n workflow sprawl
- Mitigation: workflow registry, naming standards, versioning, review process.

Poor event contracts
- Mitigation: versioned schemas, contract tests, payload governance.

Tenant data leakage
- Mitigation: row-level tenant scoping, service guards, audit review, automated tests.

Noisy alerts
- Mitigation: dedupe, suppression windows, severity calibration, review feedback loops.

False positives
- Mitigation: confidence scoring, business context layering, analyst tuning workflows.

Operational complexity
- Mitigation: phased rollout, strong observability, template-driven domain packs.

# 29. Final Recommendation

The application must remain loosely coupled from n8n because the enduring product value is not workflow execution; it is business interpretation, operational decision support, governance, and multi-tenant reusable intelligence. n8n is useful because it accelerates integrations and action orchestration, especially in self-hosted enterprise environments, but it must remain an external automation engine behind stable contracts.

Self-hosted n8n is a strong choice because it provides rapid workflow delivery, deployment flexibility, and customer-controlled infrastructure. It should be used for orchestration, notification dispatch, retries, and external actions. Core logic that must remain in the app includes KPI semantics, anomaly detection, insight generation, recommendation scoring, decision records, approvals, auditability, multi-tenant security, and commercial packaging.

This architecture produces a reusable platform, not a one-off workflow product. With a canonical data model, pluggable KPI packs, versioned workflow contracts, and a dedicated automation gateway, Aadhirai Innovations can evolve this into a family of domain-specific operational intelligence products while preserving a shared platform core.