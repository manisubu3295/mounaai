// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER';
export type PlanTier = 'FREE' | 'PRO' | 'ENTERPRISE';
export type ChatStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type ConnectorType = 'API' | 'DB';
export type AuthType = 'NONE' | 'BEARER' | 'API_KEY' | 'BASIC' | 'OAUTH2_CLIENT';
export type DbType = 'POSTGRESQL' | 'MYSQL';
export type MaskingStrategy = 'FULL_REDACT' | 'PARTIAL_MASK' | 'TOKENIZE';
export type MatchType = 'FIELD_NAME' | 'REGEX' | 'GLOB';
export type TestStatus = 'UNTESTED' | 'OK' | 'FAILED';
export type KpiStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AnalysisRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type InsightType = 'RISK' | 'OPPORTUNITY' | 'INEFFICIENCY' | 'WATCH';
export type InsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type DecisionStatus = 'OPEN' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'REJECTED' | 'TRIGGERED' | 'COMPLETED';
export type DecisionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  tenant_id: string;
  tenant_name: string;
  plan: PlanTier;
}

export interface LoginResponse {
  user: AuthUser;
  access_token: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface Chat {
  id: string;
  title: string;
  status: ChatStatus;
  created_at: string;
  updated_at: string;
  last_message?: string;
  connector_ids?: string[];
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string;
  model_used?: string | null;
  latency_ms?: number | null;
  created_at: string;
  sources?: MessageSource[];
}

export interface MessageSource {
  connector_id: string;
  connector_name: string;
  connector_type: ConnectorType;
  endpoint_or_query: string;
  fetched_at: string;
}

// ─── LLM Config ───────────────────────────────────────────────────────────────

export interface LLMProvider {
  id: string;
  name: string;
  default_url: string;
}

export interface ProviderConfig {
  id: string;
  provider_id: string;
  provider_name: string;
  base_url: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  is_active: boolean;
  test_status: TestStatus;
  last_tested_at: string | null;
  api_key_hint: string | null; // last 4 chars only
}

// ─── Connectors ───────────────────────────────────────────────────────────────

export interface ApiConnector {
  id: string;
  name: string;
  description: string | null;
  base_url: string;
  auth_type: AuthType;
  status: 'ACTIVE' | 'INACTIVE';
  test_status: TestStatus;
  last_tested_at: string | null;
  endpoints: ApiEndpoint[];
}

export interface ApiEndpoint {
  id: string;
  name: string;
  description: string | null;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  path_template: string;
  query_params: Record<string, string>;
  body_template: Record<string, unknown> | null;
  timeout_ms: number;
  retry_count: number;
}

export interface DbConnector {
  id: string;
  name: string;
  db_type: DbType;
  host: string;
  port: number;
  database_name: string;
  ssl_mode: string;
  status: 'ACTIVE' | 'INACTIVE';
  test_status: TestStatus;
  last_tested_at: string | null;
  query_templates: DbQueryTemplate[];
}

export interface DbQueryTemplate {
  id: string;
  name: string;
  description: string | null;
  sql_template: string;
  params: QueryParam[];
  timeout_ms: number;
}

export interface QueryParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  source: 'user_input' | 'extracted';
}

// ─── Schema Mapping ───────────────────────────────────────────────────────────

export interface FieldMapping {
  source_path: string;
  alias: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  include_in_context: boolean;
  maskable: boolean;
}

export interface ConnectorSchemaMapping {
  id: string;
  connector_id: string;
  connector_type: ConnectorType;
  field_mappings: FieldMapping[];
}

// ─── Masking Rules ────────────────────────────────────────────────────────────

export interface MaskingRule {
  id: string;
  name: string;
  match_type: MatchType;
  match_pattern: string;
  strategy: MaskingStrategy;
  mask_config: Record<string, unknown>;
  priority: number;
  is_active: boolean;
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email?: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  payload: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILURE';
  created_at: string;
}

// ─── Upgrade ──────────────────────────────────────────────────────────────────

export interface UpgradeRequestResponse {
  upgrade_request_id: string;
  whatsapp_url: string;
}

// ─── Decision Intelligence ───────────────────────────────────────────────────

export interface KpiDefinition {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  formula: string;
  unit: string | null;
  target_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  owner_role: UserRole | null;
  status: KpiStatus;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRun {
  id: string;
  status: AnalysisRunStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  summary: Record<string, unknown>;
  initiated_by_user_id: string | null;
}

export interface AnalysisRunDetail extends AnalysisRun {
  insights: Insight[];
  decisions: DecisionPoint[];
}

export interface Insight {
  id: string;
  analysis_run_id: string;
  title: string;
  summary: string;
  type: InsightType;
  severity: InsightSeverity;
  confidence: number | null;
  evidence: Record<string, unknown>;
  explanation: string | null;
  created_at: string;
}

export interface DecisionPoint {
  id: string;
  insight_id: string;
  title: string;
  recommendation: string;
  status: DecisionStatus;
  priority: DecisionPriority;
  confidence: number | null;
  owner_role: UserRole | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  explanation: string | null;
  triggered_source: string | null;
  feedback_notes: string | null;
  created_at: string;
  updated_at: string;
}


// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'INSIGHT_CRITICAL'
  | 'INSIGHT_WARNING'
  | 'DECISION_APPROVAL_REQUIRED'
  | 'RULE_TRIGGERED'
  | 'CONNECTOR_ERROR'
  | 'ANALYSIS_COMPLETED'
  | 'ANALYSIS_FAILED'
  | 'SYSTEM';

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: NotificationType;
  resource_type: string | null;
  resource_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  tenant_id: string;
  email_enabled: boolean;
  email_recipients: string[];
  notify_on_critical: boolean;
  notify_on_warning: boolean;
  notify_on_rule_trigger: boolean;
  notify_on_approval_required: boolean;
  notify_on_connector_error: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export type SimulationImpact = 'positive' | 'negative' | 'neutral' | 'mixed';
export type SimulationDirection = 'up' | 'down' | 'flat';

export interface SimulationWeek {
  week: number;
  dates: string;
  headline: string;
  detail: string;
  direction: SimulationDirection;
  key_metric: string | null;
}

export interface SimulationResult {
  scenario: string;
  scenario_plain: string;
  overall_impact: SimulationImpact;
  confidence: number;
  summary: string;
  month_headline: string;
  weeks: SimulationWeek[];
  best_case: string;
  worst_case: string;
  risks: string[];
  opportunities: string[];
  recommendation: string;
  data_basis: string;
  has_live_data: boolean;
  simulated_at: string;
}

// ─── Periodic Summary ─────────────────────────────────────────────────────────

export interface PeriodSummary {
  period: string;          // "2025-03" (monthly) or "2025-Q1" (quarterly)
  period_label: string;    // "March 2025" or "Q1 2025"
  run_count: number;
  insight_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  decision_count: number;
  approved_count: number;
  rejected_count: number;
}

// ─── Daily Briefing ───────────────────────────────────────────────────────────

export interface DailyReport {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  send_time: string;       // HH:MM 24h
  timezone: string;
  email_recipients: string[];
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
