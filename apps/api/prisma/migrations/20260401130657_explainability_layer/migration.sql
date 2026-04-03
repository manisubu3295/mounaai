-- AlterTable
ALTER TABLE "decision_points" ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "reasoning_chain" JSONB,
ADD COLUMN     "triggered_source" TEXT;

-- AlterTable
ALTER TABLE "generated_insights" ADD COLUMN     "explanation" TEXT;
