import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../types/errors.js';
import type { DecisionPoint, PaginatedResponse } from '@pocketcomputer/shared-types';
import { triggerDecisionStatusAutomation } from './automation.service.js';
import { enqueueDecisionExecution } from '../jobs/decision-executor.queue.js';

function formatDecision(decision: {
  id: string;
  insight_id: string;
  title: string;
  recommendation: string;
  status: 'OPEN' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'REJECTED' | 'TRIGGERED' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  confidence: number | null;
  owner_role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER' | null;
  approved_by_user_id: string | null;
  approved_at: Date | null;
  explanation: string | null;
  triggered_source: string | null;
  feedback_notes?: string | null;
  created_at: Date;
  updated_at: Date;
}): DecisionPoint {
  return {
    id: decision.id,
    insight_id: decision.insight_id,
    title: decision.title,
    recommendation: decision.recommendation,
    status: decision.status,
    priority: decision.priority,
    confidence: decision.confidence,
    owner_role: decision.owner_role,
    approved_by_user_id: decision.approved_by_user_id,
    approved_at: decision.approved_at?.toISOString() ?? null,
    explanation: decision.explanation,
    triggered_source: decision.triggered_source,
    feedback_notes: decision.feedback_notes ?? null,
    created_at: decision.created_at.toISOString(),
    updated_at: decision.updated_at.toISOString(),
  };
}

export async function addFeedback(
  tenantId: string,
  decisionId: string,
  notes: string
): Promise<DecisionPoint> {
  const existing = await prisma.decisionPoint.findUnique({ where: { id: decisionId } });
  if (!existing) throw new NotFoundError('Decision');
  if (existing.tenant_id !== tenantId) throw new ForbiddenError();

  const updated = await prisma.decisionPoint.update({
    where: { id: decisionId },
    data: { feedback_notes: notes },
  });
  return formatDecision(updated);
}

export async function listDecisions(
  tenantId: string,
  page = 1,
  limit = 20,
  status?: 'OPEN' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'REJECTED' | 'TRIGGERED' | 'COMPLETED'
): Promise<PaginatedResponse<DecisionPoint>> {
  const skip = (page - 1) * limit;
  const where = {
    tenant_id: tenantId,
    ...(status ? { status } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.decisionPoint.count({ where }),
    prisma.decisionPoint.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    items: items.map(formatDecision),
    total,
    page,
    limit,
    has_more: skip + items.length < total,
  };
}

export async function updateDecisionStatus(
  tenantId: string,
  decisionId: string,
  userId: string,
  status: 'APPROVED' | 'REJECTED'
): Promise<DecisionPoint> {
  const existing = await prisma.decisionPoint.findUnique({ where: { id: decisionId } });
  if (!existing) throw new NotFoundError('Decision');
  if (existing.tenant_id !== tenantId) throw new ForbiddenError();

  const updated = await prisma.decisionPoint.update({
    where: { id: decisionId },
    data: {
      status,
      approved_by_user_id: userId,
      approved_at: new Date(),
    },
  });

  void triggerDecisionStatusAutomation(tenantId, status, {
    decision_id: updated.id,
    insight_id: updated.insight_id,
    title: updated.title,
    recommendation: updated.recommendation,
    priority: updated.priority,
    approved_by_user_id: userId,
    approved_at: updated.approved_at?.toISOString() ?? null,
  });

  // Enqueue autonomous execution when manually approved
  if (status === 'APPROVED') {
    void enqueueDecisionExecution(tenantId, updated.id);
  }

  return formatDecision(updated);
}