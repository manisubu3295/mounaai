import { prisma } from '../lib/prisma.js';
import type { AnalysisRun, AnalysisRunDetail, PaginatedResponse, PeriodSummary } from '@pocketcomputer/shared-types';
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
      feedback_notes: d.feedback_notes,
      created_at: d.created_at.toISOString(),
      updated_at: d.updated_at.toISOString(),
    })),
  };
}

export async function clearAnalysisData(tenantId: string): Promise<{ deleted_runs: number }> {
  // Cascade deletes generated_insights and decision_points via FK onDelete
  const result = await prisma.analysisRun.deleteMany({ where: { tenant_id: tenantId } });
  logger.info('Analysis data cleared', { tenantId, deleted_runs: result.count });
  return { deleted_runs: result.count };
}

// ─── Periodic summary helpers ─────────────────────────────────────────────────

type RawPeriodRow = {
  period: string;
  run_count: bigint;
  insight_count: bigint;
  critical_count: bigint;
  warning_count: bigint;
  info_count: bigint;
  decision_count: bigint;
  approved_count: bigint;
  rejected_count: bigint;
};

function periodLabel(period: string, mode: 'monthly' | 'quarterly'): string {
  if (mode === 'quarterly') return period.replace(/-Q/, ' Q'); // "2025-Q1" → "2025 Q1" → reformat below
  // monthly: "2025-03"
  const [y, m] = period.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });
}

function formatPeriodRow(row: RawPeriodRow, mode: 'monthly' | 'quarterly'): PeriodSummary {
  const period = String(row.period);
  return {
    period,
    period_label: mode === 'quarterly'
      ? (() => { const [y, q] = period.split('-Q'); return `Q${q} ${y}`; })()
      : periodLabel(period, mode),
    run_count:      Number(row.run_count),
    insight_count:  Number(row.insight_count),
    critical_count: Number(row.critical_count),
    warning_count:  Number(row.warning_count),
    info_count:     Number(row.info_count),
    decision_count: Number(row.decision_count),
    approved_count: Number(row.approved_count),
    rejected_count: Number(row.rejected_count),
  };
}

export async function getPeriodicSummary(
  tenantId: string,
  period: 'monthly' | 'quarterly'
): Promise<PeriodSummary[]> {
  if (period === 'monthly') {
    const rows = await prisma.$queryRaw<RawPeriodRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', ar.created_at), 'YYYY-MM')  AS period,
        COUNT(DISTINCT ar.id)::bigint                            AS run_count,
        COUNT(DISTINCT gi.id)::bigint                           AS insight_count,
        COUNT(DISTINCT CASE WHEN gi.severity = 'CRITICAL' THEN gi.id END)::bigint AS critical_count,
        COUNT(DISTINCT CASE WHEN gi.severity = 'WARNING'  THEN gi.id END)::bigint AS warning_count,
        COUNT(DISTINCT CASE WHEN gi.severity = 'INFO'     THEN gi.id END)::bigint AS info_count,
        COUNT(DISTINCT dp.id)::bigint                           AS decision_count,
        COUNT(DISTINCT CASE WHEN dp.status = 'APPROVED'  THEN dp.id END)::bigint AS approved_count,
        COUNT(DISTINCT CASE WHEN dp.status = 'REJECTED'  THEN dp.id END)::bigint AS rejected_count
      FROM analysis_runs ar
      LEFT JOIN generated_insights gi ON gi.analysis_run_id = ar.id AND gi.tenant_id = ar.tenant_id
      LEFT JOIN decision_points dp ON dp.insight_id = gi.id AND dp.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ${tenantId} AND ar.status = 'COMPLETED'
      GROUP BY DATE_TRUNC('month', ar.created_at)
      ORDER BY DATE_TRUNC('month', ar.created_at) DESC
      LIMIT 12
    `;
    return rows.map(r => formatPeriodRow(r, 'monthly'));
  } else {
    const rows = await prisma.$queryRaw<RawPeriodRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('quarter', ar.created_at), 'YYYY-"Q"Q') AS period,
        COUNT(DISTINCT ar.id)::bigint                                AS run_count,
        COUNT(DISTINCT gi.id)::bigint                               AS insight_count,
        COUNT(DISTINCT CASE WHEN gi.severity = 'CRITICAL' THEN gi.id END)::bigint AS critical_count,
        COUNT(DISTINCT CASE WHEN gi.severity = 'WARNING'  THEN gi.id END)::bigint AS warning_count,
        COUNT(DISTINCT CASE WHEN gi.severity = 'INFO'     THEN gi.id END)::bigint AS info_count,
        COUNT(DISTINCT dp.id)::bigint                               AS decision_count,
        COUNT(DISTINCT CASE WHEN dp.status = 'APPROVED'  THEN dp.id END)::bigint AS approved_count,
        COUNT(DISTINCT CASE WHEN dp.status = 'REJECTED'  THEN dp.id END)::bigint AS rejected_count
      FROM analysis_runs ar
      LEFT JOIN generated_insights gi ON gi.analysis_run_id = ar.id AND gi.tenant_id = ar.tenant_id
      LEFT JOIN decision_points dp ON dp.insight_id = gi.id AND dp.tenant_id = ar.tenant_id
      WHERE ar.tenant_id = ${tenantId} AND ar.status = 'COMPLETED'
      GROUP BY DATE_TRUNC('quarter', ar.created_at)
      ORDER BY DATE_TRUNC('quarter', ar.created_at) DESC
      LIMIT 8
    `;
    return rows.map(r => formatPeriodRow(r, 'quarterly'));
  }
}