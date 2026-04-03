-- CreateEnum
CREATE TYPE "KpiStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnalysisRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('RISK', 'OPPORTUNITY', 'INEFFICIENCY', 'WATCH');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('OPEN', 'APPROVAL_REQUIRED', 'APPROVED', 'REJECTED', 'TRIGGERED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DecisionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT NOT NULL,
    "unit" TEXT,
    "target_value" DOUBLE PRECISION,
    "warning_threshold" DOUBLE PRECISION,
    "critical_threshold" DOUBLE PRECISION,
    "owner_role" "UserRole",
    "status" "KpiStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "initiated_by_user_id" TEXT,
    "status" "AnalysisRunStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "summary" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_insights" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "analysis_run_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_points" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "insight_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "status" "DecisionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "DecisionPriority" NOT NULL DEFAULT 'MEDIUM',
    "confidence" DOUBLE PRECISION,
    "owner_role" "UserRole",
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_definitions_tenant_id_status_idx" ON "kpi_definitions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_tenant_id_slug_key" ON "kpi_definitions"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "analysis_runs_tenant_id_created_at_idx" ON "analysis_runs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "generated_insights_tenant_id_created_at_idx" ON "generated_insights"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "generated_insights_analysis_run_id_idx" ON "generated_insights"("analysis_run_id");

-- CreateIndex
CREATE INDEX "decision_points_tenant_id_status_priority_idx" ON "decision_points"("tenant_id", "status", "priority");

-- CreateIndex
CREATE INDEX "decision_points_insight_id_idx" ON "decision_points"("insight_id");

-- AddForeignKey
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_insights" ADD CONSTRAINT "generated_insights_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_insights" ADD CONSTRAINT "generated_insights_analysis_run_id_fkey" FOREIGN KEY ("analysis_run_id") REFERENCES "analysis_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_points" ADD CONSTRAINT "decision_points_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_points" ADD CONSTRAINT "decision_points_insight_id_fkey" FOREIGN KEY ("insight_id") REFERENCES "generated_insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_points" ADD CONSTRAINT "decision_points_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
