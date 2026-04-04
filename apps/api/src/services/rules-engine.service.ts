/**
 * Rules Engine Service
 *
 * Evaluates and executes configurable IF-THEN business rules.
 *
 * Rules run during analysis against live connector data, allowing
 * deterministic owner-configured actions to fire alongside LLM decisions.
 *
 * Flow:
 *   1. Owner defines rule: IF condition THEN action
 *   2. During each analysis run, evaluateRulesForTenant() is called with
 *      the already-fetched connector data snapshot
 *   3. Rules that match produce GeneratedInsight + DecisionPoint records
 *      (or fire n8n workflows / memory updates directly)
 *   4. Rule-triggered decisions have confidence=1.0 and auto-approve immediately
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { enqueueDecisionExecution } from '../jobs/decision-executor.queue.js';

import { upsertMemory } from './memory.service.js';
import { notifyRuleTriggered } from './notification.service.js';

// ─── Condition Types ──────────────────────────────────────────────────────────

export type ConditionOperator =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains'
  | 'is_null' | 'is_not_null';

export interface RuleConditionLeaf {
  type: 'condition';
  /** Dot-notation path into connector data, e.g. "ERP.stock_levels.paracetamol" */
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean | null;
}

export interface RuleConditionGroup {
  type: 'group';
  logic: 'AND' | 'OR';
  conditions: ConditionNode[];
}

export type ConditionNode = RuleConditionLeaf | RuleConditionGroup;

// ─── Action Config Types ──────────────────────────────────────────────────────

export interface CreateDecisionActionConfig {
  title: string;
  recommendation: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface TriggerWorkflowActionConfig {
  workflow_key: string;
  payload?: Record<string, unknown>;
}

export interface SendAlertActionConfig {
  title: string;
  message: string;
  recipients: string[];
}

export interface SetMemoryActionConfig {
  key: string;
  value: string;
  category: string;
}

// ─── Rule response type ───────────────────────────────────────────────────────

export interface BusinessRuleRecord {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  condition: ConditionNode;
  action_type: 'CREATE_DECISION' | 'SET_MEMORY';
  action_config: Record<string, unknown>;
  last_evaluated_at: string | null;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string | undefined;
  is_active?: boolean | undefined;
  priority?: number | undefined;
  condition: ConditionNode;
  action_type: 'CREATE_DECISION' | 'SET_MEMORY';
  action_config: Record<string, unknown>;
}

export interface UpdateRuleInput {
  name?: string | undefined;
  description?: string | undefined;
  is_active?: boolean | undefined;
  priority?: number | undefined;
  condition?: ConditionNode | undefined;
  action_type?: 'CREATE_DECISION' | 'SET_MEMORY' | undefined;
  action_config?: Record<string, unknown> | undefined;
}

export interface EvaluateRulesResult {
  rules_evaluated: number;
  rules_triggered: number;
  insights_created: number;
  decisions_created: number;
  memories_set: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRule(r: {
  id: string; tenant_id: string; name: string; description: string | null;
  is_active: boolean; priority: number; condition: unknown;
  action_type: string; action_config: unknown;
  last_evaluated_at: Date | null; last_triggered_at: Date | null;
  trigger_count: number; created_at: Date; updated_at: Date;
}): BusinessRuleRecord {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    description: r.description,
    is_active: r.is_active,
    priority: r.priority,
    condition: r.condition as unknown as ConditionNode,
    action_type: r.action_type as BusinessRuleRecord['action_type'],
    action_config: r.action_config as Record<string, unknown>,
    last_evaluated_at: r.last_evaluated_at?.toISOString() ?? null,
    last_triggered_at: r.last_triggered_at?.toISOString() ?? null,
    trigger_count: r.trigger_count,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}

/**
 * Resolve a dot-notation field path into nested connector data.
 * e.g. "ERP.stock_levels.paracetamol" → data["ERP.stock_levels"]["paracetamol"]
 *
 * The connector data top-level keys are already "connector.endpoint" (with a dot),
 * so we try the longest prefix first that matches a top-level key.
 */
function resolveField(data: Record<string, unknown>, fieldPath: string): unknown {
  // First try: top-level key matches exactly
  if (Object.prototype.hasOwnProperty.call(data, fieldPath)) {
    return data[fieldPath];
  }

  // Try longest-prefix match against connector data keys (keys contain dots)
  const parts = fieldPath.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    const topKey = parts.slice(0, i).join('.');
    if (Object.prototype.hasOwnProperty.call(data, topKey)) {
      const nested = data[topKey];
      const remainder = parts.slice(i);
      return remainder.reduce((acc: unknown, key) => {
        if (acc !== null && typeof acc === 'object' && !Array.isArray(acc)) {
          return (acc as Record<string, unknown>)[key];
        }
        return undefined;
      }, nested);
    }
  }

  return undefined;
}

// ─── Condition Evaluator ──────────────────────────────────────────────────────

function evaluateLeaf(leaf: RuleConditionLeaf, data: Record<string, unknown>): boolean {
  const actual = resolveField(data, leaf.field);
  const expected = leaf.value;

  const coerceNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  switch (leaf.operator) {
    case 'eq':          return actual == expected;
    case 'neq':         return actual != expected;
    case 'gt': {
      const actualNumber = coerceNumber(actual);
      return actualNumber !== null && actualNumber > Number(expected);
    }
    case 'gte': {
      const actualNumber = coerceNumber(actual);
      return actualNumber !== null && actualNumber >= Number(expected);
    }
    case 'lt': {
      const actualNumber = coerceNumber(actual);
      return actualNumber !== null && actualNumber < Number(expected);
    }
    case 'lte': {
      const actualNumber = coerceNumber(actual);
      return actualNumber !== null && actualNumber <= Number(expected);
    }
    case 'contains':    return typeof actual === 'string' && actual.includes(String(expected));
    case 'not_contains':return typeof actual === 'string' && !actual.includes(String(expected));
    case 'is_null':     return actual === null || actual === undefined;
    case 'is_not_null': return actual !== null && actual !== undefined;
    default:            return false;
  }
}

function evaluateNode(node: ConditionNode, data: Record<string, unknown>): boolean {
  if (node.type === 'condition') {
    return evaluateLeaf(node, data);
  }
  // group
  if (node.logic === 'AND') {
    return node.conditions.every(child => evaluateNode(child, data));
  }
  return node.conditions.some(child => evaluateNode(child, data));
}

// ─── Action Executor ──────────────────────────────────────────────────────────

async function executeAction(
  tenantId: string,
  ruleId: string,
  ruleName: string,
  actionType: BusinessRuleRecord['action_type'],
  actionConfig: Record<string, unknown>,
  runId: string,
  triggeredField: string,
  connectorData: Record<string, unknown>
): Promise<{ insightsCreated: number; decisionsCreated: number; memoriesSet: number }> {
  let insightsCreated = 0;
  let decisionsCreated = 0;
  let memoriesSet = 0;

  switch (actionType) {
    case 'CREATE_DECISION': {
      const cfg = actionConfig as Partial<CreateDecisionActionConfig>;
      const title = (cfg.title ?? `Rule triggered: ${ruleName}`).slice(0, 255);
      const recommendation = cfg.recommendation ?? `Business rule "${ruleName}" condition was met. Review and take appropriate action.`;
      const priority = cfg.priority ?? 'MEDIUM';

      const insightExplanation = `The business rule "${ruleName}" automatically detected a condition in your data that requires attention. The specific condition that triggered this alert was: ${triggeredField}.`;

      // Create a synthetic insight for the rule trigger
      const insight = await prisma.generatedInsight.create({
        data: {
          tenant_id:       tenantId,
          analysis_run_id: runId,
          title:           `Rule: ${ruleName}`.slice(0, 255),
          summary:         `Business rule "${ruleName}" automatically detected a condition that requires action.`,
          type:            'RISK',
          severity:        priority === 'URGENT' || priority === 'HIGH' ? 'CRITICAL' : 'WARNING',
          confidence:      1.0,
          evidence:        { rule_id: ruleId, rule_name: ruleName, triggered_field: triggeredField } as object,
          explanation:     insightExplanation,
        },
      });
      insightsCreated++;

      const decisionExplanation = `This action was automatically triggered by the rule "${ruleName}" because a predefined business condition was met. Acting on this recommendation will address the detected issue before it escalates. Ignoring it may allow the underlying condition to worsen.`;

      // Create decision — rule-triggered decisions are always confidence=1.0
      const decision = await prisma.decisionPoint.create({
        data: {
          tenant_id:        tenantId,
          insight_id:       insight.id,
          title,
          recommendation,
          priority,
          confidence:       1.0,
          status:           'APPROVED',   // rules are deterministic — approve immediately
          approved_at:      new Date(),
          triggered_source: 'BUSINESS_RULE',
          explanation:      decisionExplanation,
          reasoning_chain:  {
            rule_id:           ruleId,
            rule_name:         ruleName,
            triggered_field:   triggeredField,
            action_type:       'CREATE_DECISION',
            confidence_basis:  'deterministic_rule',
          } as object,
        },
      });

      // Enqueue execution immediately
      void enqueueDecisionExecution(tenantId, decision.id);
      decisionsCreated++;

      // Notify admins for URGENT/HIGH priority rule triggers (fire-and-forget)
      if (priority === 'URGENT' || priority === 'HIGH') {
        void notifyRuleTriggered(tenantId, ruleId, ruleName, priority, triggeredField);
      }

      logger.info('Rules engine: decision created', {
        tenantId, ruleId, decisionId: decision.id, title,
      });
      break;
    }

    case 'SET_MEMORY': {
      const cfg = actionConfig as Partial<SetMemoryActionConfig>;
      if (!cfg.key || !cfg.value) break;

      await upsertMemory(tenantId, {
        key:      cfg.key,
        value:    cfg.value,
        category: cfg.category ?? 'AI_LEARNING',
        source:   'SYSTEM_OBSERVED',
        confidence: 1.0,
      });
      memoriesSet++;

      logger.info('Rules engine: memory set', { tenantId, ruleId, key: cfg.key });
      break;
    }
  }

  return { insightsCreated, decisionsCreated, memoriesSet };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listRules(tenantId: string): Promise<BusinessRuleRecord[]> {
  const rules = await prisma.businessRule.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ priority: 'asc' }, { created_at: 'desc' }],
  });
  return rules.map(formatRule);
}

export async function getRule(tenantId: string, ruleId: string): Promise<BusinessRuleRecord | null> {
  const rule = await prisma.businessRule.findFirst({
    where: { id: ruleId, tenant_id: tenantId },
  });
  return rule ? formatRule(rule) : null;
}

export async function createRule(tenantId: string, input: CreateRuleInput): Promise<BusinessRuleRecord> {
  const rule = await prisma.businessRule.create({
    data: {
      tenant_id:     tenantId,
      name:          input.name,
      description:   input.description ?? null,
      is_active:     input.is_active ?? true,
      priority:      input.priority ?? 100,
      condition:     input.condition as object,
      action_type:   input.action_type,
      action_config: input.action_config as object,
    },
  });
  return formatRule(rule);
}

export async function updateRule(
  tenantId: string,
  ruleId: string,
  input: UpdateRuleInput
): Promise<BusinessRuleRecord | null> {
  const existing = await prisma.businessRule.findFirst({
    where: { id: ruleId, tenant_id: tenantId },
  });
  if (!existing) return null;

  const rule = await prisma.businessRule.update({
    where: { id: ruleId },
    data: {
      ...(input.name !== undefined         && { name: input.name }),
      ...(input.description !== undefined  && { description: input.description }),
      ...(input.is_active !== undefined    && { is_active: input.is_active }),
      ...(input.priority !== undefined     && { priority: input.priority }),
      ...(input.condition !== undefined    && { condition: input.condition as object }),
      ...(input.action_type !== undefined  && { action_type: input.action_type }),
      ...(input.action_config !== undefined && { action_config: input.action_config as object }),
    },
  });
  return formatRule(rule);
}

export async function deleteRule(tenantId: string, ruleId: string): Promise<boolean> {
  const existing = await prisma.businessRule.findFirst({
    where: { id: ruleId, tenant_id: tenantId },
  });
  if (!existing) return false;
  await prisma.businessRule.delete({ where: { id: ruleId } });
  return true;
}

// ─── Dry-run (test without side effects) ─────────────────────────────────────

export async function testRule(
  tenantId: string,
  ruleId: string,
  connectorData: Record<string, unknown>
): Promise<{ matched: boolean; matched_conditions: string[]; preview: string }> {
  const rule = await prisma.businessRule.findFirst({
    where: { id: ruleId, tenant_id: tenantId },
  });
  if (!rule) {
    return { matched: false, matched_conditions: [], preview: 'Rule not found.' };
  }

  const condition = rule.condition as unknown as ConditionNode;
  const matched = evaluateNode(condition, connectorData);

  // Collect which leaf conditions matched for user feedback
  const matchedConditions: string[] = [];
  collectMatchedLeaves(condition, connectorData, matchedConditions);

  const preview = matched
    ? `Rule "${rule.name}" WOULD TRIGGER. Action: ${rule.action_type}`
    : `Rule "${rule.name}" would NOT trigger (condition not met).`;

  return { matched, matched_conditions: matchedConditions, preview };
}

function collectMatchedLeaves(
  node: ConditionNode,
  data: Record<string, unknown>,
  results: string[]
): void {
  if (node.type === 'condition') {
    if (evaluateLeaf(node, data)) {
      const actual = resolveField(data, node.field);
      results.push(`${node.field} ${node.operator} ${node.value ?? ''} (actual: ${JSON.stringify(actual)})`);
    }
    return;
  }
  for (const child of node.conditions) {
    collectMatchedLeaves(child, data, results);
  }
}

// ─── Main evaluator (called during analysis runs) ────────────────────────────

/**
 * Evaluate all active rules for a tenant against the given connector data snapshot.
 * Called by analysis-engine.service.ts with the already-fetched data.
 */
export async function evaluateRulesForTenant(
  tenantId: string,
  runId: string,
  connectorData: Record<string, unknown>,
  triggeredBy: string = 'ANALYSIS_RUN'
): Promise<EvaluateRulesResult> {
  const rules = await prisma.businessRule.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: { priority: 'asc' },
  });

  if (!rules.length) {
    return { rules_evaluated: 0, rules_triggered: 0, insights_created: 0, decisions_created: 0, memories_set: 0 };
  }

  let rulesTriggered = 0;
  let insightsCreated = 0;
  let decisionsCreated = 0;
  let memoriesSet = 0;
  const now = new Date();

  for (const rule of rules) {
    const condition = rule.condition as unknown as ConditionNode;
    const matched = evaluateNode(condition, connectorData);

    // Always update last_evaluated_at
    void prisma.businessRule.update({
      where: { id: rule.id },
      data: { last_evaluated_at: now },
    });

    if (!matched) {
      // Log skipped execution
      void prisma.ruleExecution.create({
        data: {
          tenant_id:        tenantId,
          rule_id:          rule.id,
          status:           'SKIPPED',
          triggered_by:     triggeredBy,
          context_snapshot: {} as object,
        },
      });
      continue;
    }

    rulesTriggered++;

    // Find which field triggered the rule (first matched leaf)
    const matchedLeaves: string[] = [];
    collectMatchedLeaves(condition, connectorData, matchedLeaves);
    const triggeredField = matchedLeaves[0] ?? 'unknown';

    try {
      const result = await executeAction(
        tenantId,
        rule.id,
        rule.name,
        rule.action_type as BusinessRuleRecord['action_type'],
        rule.action_config as Record<string, unknown>,
        runId,
        triggeredField,
        connectorData
      );

      insightsCreated  += result.insightsCreated;
      decisionsCreated += result.decisionsCreated;
      memoriesSet      += result.memoriesSet;

      // Update rule stats and log successful execution
      await prisma.businessRule.update({
        where: { id: rule.id },
        data: {
          last_triggered_at: now,
          trigger_count:     { increment: 1 },
        },
      });

      void prisma.ruleExecution.create({
        data: {
          tenant_id:        tenantId,
          rule_id:          rule.id,
          status:           'COMPLETED',
          triggered_by:     triggeredBy,
          context_snapshot: { matched_conditions: matchedLeaves } as object,
          action_result:    result as object,
        },
      });

      logger.info('Rules engine: rule triggered and executed', {
        tenantId, ruleId: rule.id, ruleName: rule.name, triggeredField,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Rules engine: action execution failed', {
        tenantId, ruleId: rule.id, error: message,
      });

      void prisma.ruleExecution.create({
        data: {
          tenant_id:        tenantId,
          rule_id:          rule.id,
          status:           'FAILED',
          triggered_by:     triggeredBy,
          context_snapshot: { matched_conditions: matchedLeaves } as object,
          error_message:    message,
        },
      });
    }
  }

  logger.info('Rules engine: evaluation complete', {
    tenantId,
    rules_evaluated: rules.length,
    rules_triggered: rulesTriggered,
    insights_created: insightsCreated,
    decisions_created: decisionsCreated,
  });

  return {
    rules_evaluated:  rules.length,
    rules_triggered:  rulesTriggered,
    insights_created: insightsCreated,
    decisions_created: decisionsCreated,
    memories_set:     memoriesSet,
  };
}

// ─── Execution history ────────────────────────────────────────────────────────

export async function listRuleExecutions(
  tenantId: string,
  ruleId: string,
  limit = 20
): Promise<Array<{
  id: string; status: string; triggered_by: string;
  context_snapshot: unknown; action_result: unknown;
  error_message: string | null; created_at: string;
}>> {
  const executions = await prisma.ruleExecution.findMany({
    where: { rule_id: ruleId, tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return executions.map(e => ({
    id:               e.id,
    status:           e.status,
    triggered_by:     e.triggered_by,
    context_snapshot: e.context_snapshot,
    action_result:    e.action_result,
    error_message:    e.error_message,
    created_at:       e.created_at.toISOString(),
  }));
}
