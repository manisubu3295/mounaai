-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('SUPPLIER_PREFERENCE', 'BUSINESS_RULE', 'CUSTOMER_INSIGHT', 'OPERATIONAL_PATTERN', 'PRODUCT_PREFERENCE', 'FINANCIAL_RULE', 'CONTACT_INFO', 'AI_LEARNING');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('USER_EXPLICIT', 'AI_INFERRED', 'SYSTEM_OBSERVED');

-- AlterTable
ALTER TABLE "decision_points" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "triggered_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "business_memories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" "MemorySource" NOT NULL DEFAULT 'AI_INFERRED',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autonomy_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "auto_analysis_enabled" BOOLEAN NOT NULL DEFAULT false,
    "analysis_interval_minutes" INTEGER NOT NULL DEFAULT 360,
    "auto_approve_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "review_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.60,
    "max_auto_actions_per_run" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autonomy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_memories_tenant_id_category_idx" ON "business_memories"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "business_memories_tenant_id_expires_at_idx" ON "business_memories"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_memories_tenant_id_key_key" ON "business_memories"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "autonomy_configs_tenant_id_key" ON "autonomy_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "business_memories" ADD CONSTRAINT "business_memories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autonomy_configs" ADD CONSTRAINT "autonomy_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
