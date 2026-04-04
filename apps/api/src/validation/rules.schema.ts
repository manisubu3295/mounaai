import { z } from 'zod';

// ─── Condition node schemas ───────────────────────────────────────────────────

const conditionOperatorSchema = z.enum([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'contains', 'not_contains', 'is_null', 'is_not_null',
]);

const ruleConditionLeafSchema = z.object({
  type:     z.literal('condition'),
  field:    z.string().min(1).max(200),
  operator: conditionOperatorSchema,
  value:    z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

type RuleConditionLeafInput = z.infer<typeof ruleConditionLeafSchema>;
type RuleConditionGroupInput = {
  type: 'group';
  logic: 'AND' | 'OR';
  conditions: Array<RuleConditionLeafInput | RuleConditionGroupInput>;
};

// Recursive group schema
const ruleConditionGroupSchema: z.ZodType<RuleConditionGroupInput> = z.lazy(() =>
  z.object({
    type:       z.literal('group'),
    logic:      z.enum(['AND', 'OR']),
    conditions: z.array(
      z.union([ruleConditionLeafSchema, ruleConditionGroupSchema])
    ).min(1),
  })
);

const conditionNodeSchema = z.union([ruleConditionLeafSchema, ruleConditionGroupSchema]);

// ─── Action types ─────────────────────────────────────────────────────────────

const actionTypeSchema = z.enum(['CREATE_DECISION', 'SET_MEMORY']);

// ─── Rule CRUD schemas ────────────────────────────────────────────────────────

export const createRuleSchema = z.object({
  name:         z.string().min(1).max(120),
  description:  z.string().max(500).optional(),
  is_active:    z.boolean().optional(),
  priority:     z.number().int().min(1).max(999).optional(),
  condition:    conditionNodeSchema,
  action_type:  actionTypeSchema,
  action_config: z.record(z.unknown()),
});

export const updateRuleSchema = z.object({
  name:         z.string().min(1).max(120).optional(),
  description:  z.string().max(500).optional(),
  is_active:    z.boolean().optional(),
  priority:     z.number().int().min(1).max(999).optional(),
  condition:    conditionNodeSchema.optional(),
  action_type:  actionTypeSchema.optional(),
  action_config: z.record(z.unknown()).optional(),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
