import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConditionOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains' | 'is_null' | 'is_not_null';

export interface RuleConditionLeaf {
  type: 'condition';
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

export type RuleActionType = 'CREATE_DECISION' | 'SET_MEMORY';

export interface BusinessRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  condition: ConditionNode;
  action_type: RuleActionType;
  action_config: Record<string, unknown>;
  last_evaluated_at: string | null;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  is_active?: boolean;
  priority?: number;
  condition: ConditionNode;
  action_type: RuleActionType;
  action_config: Record<string, unknown>;
}

export interface RuleTestResult {
  matched: boolean;
  matched_conditions: string[];
  preview: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function listRules(): Promise<BusinessRule[]> {
  const res = await apiClient.get<{ data: { rules: BusinessRule[] } }>('/rules');
  return res.data.data.rules;
}

export async function createRule(input: CreateRuleInput): Promise<BusinessRule> {
  const res = await apiClient.post<{ data: { rule: BusinessRule } }>('/rules', input);
  return res.data.data.rule;
}

export async function updateRule(id: string, input: Partial<CreateRuleInput>): Promise<BusinessRule> {
  const res = await apiClient.put<{ data: { rule: BusinessRule } }>(`/rules/${id}`, input);
  return res.data.data.rule;
}

export async function deleteRule(id: string): Promise<void> {
  await apiClient.delete(`/rules/${id}`);
}

export async function testRule(id: string): Promise<RuleTestResult> {
  const res = await apiClient.post<{ data: RuleTestResult }>(`/rules/${id}/test`);
  return res.data.data;
}
