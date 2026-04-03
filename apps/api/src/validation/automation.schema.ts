import { z } from 'zod';

export const automationWorkflowKeySchema = z.enum([
  'REMINDER_SCHEDULED',
  'DECISION_APPROVED',
  'DECISION_REJECTED',
  'ANALYSIS_RUN_REQUESTED',
  'WEATHER_EMAIL',
]);

export const upsertN8nConfigSchema = z.object({
  base_url: z.string().url(),
  api_key: z.string().min(1).optional(),
  callback_secret: z.string().min(8).optional(),
  timeout_ms: z.number().int().min(1000).max(120000).default(15000),
  is_enabled: z.boolean().default(true),
});

export const upsertAutomationWorkflowsSchema = z.object({
  workflows: z.array(z.object({
    key: automationWorkflowKeySchema,
    name: z.string().min(1).max(120),
    description: z.string().max(240).nullable().optional(),
    webhook_path: z.string().min(1).regex(/^\//, 'Webhook path must start with /'),
    workflow_version: z.string().min(1).max(32).default('v1'),
    is_enabled: z.boolean(),
    trigger_source: z.enum(['MANUAL', 'EVENT']),
  })).min(1),
});

export const listWorkflowRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMED_OUT']).optional(),
  workflow_key: automationWorkflowKeySchema.optional(),
});

export const triggerReminderSchema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(1000),
  remind_at: z.string().datetime().optional(),
  recipients: z.array(z.string().min(1).max(120)).default([]),
  related_decision_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const triggerWeatherEmailSchema = z.object({
  recipient_email: z.string().email(),
  connector_name: z.string().min(1).max(120).default('Open-Meteo Weather'),
  endpoint_name: z.string().min(1).max(120).default('Current Weather Chennai'),
  subject: z.string().min(1).max(160).default('Current weather update'),
  city_label: z.string().min(1).max(120).default('Chennai'),
});

export const testWorkflowTriggerSchema = z.object({
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const n8nWorkflowCallbackSchema = z.object({
  workflow_run_id: z.string().uuid(),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'TIMED_OUT']),
  external_run_id: z.string().min(1).optional(),
  error_message: z.string().min(1).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
});

export type UpsertN8nConfigInput = z.infer<typeof upsertN8nConfigSchema>;
export type UpsertAutomationWorkflowsInput = z.infer<typeof upsertAutomationWorkflowsSchema>;
export type TriggerReminderInput = z.infer<typeof triggerReminderSchema>;
export type TriggerWeatherEmailInput = z.infer<typeof triggerWeatherEmailSchema>;
export type TestWorkflowTriggerInput = z.infer<typeof testWorkflowTriggerSchema>;
export type N8nWorkflowCallbackInput = z.infer<typeof n8nWorkflowCallbackSchema>;