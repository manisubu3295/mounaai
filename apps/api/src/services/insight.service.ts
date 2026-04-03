import { prisma } from '../lib/prisma.js';
import type { Insight, PaginatedResponse } from '@pocketcomputer/shared-types';

function formatInsight(insight: {
  id: string;
  analysis_run_id: string;
  title: string;
  summary: string;
  type: 'RISK' | 'OPPORTUNITY' | 'INEFFICIENCY' | 'WATCH';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  confidence: number | null;
  evidence: unknown;
  explanation: string | null;
  created_at: Date;
}): Insight {
  return {
    id: insight.id,
    analysis_run_id: insight.analysis_run_id,
    title: insight.title,
    summary: insight.summary,
    type: insight.type,
    severity: insight.severity,
    confidence: insight.confidence,
    evidence: (insight.evidence !== null && typeof insight.evidence === 'object' ? insight.evidence : {}) as Record<string, unknown>,
    explanation: insight.explanation,
    created_at: insight.created_at.toISOString(),
  };
}

export async function listInsights(
  tenantId: string,
  page = 1,
  limit = 20,
  filters?: { severity?: 'INFO' | 'WARNING' | 'CRITICAL'; type?: 'RISK' | 'OPPORTUNITY' | 'INEFFICIENCY' | 'WATCH' }
): Promise<PaginatedResponse<Insight>> {
  const skip = (page - 1) * limit;
  const where = {
    tenant_id: tenantId,
    ...(filters?.severity ? { severity: filters.severity } : {}),
    ...(filters?.type ? { type: filters.type } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.generatedInsight.count({ where }),
    prisma.generatedInsight.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: items.map(formatInsight),
    total,
    page,
    limit,
    has_more: skip + items.length < total,
  };
}