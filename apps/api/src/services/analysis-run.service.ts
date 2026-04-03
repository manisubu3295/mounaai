import { prisma } from '../lib/prisma.js';
import type { AnalysisRun, AnalysisRunDetail, PaginatedResponse } from '@pocketcomputer/shared-types';
import { triggerAnalysisRunRequestedAutomation } from './automation.service.js';
import { enqueueAnalysisRun } from '../jobs/analysis-run.queue.js';
import { logger } from '../lib/logger.js';
import { NotFoundError } from '../types/errors.js';

function formatAnalysisRun(run: {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  summary: unknown;
  initiated_by_user_id: string | null;
}): AnalysisRun {
  return {
    id: run.id,
    status: run.status,
    started_at: run.started_at?.toISOString() ?? null,
    completed_at: run.completed_at?.toISOString() ?? null,
    created_at: run.created_at.toISOString(),
    summary: (run.summary !== null && typeof run.summary === 'object' ? run.summary : {}) as Record<string, unknown>,
    initiated_by_user_id: run.initiated_by_user_id,
  };
}

export async function listAnalysisRuns(tenantId: string, page = 1, limit = 20): Promise<PaginatedResponse<AnalysisRun>> {
  const skip = (page - 1) * limit;
  const [total, items] = await Promise.all([
    prisma.analysisRun.count({ where: { tenant_id: tenantId } }),
    prisma.analysisRun.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: items.map(formatAnalysisRun),
    total,
    page,
    limit,
    has_more: skip + items.length < total,
  };
}

export async function createAnalysisRun(
  tenantId: string,
  userId: string,
  summary?: Record<string, unknown>
): Promise<AnalysisRun> {
  const created = await prisma.analysisRun.create({
    data: {
      tenant_id: tenantId,
      initiated_by_user_id: userId,
      status: 'QUEUED',
      summary: (summary ?? {}) as object,
    },
  });

  // Enqueue the execution job. If Redis rejects the add, mark the run FAILED
  // immediately rather than leaving it orphaned in QUEUED forever.
  enqueueAnalysisRun(tenantId, created.id).catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to enqueue analysis run — marking FAILED', { runId: created.id, error: message });
    await prisma.analysisRun.update({
      where: { id: created.id },
      data: { status: 'FAILED', completed_at: new Date(), summary: { error: 'Job enqueue failed: ' + message } },
    });
  });

  // Notify any configured n8n automation
  void triggerAnalysisRunRequestedAutomation(tenantId, {
    analysis_run_id: created.id,
    status: created.status,
    initiated_by_user_id: userId,
    summary: (summary ?? {}) as Record<string, unknown>,
  });

  return formatAnalysisRun(created);
}

export async function getAnalysisRunDetail(tenantId: string, runId: string): Promise<AnalysisRunDetail> {
  const run = await prisma.analysisRun.findFirst({ where: { id: runId, tenant_id: tenantId } });
  if (!run) throw new NotFoundError('AnalysisRun');

  const insights = await prisma.generatedInsight.findMany({
    where: { analysis_run_id: runId, tenant_id: tenantId },
    orderBy: [{ severity: 'desc' }, { created_at: 'desc' }],
  });

  const insightIds = insights.map((i) => i.id);
  const decisions = insightIds.length > 0
    ? await prisma.decisionPoint.findMany({
        where: { insight_id: { in: insightIds }, tenant_id: tenantId },
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      })
    : [];

  return {
    ...formatAnalysisRun(run),
    insights: insights.map((i) => ({
      id: i.id,
      analysis_run_id: i.analysis_run_id,
      title: i.title,
      summary: i.summary,
      type: i.type,
      severity: i.severity,
      confidence: i.confidence,
      evidence: (i.evidence !== null && typeof i.evidence === 'object' ? i.evidence : {}) as Record<string, unknown>,
      explanation: i.explanation,
      created_at: i.created_at.toISOString(),
    })),
    decisions: decisions.map((d) => ({
      id: d.id,
      insight_id: d.insight_id,
      title: d.title,
      recommendation: d.recommendation,
      status: d.status,
      priority: d.priority,
      confidence: d.confidence,
      owner_role: d.owner_role,
      approved_by_user_id: d.approved_by_user_id,
      approved_at: d.approved_at?.toISOString() ?? null,
      explanation: d.explanation,
      triggered_source: d.triggered_source,
      created_at: d.created_at.toISOString(),
      updated_at: d.updated_at.toISOString(),
    })),
  };
}