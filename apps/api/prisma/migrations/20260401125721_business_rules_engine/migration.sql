-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('CREATE_DECISION', 'TRIGGER_WORKFLOW', 'SEND_ALERT', 'SET_MEMORY');

-- CreateEnum
CREATE TYPE "RuleExecutionStatus" AS ENUM ('TRIGGERED', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "business_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "condition" JSONB NOT NULL,
    "action_type" "RuleActionType" NOT NULL,
    "action_config" JSONB NOT NULL DEFAULT '{}',
    "last_evaluated_at" TIMESTAMP(3),
    "last_triggered_at" TIMESTAMP(3),
    "trigger_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_executions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "status" "RuleExecutionStatus" NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "context_snapshot" JSONB NOT NULL DEFAULT '{}',
    "action_result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_rules_tenant_id_is_active_priority_idx" ON "business_rules"("tenant_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "rule_executions_rule_id_created_at_idx" ON "rule_executions"("rule_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "rule_executions_tenant_id_created_at_idx" ON "rule_executions"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "business_rules" ADD CONSTRAINT "business_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "business_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
