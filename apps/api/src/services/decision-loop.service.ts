/**
 * Decision Loop Service
 *
 * Core autonomous logic for the Mouna AI decision loop.
 *
 * Responsibilities:
 *   1. getOrCreateAutonomyConfig / updateAutonomyConfig — tenant config with sane defaults
 *   2. routeDecisions()  — After analysis, route decisions by confidence threshold
 *   3. executeDecision() — Execute a single APPROVED decision via n8n
 *   4. completeDecision() — Called from n8n callback to mark a decision COMPLETED
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { enqueueDecisionExecution } from '../jobs/decision-executor.queue.js';
import { notifyDecisionApprovalRequired } from './notification.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutonomyConfig {
  id: string;
  tenant_id: string;
  auto_analysis_enabled: boolean;
  analysis_interval_minutes: number;
  auto_approve_threshold: number;
  review_threshold: number;
  max_auto_actions_per_run: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateAutonomyConfigInput {
  auto_analysis_enabled?: boolean | undefined;
  analysis_interval_minutes?: number | undefined;
  auto_approve_threshold?: number | undefined;
  review_threshold?: number | undefined;
  max_auto_actions_per_run?: number | undefined;
}

export interface RouteDecisionsResult {
  auto_approved: number;
  review_required: number;
  open: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatConfig(config: {
  id: string;
  tenant_id: string;
  auto_analysis_enabled: boolean;
  analysis_interval_minutes: number;
  auto_approve_threshold: number;
  review_threshold: number;
  max_auto_actions_per_run: number;
  created_at: Date;
  updated_at: Date;
}): AutonomyConfig {
  return {
    id: config.id,
    tenant_id: config.tenant_id,
    auto_analysis_enabled: config.auto_analysis_enabled,
    analysis_interval_minutes: config.analysis_interval_minutes,
    auto_approve_threshold: config.auto_approve_threshold,
    review_threshold: config.review_threshold,
    max_auto_actions_per_run: config.max_auto_actions_per_run,
    created_at: config.created_at.toISOString(),
    updated_at: config.updated_at.toISOString(),
  };
}

// ─── Config management ────────────────────────────────────────────────────────

export async function getOrCreateAutonomyConfig(tenantId: string): Promise<AutonomyConfig> {
  const config = await prisma.autonomyConfig.upsert({
    where: { tenant_id: tenantId },
    create: {
      tenant_id: tenantId,
      auto_analysis_enabled: false,
      analysis_interval_minutes: 360,
      auto_approve_threshold: 0.85,
      review_threshold: 0.60,
      max_auto_actions_per_run: 5,
    },
    update: {},
  });

  return formatConfig(config);
}

export async function updateAutonomyConfig(
  tenantId: string,
  input: UpdateAutonomyConfigInput
): Promise<AutonomyConfig> {
  const config = await prisma.autonomyConfig.upsert({
    where: { tenant_id: tenantId },
    create: {
      tenant_id: tenantId,
      auto_analysis_enabled: input.auto_analysis_enabled ?? false,
      analysis_interval_minutes: input.analysis_interval_minutes ?? 360,
      auto_approve_threshold: input.auto_approve_threshold ?? 0.85,
      review_threshold: input.review_threshold ?? 0.60,
      max_auto_actions_per_run: input.max_auto_actions_per_run ?? 5,
    },
    update: {
      ...(input.auto_analysis_enabled !== undefined && { auto_analysis_enabled: input.auto_analysis_enabled }),
      ...(input.analysis_interval_minutes !== undefined && { analysis_interval_minutes: input.analysis_interval_minutes }),
      ...(input.auto_approve_threshold !== undefined && { auto_approve_threshold: input.auto_approve_threshold }),
      ...(input.review_threshold !== undefined && { review_threshold: input.review_threshold }),
      ...(input.max_auto_actions_per_run !== undefined && { max_auto_actions_per_run: input.max_auto_actions_per_run }),
    },
  });

  return formatConfig(config);
}

// ─── Decision routing ─────────────────────────────────────────────────────────

/**
 * Route newly-created decisions by confidence threshold.
 *
 * Above auto_approve_threshold  → APPROVED → execution queued immediately
 * Above review_threshold        → APPROVAL_REQUIRED (human must approve via UI)
 * Below review_threshold        → OPEN (informational, no action needed)
 *
 * Respects max_auto_actions_per_run as a safety cap.
 */
export async function routeDecisions(
  tenantId: string,
  decisionIds: string[]
): Promise<RouteDecisionsResult> {
  if (!decisionIds.length) return { auto_approved: 0, review_required: 0, open: 0 };

  const config = await getOrCreateAutonomyConfig(tenantId);

  const decisions = await prisma.decisionPoint.findMany({
    where: { id: { in: decisionIds }, tenant_id: tenantId, status: 'OPEN' },
    orderBy: [{ priority: 'desc' }, { confidence: 'desc' }],
  });

  let autoApproved = 0;
  let reviewRequired = 0;
  let open = 0;
  let autoActionsThisRun = 0;

  for (const decision of decisions) {
    const confidence = decision.confidence ?? 0;

    if (
      confidence >= config.auto_approve_threshold &&
      autoActionsThisRun < config.max_auto_actions_per_run
    ) {
      await prisma.decisionPoint.update({
        where: { id: decision.id },
        data: { status: 'APPROVED', approved_at: new Date() },
      });
      void enqueueDecisionExecution(tenantId, decision.id);
      autoApproved++;
      autoActionsThisRun++;

      logger.info('Decision auto-approved', {
        tenantId,
        decisionId: decision.id,
        title: decision.title,
        confidence,
        threshold: config.auto_approve_threshold,
      });
    } else if (confidence >= config.review_threshold) {
      await prisma.decisionPoint.update({
        where: { id: decision.id },
        data: { status: 'APPROVAL_REQUIRED' },
      });
      void notifyDecisionApprovalRequired(
        tenantId,
        decision.id,
        decision.title,
        decision.recommendation
      );
      reviewRequired++;
    } else {
      open++;
    }
  }

  logger.info('Decision routing complete', {
    tenantId,
    autoApproved,
    reviewRequired,
    open,
  });

  return { auto_approved: autoApproved, review_required: reviewRequired, open };
}

// ─── Decision execution ───────────────────────────────────────────────────────

/**
 * Execute a single APPROVED decision.
 * Called by the decision-executor worker.
 *
 * Marks the decision TRIGGERED, then fires the DECISION_APPROVED n8n workflow.
 * The n8n callback endpoint will call completeDecision() when execution confirms.
 */
export async function executeDecision(tenantId: string, decisionId: string): Promise<void> {
  const decision = await prisma.decisionPoint.findUnique({ where: { id: decisionId } });

  if (!decision) {
    logger.warn('executeDecision: decision not found', { decisionId });
    return;
  }

  if (decision.tenant_id !== tenantId) {
    logger.warn('executeDecision: tenant mismatch', { decisionId, tenantId });
    return;
  }

  // Guard against race conditions: only execute APPROVED decisions
  if (decision.status !== 'APPROVED') {
    logger.info('executeDecision: skipping — decision is no longer APPROVED', {
      decisionId,
      currentStatus: decision.status,
    });
    return;
  }

  // Mark TRIGGERED so re-execution is blocked until the loop resets
  await prisma.decisionPoint.update({
    where: { id: decisionId },
    data: { status: 'TRIGGERED', triggered_at: new Date() },
  });

  logger.info('Decision execution triggered', { tenantId, decisionId, title: decision.title });

}

// ─── Decision completion ──────────────────────────────────────────────────────

/** Mark a decision COMPLETED after execution. */
export async function completeDecision(decisionId: string): Promise<void> {
  const decision = await prisma.decisionPoint.findUnique({ where: { id: decisionId } });

  if (!decision) {
    logger.warn('completeDecision: decision not found', { decisionId });
    return;
  }

  if (decision.status !== 'TRIGGERED') {
    // Already completed or in another terminal state — no-op
    return;
  }

  await prisma.decisionPoint.update({
    where: { id: decisionId },
    data: { status: 'COMPLETED', completed_at: new Date() },
  });

  logger.info('Decision completed via n8n callback', {
    decisionId,
    tenantId: decision.tenant_id,
    title: decision.title,
  });
}
