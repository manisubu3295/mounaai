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
    api_key_hint: string | null;
}
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
export interface UpgradeRequestResponse {
    upgrade_request_id: string;
    whatsapp_url: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
}
//# sourceMappingURL=index.d.ts.map