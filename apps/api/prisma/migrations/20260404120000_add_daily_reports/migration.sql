CREATE TABLE "daily_reports" (
    "id"               TEXT NOT NULL,
    "tenant_id"        TEXT NOT NULL,
    "is_enabled"       BOOLEAN NOT NULL DEFAULT false,
    "send_time"        TEXT NOT NULL DEFAULT '09:00',
    "timezone"         TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "email_recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "last_sent_at"     TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_reports_tenant_id_key" ON "daily_reports"("tenant_id");

ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
