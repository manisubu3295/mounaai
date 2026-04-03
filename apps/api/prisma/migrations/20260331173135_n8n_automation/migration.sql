-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "n8n_integrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "api_key_enc" TEXT,
    "callback_secret_enc" TEXT,
    "timeout_ms" INTEGER NOT NULL DEFAULT 15000,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "n8n_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_workflows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "webhook_path" TEXT NOT NULL,
    "workflow_version" TEXT NOT NULL DEFAULT 'v1',
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "trigger_source" TEXT NOT NULL DEFAULT 'EVENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "workflow_key" TEXT NOT NULL,
    "workflow_version" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'REQUESTED',
    "external_run_id" TEXT,
    "request_payload" JSONB NOT NULL DEFAULT '{}',
    "response_payload" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "n8n_integrations_tenant_id_key" ON "n8n_integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "automation_workflows_tenant_id_is_enabled_idx" ON "automation_workflows"("tenant_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "automation_workflows_tenant_id_key_key" ON "automation_workflows"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "workflow_runs_tenant_id_created_at_idx" ON "workflow_runs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_key_status_idx" ON "workflow_runs"("workflow_key", "status");

-- AddForeignKey
ALTER TABLE "n8n_integrations" ADD CONSTRAINT "n8n_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_workflows" ADD CONSTRAINT "automation_workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_workflows" ADD CONSTRAINT "automation_workflows_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "n8n_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "n8n_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "automation_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
