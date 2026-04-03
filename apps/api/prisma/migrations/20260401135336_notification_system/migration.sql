-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INSIGHT_CRITICAL', 'INSIGHT_WARNING', 'DECISION_APPROVAL_REQUIRED', 'RULE_TRIGGERED', 'CONNECTOR_ERROR', 'ANALYSIS_COMPLETED', 'ANALYSIS_FAILED', 'SYSTEM');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify_on_critical" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_warning" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_rule_trigger" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_connector_error" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_tenant_id_is_read_created_at_idx" ON "notifications"("tenant_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenant_id_key" ON "notification_preferences"("tenant_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
