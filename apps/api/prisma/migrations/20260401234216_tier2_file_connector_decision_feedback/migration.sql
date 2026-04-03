-- AlterEnum
ALTER TYPE "ConnectorType" ADD VALUE 'FILE';

-- AlterTable
ALTER TABLE "decision_points" ADD COLUMN     "feedback_notes" TEXT;

-- CreateTable
CREATE TABLE "file_connectors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "headers" TEXT[],
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '[]',
    "status" "ConnectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_connectors_tenant_id_idx" ON "file_connectors"("tenant_id");

-- AddForeignKey
ALTER TABLE "file_connectors" ADD CONSTRAINT "file_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
