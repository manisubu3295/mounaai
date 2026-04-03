-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT_ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('NONE', 'BEARER', 'API_KEY', 'BASIC', 'OAUTH2_CLIENT');

-- CreateEnum
CREATE TYPE "DbType" AS ENUM ('POSTGRESQL', 'MYSQL');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('UNTESTED', 'OK', 'FAILED');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('API', 'DB');

-- CreateEnum
CREATE TYPE "ToolRunStatus" AS ENUM ('SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "MaskingStrategy" AS ENUM ('FULL_REDACT', 'PARTIAL_MASK', 'TOKENIZE');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('FIELD_NAME', 'REGEX', 'GLOB');

-- CreateEnum
CREATE TYPE "SslMode" AS ENUM ('DISABLE', 'REQUIRE', 'VERIFY_CA', 'VERIFY_FULL');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "status" "ChatStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "tool_run_id" TEXT,
    "model_used" TEXT,
    "latency_ms" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "llm_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "base_url" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 2048,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "test_status" "TestStatus" NOT NULL DEFAULT 'UNTESTED',
    "last_tested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_connectors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_url" TEXT NOT NULL,
    "auth_type" "AuthType" NOT NULL,
    "auth_config_enc" TEXT,
    "default_headers" JSONB NOT NULL DEFAULT '{}',
    "status" "ConnectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "test_status" "TestStatus" NOT NULL DEFAULT 'UNTESTED',
    "last_tested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_connector_endpoints" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "path_template" TEXT NOT NULL,
    "query_params" JSONB NOT NULL DEFAULT '{}',
    "body_template" JSONB,
    "timeout_ms" INTEGER NOT NULL DEFAULT 10000,
    "retry_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "api_connector_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "db_connectors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "db_type" "DbType" NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "database_name" TEXT NOT NULL,
    "username_enc" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "ssl_mode" "SslMode" NOT NULL DEFAULT 'REQUIRE',
    "status" "ConnectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "test_status" "TestStatus" NOT NULL DEFAULT 'UNTESTED',
    "last_tested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "db_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "db_query_templates" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sql_template" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '[]',
    "timeout_ms" INTEGER NOT NULL DEFAULT 5000,

    CONSTRAINT "db_query_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_schema_mappings" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "connector_type" "ConnectorType" NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "field_mappings" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_schema_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "masking_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "match_type" "MatchType" NOT NULL,
    "match_pattern" TEXT NOT NULL,
    "strategy" "MaskingStrategy" NOT NULL,
    "mask_config" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "masking_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "message_id" TEXT,
    "connector_id" TEXT NOT NULL,
    "connector_type" "ConnectorType" NOT NULL,
    "endpoint_name" TEXT,
    "params_used" JSONB NOT NULL DEFAULT '{}',
    "status" "ToolRunStatus" NOT NULL,
    "latency_ms" INTEGER,
    "masked_fields" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "AuditStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrade_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature_attempted" TEXT,
    "whatsapp_opened" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "chats_user_id_tenant_id_status_idx" ON "chats"("user_id", "tenant_id", "status");

-- CreateIndex
CREATE INDEX "chat_messages_chat_id_idx" ON "chat_messages"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_providers_name_key" ON "llm_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_tenant_id_provider_id_key" ON "provider_configs"("tenant_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "connector_schema_mappings_connector_id_key" ON "connector_schema_mappings"("connector_id");

-- CreateIndex
CREATE INDEX "connector_schema_mappings_tenant_id_connector_type_idx" ON "connector_schema_mappings"("tenant_id", "connector_type");

-- CreateIndex
CREATE INDEX "masking_rules_tenant_id_is_active_priority_idx" ON "masking_rules"("tenant_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "tool_runs_chat_id_idx" ON "tool_runs"("chat_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "llm_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_connectors" ADD CONSTRAINT "api_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_connector_endpoints" ADD CONSTRAINT "api_connector_endpoints_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "api_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_connectors" ADD CONSTRAINT "db_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_query_templates" ADD CONSTRAINT "db_query_templates_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "db_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "masking_rules" ADD CONSTRAINT "masking_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_runs" ADD CONSTRAINT "tool_runs_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
