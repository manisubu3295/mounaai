import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { decrypt, encrypt, maskSecret } from '../crypto/crypto.service.js';
import { httpClient } from '../lib/http-client.js';
import { logger } from '../lib/logger.js';
import { AppError, AuthError, NotFoundError } from '../types/errors.js';
import { ApiConnector } from '../connectors/api-connector.js';
import { completeDecision } from './decision-loop.service.js';
import type {
  AutomationWorkflowDefinition,
  AutomationWorkflowKey,
  N8nIntegrationConfig,
  PaginatedResponse,
  WorkflowRun,
} from '@pocketcomputer/shared-types';
import type {
  N8nWorkflowCallbackInput,
  TriggerReminderInput,
  TriggerWeatherEmailInput,
  UpsertAutomationWorkflowsInput,
  UpsertN8nConfigInput,
} from '../validation/automation.schema.js';

type WorkflowTemplate = {
  key: AutomationWorkflowKey;
  name: string;
  description: string;
  webhook_path: string;
  workflow_version: string;
  trigger_source: 'MANUAL' | 'EVENT';
};

const DEFAULT_WORKFLOWS: WorkflowTemplate[] = [
  {
    key: 'REMINDER_SCHEDULED',
    name: 'Reminder Dispatch',
    description: 'Send tenant-scoped reminders through self-hosted n8n workflows.',
    webhook_path: '/webhook/pocketcomputer-reminder',
    workflow_version: 'v1',
    trigger_source: 'MANUAL',
  },
  {
    key: 'DECISION_APPROVED',
    name: 'Decision Approved',
    description: 'Run downstream automation after a decision is approved.',
    webhook_path: '/webhook/pocketcomputer-decision-approved',
    workflow_version: 'v1',
    trigger_source: 'EVENT',
  },
  {
    key: 'DECISION_REJECTED',
    name: 'Decision Rejected',
    description: 'Notify or escalate when a decision is rejected.',
    webhook_path: '/webhook/pocketcomputer-decision-rejected',
    workflow_version: 'v1',
    trigger_source: 'EVENT',
  },
  {
    key: 'ANALYSIS_RUN_REQUESTED',
    name: 'Analysis Run Requested',
    description: 'Kick off external automation when an analysis run is created.',
    webhook_path: '/webhook/pocketcomputer-analysis-run',
    workflow_version: 'v1',
    trigger_source: 'EVENT',
  },
  {
    key: 'WEATHER_EMAIL',
    name: 'Weather Email',
    description: 'Fetch the current weather snapshot and deliver it to a recipient via self-hosted n8n.',
    webhook_path: '/webhook/pocketcomputer-weather-email',
    workflow_version: 'v1',
    trigger_source: 'MANUAL',
  },
];

function toObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return value === undefined ? {} : { value };
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return toObject(value) as Prisma.InputJsonValue;
}

function formatConfig(config: {
  id: string;
  base_url: string;
  timeout_ms: number;
  is_enabled: boolean;
  api_key_enc: string | null;
  callback_secret_enc: string | null;
}): N8nIntegrationConfig {
  let apiKeyHint: string | null = null;
  let callbackSecretHint: string | null = null;

  try {
    apiKeyHint = config.api_key_enc ? maskSecret(decrypt(config.api_key_enc)) : null;
  } catch {
    apiKeyHint = null;
  }

  try {
    callbackSecretHint = config.callback_secret_enc ? maskSecret(decrypt(config.callback_secret_enc)) : null;
  } catch {
    callbackSecretHint = null;
  }

  return {
    id: config.id,
    base_url: config.base_url,
    timeout_ms: config.timeout_ms,
    is_enabled: config.is_enabled,
    api_key_hint: apiKeyHint,
    callback_secret_hint: callbackSecretHint,
  };
}

function formatWorkflow(workflow: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  webhook_path: string;
  workflow_version: string;
  is_enabled: boolean;
  trigger_source: string;
  updated_at: Date;
}): AutomationWorkflowDefinition {
  return {
    id: workflow.id,
    key: workflow.key as AutomationWorkflowKey,
    name: workflow.name,
    description: workflow.description,
    webhook_path: workflow.webhook_path,
    workflow_version: workflow.workflow_version,
    is_enabled: workflow.is_enabled,
    trigger_source: workflow.trigger_source as 'MANUAL' | 'EVENT',
    updated_at: workflow.updated_at.toISOString(),
  };
}

function formatWorkflowRun(run: {
  id: string;
  workflow_key: string;
  workflow_version: string;
  trigger_event: string;
  status: 'REQUESTED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT';
  external_run_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  created_at: Date;
}): WorkflowRun {
  return {
    id: run.id,
    workflow_key: run.workflow_key as AutomationWorkflowKey,
    workflow_version: run.workflow_version,
    trigger_event: run.trigger_event,
    status: run.status,
    external_run_id: run.external_run_id,
    started_at: run.started_at?.toISOString() ?? null,
    completed_at: run.completed_at?.toISOString() ?? null,
    error_message: run.error_message,
    created_at: run.created_at.toISOString(),
  };
}

async function ensureDefaultWorkflows(tenantId: string, integrationId: string) {
  for (const workflow of DEFAULT_WORKFLOWS) {
    await prisma.automationWorkflow.upsert({
      where: { tenant_id_key: { tenant_id: tenantId, key: workflow.key } },
      update: {
        name: workflow.name,
        description: workflow.description,
        webhook_path: workflow.webhook_path,
        workflow_version: workflow.workflow_version,
        trigger_source: workflow.trigger_source,
        integration_id: integrationId,
      },
      create: {
        tenant_id: tenantId,
        integration_id: integrationId,
        key: workflow.key,
        name: workflow.name,
        description: workflow.description,
        webhook_path: workflow.webhook_path,
        workflow_version: workflow.workflow_version,
        trigger_source: workflow.trigger_source,
        is_enabled: false,
      },
    });
  }
}

function buildWebhookUrl(baseUrl: string, webhookPath: string): string {
  const url = new URL(webhookPath, baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError('AUTOMATION_URL_INVALID', 'n8n webhook URL must use http or https.', 400);
  }
  return url.toString();
}

function extractExternalRunId(payload: unknown): string | null {
  const data = payload !== null && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  const candidates = [data?.['run_id'], data?.['executionId'], data?.['id']];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return null;
}

function getWeatherSummary(data: Record<string, unknown>) {
  const current = data['current'] !== null && typeof data['current'] === 'object'
    ? data['current'] as Record<string, unknown>
    : null;

  return {
    temperature_2m: typeof current?.['temperature_2m'] === 'number' ? current['temperature_2m'] : null,
    relative_humidity_2m: typeof current?.['relative_humidity_2m'] === 'number' ? current['relative_humidity_2m'] : null,
    wind_speed_10m: typeof current?.['wind_speed_10m'] === 'number' ? current['wind_speed_10m'] : null,
    weather_code: typeof current?.['weather_code'] === 'number' ? current['weather_code'] : null,
    observed_at: typeof current?.['time'] === 'string' ? current['time'] : null,
  };
}

async function getWeatherConnectorSnapshot(
  tenantId: string,
  connectorName: string,
  endpointName: string
): Promise<Record<string, unknown>> {
  const connector = await prisma.apiConnector.findFirst({
    where: { tenant_id: tenantId, name: connectorName, status: 'ACTIVE' },
    include: { endpoints: { where: { name: endpointName }, take: 1 } },
  });

  if (!connector) {
    throw new NotFoundError(`API connector '${connectorName}'`);
  }

  const endpoint = connector.endpoints[0];
  if (!endpoint) {
    throw new NotFoundError(`API endpoint '${endpointName}'`);
  }

  const apiConnector = new ApiConnector({
    id: connector.id,
    base_url: connector.base_url,
    auth_type: connector.auth_type,
    auth_config_enc: connector.auth_config_enc,
    default_headers: connector.default_headers as Record<string, string>,
  });

  const execution = await apiConnector.execute({
    name: endpoint.name,
    method: endpoint.method,
    path_template: endpoint.path_template,
    query_params: endpoint.query_params as Record<string, string>,
    body_template: endpoint.body_template as Record<string, unknown> | null,
    timeout_ms: endpoint.timeout_ms,
    retry_count: endpoint.retry_count,
  }, {});

  return execution.transformed;
}

export async function getN8nIntegration(tenantId: string): Promise<N8nIntegrationConfig | null> {
  const config = await prisma.n8nIntegration.findUnique({ where: { tenant_id: tenantId } });
  return config ? formatConfig(config) : null;
}

export async function upsertN8nIntegration(tenantId: string, input: UpsertN8nConfigInput): Promise<N8nIntegrationConfig> {
  const existing = await prisma.n8nIntegration.findUnique({ where: { tenant_id: tenantId } });

  const config = await prisma.n8nIntegration.upsert({
    where: { tenant_id: tenantId },
    update: {
      base_url: input.base_url,
      timeout_ms: input.timeout_ms,
      is_enabled: input.is_enabled,
      api_key_enc: input.api_key ? encrypt(input.api_key) : existing?.api_key_enc ?? null,
      callback_secret_enc: input.callback_secret ? encrypt(input.callback_secret) : existing?.callback_secret_enc ?? null,
    },
    create: {
      tenant_id: tenantId,
      base_url: input.base_url,
      timeout_ms: input.timeout_ms,
      is_enabled: input.is_enabled,
      api_key_enc: input.api_key ? encrypt(input.api_key) : null,
      callback_secret_enc: input.callback_secret ? encrypt(input.callback_secret) : null,
    },
  });

  await ensureDefaultWorkflows(tenantId, config.id);
  return formatConfig(config);
}

export async function listAutomationWorkflows(tenantId: string): Promise<AutomationWorkflowDefinition[]> {
  const config = await prisma.n8nIntegration.findUnique({ where: { tenant_id: tenantId } });
  if (!config) return [];

  await ensureDefaultWorkflows(tenantId, config.id);
  const workflows = await prisma.automationWorkflow.findMany({
    where: { tenant_id: tenantId },
    orderBy: { key: 'asc' },
  });

  return workflows.map(formatWorkflow);
}

export async function upsertAutomationWorkflows(
  tenantId: string,
  input: UpsertAutomationWorkflowsInput
): Promise<AutomationWorkflowDefinition[]> {
  const config = await prisma.n8nIntegration.findUnique({ where: { tenant_id: tenantId } });
  if (!config) {
    throw new AppError('AUTOMATION_NOT_CONFIGURED', 'Configure n8n before saving workflows.', 400);
  }

  await ensureDefaultWorkflows(tenantId, config.id);

  await prisma.$transaction(
    input.workflows.map((workflow) => prisma.automationWorkflow.update({
      where: { tenant_id_key: { tenant_id: tenantId, key: workflow.key } },
      data: {
        name: workflow.name,
        description: workflow.description ?? null,
        webhook_path: workflow.webhook_path,
        workflow_version: workflow.workflow_version,
        is_enabled: workflow.is_enabled,
        trigger_source: workflow.trigger_source,
      },
    }))
  );

  return listAutomationWorkflows(tenantId);
}

export async function listWorkflowRuns(
  tenantId: string,
  page = 1,
  limit = 20,
  filters?: { status?: 'REQUESTED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT'; workflow_key?: AutomationWorkflowKey }
): Promise<PaginatedResponse<WorkflowRun>> {
  const skip = (page - 1) * limit;
  const where = {
    tenant_id: tenantId,
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.workflow_key ? { workflow_key: filters.workflow_key } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.workflowRun.count({ where }),
    prisma.workflowRun.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: items.map(formatWorkflowRun),
    total,
    page,
    limit,
    has_more: skip + items.length < total,
  };
}

async function triggerWorkflow(
  tenantId: string,
  workflowKey: AutomationWorkflowKey,
  triggerEvent: string,
  payload: Record<string, unknown>,
  strict: boolean
): Promise<WorkflowRun | null> {
  const integration = await prisma.n8nIntegration.findUnique({
    where: { tenant_id: tenantId },
    include: { workflows: { where: { key: workflowKey }, take: 1 } },
  });

  if (!integration || !integration.is_enabled) {
    if (strict) {
      throw new AppError('AUTOMATION_NOT_CONFIGURED', 'n8n integration is not enabled for this tenant.', 400);
    }
    return null;
  }

  const workflow = integration.workflows[0];
  if (!workflow || !workflow.is_enabled) {
    if (strict) {
      throw new AppError('WORKFLOW_DISABLED', `Workflow ${workflowKey} is not enabled.`, 400);
    }
    return null;
  }

  const webhookUrl = buildWebhookUrl(integration.base_url, workflow.webhook_path);
  const requestPayload = {
    workflow_run_id: '',
    workflow_key: workflow.key,
    workflow_version: workflow.workflow_version,
    trigger_event: triggerEvent,
    tenant_id: tenantId,
    triggered_at: new Date().toISOString(),
    payload,
  };

  const createdRun = await prisma.workflowRun.create({
    data: {
      tenant_id: tenantId,
      integration_id: integration.id,
      workflow_id: workflow.id,
      workflow_key: workflow.key,
      workflow_version: workflow.workflow_version,
      trigger_event: triggerEvent,
      status: 'REQUESTED',
      request_payload: requestPayload as object,
    },
  });

  requestPayload.workflow_run_id = createdRun.id;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-PocketComputer-Workflow-Key': workflow.key,
    'X-PocketComputer-Trigger-Event': triggerEvent,
    'X-PocketComputer-Workflow-Run-Id': createdRun.id,
  };

  if (integration.api_key_enc) {
    headers['Authorization'] = `Bearer ${decrypt(integration.api_key_enc)}`;
  }

  try {
    const response = await httpClient.post(webhookUrl, requestPayload, {
      timeout: integration.timeout_ms,
      headers,
    });

    const updatedRun = await prisma.workflowRun.update({
      where: { id: createdRun.id },
      data: {
        status: 'RUNNING',
        started_at: new Date(),
        external_run_id: extractExternalRunId(response.data),
        response_payload: toJsonInput(response.data),
        request_payload: requestPayload as object,
      },
    });

    return formatWorkflowRun(updatedRun);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown automation error';

    const failedRun = await prisma.workflowRun.update({
      where: { id: createdRun.id },
      data: {
        status: 'FAILED',
        started_at: new Date(),
        completed_at: new Date(),
        error_message: message,
        request_payload: requestPayload as object,
      },
    });

    logger.error('Failed to trigger n8n workflow', {
      tenant_id: tenantId,
      workflow_key: workflowKey,
      trigger_event: triggerEvent,
      error: message,
    });

    if (strict) {
      throw new AppError('AUTOMATION_TRIGGER_FAILED', message, 502, true);
    }

    return formatWorkflowRun(failedRun);
  }
}

export async function triggerReminderAutomation(
  tenantId: string,
  userId: string,
  input: TriggerReminderInput
): Promise<WorkflowRun> {
  const run = await triggerWorkflow(tenantId, 'REMINDER_SCHEDULED', 'reminder.scheduled', {
    title: input.title,
    message: input.message,
    remind_at: input.remind_at ?? null,
    recipients: input.recipients,
    related_decision_id: input.related_decision_id ?? null,
    metadata: input.metadata,
    requested_by_user_id: userId,
  }, true);

  if (!run) {
    throw new AppError('AUTOMATION_TRIGGER_FAILED', 'Failed to create reminder workflow run.', 502, true);
  }

  return run;
}

export async function triggerWeatherEmailAutomation(
  tenantId: string,
  userId: string,
  input: TriggerWeatherEmailInput
): Promise<WorkflowRun> {
  const weatherRaw = await getWeatherConnectorSnapshot(tenantId, input.connector_name, input.endpoint_name);
  const weather = getWeatherSummary(weatherRaw);

  const run = await triggerWorkflow(tenantId, 'WEATHER_EMAIL', 'weather.email.requested', {
    recipient_email: input.recipient_email,
    subject: input.subject,
    city_label: input.city_label,
    connector_name: input.connector_name,
    endpoint_name: input.endpoint_name,
    requested_by_user_id: userId,
    weather,
    raw_weather_payload: weatherRaw,
  }, true);

  if (!run) {
    throw new AppError('AUTOMATION_TRIGGER_FAILED', 'Failed to queue weather email workflow.', 502, true);
  }

  return run;
}

export async function testWorkflowTrigger(
  tenantId: string,
  workflowKey: AutomationWorkflowKey,
  payload: Record<string, unknown>
): Promise<WorkflowRun> {
  const run = await triggerWorkflow(tenantId, workflowKey, 'workflow.test', {
    test: true,
    payload,
  }, true);

  if (!run) {
    throw new AppError('AUTOMATION_TRIGGER_FAILED', 'Failed to trigger workflow test.', 502, true);
  }

  return run;
}

export async function handleN8nWorkflowCallback(
  input: N8nWorkflowCallbackInput,
  providedSecret: string | undefined
): Promise<WorkflowRun> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: input.workflow_run_id },
    include: { integration: true },
  });

  if (!run) throw new NotFoundError('Workflow run');

  if (!run.integration.callback_secret_enc) {
    throw new AuthError('Callback secret is not configured for this tenant.', 'AUTOMATION_CALLBACK_FORBIDDEN');
  }

  const expectedSecret = decrypt(run.integration.callback_secret_enc);
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new AuthError('Invalid automation callback secret.', 'AUTOMATION_CALLBACK_FORBIDDEN');
  }

  const updated = await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status: input.status,
      external_run_id: input.external_run_id ?? run.external_run_id,
      error_message: input.error_message ?? null,
      response_payload: input.output ? toJsonInput(input.output) : (run.response_payload ?? Prisma.JsonNull),
      started_at: input.status === 'RUNNING' ? (run.started_at ?? new Date()) : run.started_at,
      completed_at: ['COMPLETED', 'FAILED', 'TIMED_OUT'].includes(input.status) ? new Date() : null,
    },
  });

  // Close the decision loop: when a DECISION_APPROVED workflow completes,
  // mark the linked decision as COMPLETED.
  if (updated.workflow_key === 'DECISION_APPROVED' && input.status === 'COMPLETED') {
    const payload = run.request_payload as Record<string, unknown>;
    const inner = payload['payload'] as Record<string, unknown> | undefined;
    const decisionId = inner?.['decision_id'];
    if (typeof decisionId === 'string') {
      void completeDecision(decisionId);
    }
  }

  return formatWorkflowRun(updated);
}

export async function triggerDecisionStatusAutomation(
  tenantId: string,
  status: 'APPROVED' | 'REJECTED',
  payload: Record<string, unknown>
): Promise<void> {
  const workflowKey: AutomationWorkflowKey = status === 'APPROVED' ? 'DECISION_APPROVED' : 'DECISION_REJECTED';
  await triggerWorkflow(tenantId, workflowKey, `decision.${status.toLowerCase()}`, payload, false);
}

export async function triggerAnalysisRunRequestedAutomation(
  tenantId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await triggerWorkflow(tenantId, 'ANALYSIS_RUN_REQUESTED', 'analysis_run.requested', payload, false);
}

/**
 * Generic workflow trigger used by the rules engine.
 * Accepts any workflow key string (non-strict — silently skips if workflow not configured).
 */
export async function triggerWorkflowByKey(
  tenantId: string,
  workflowKey: string,
  triggerEvent: string,
  payload: Record<string, unknown>
): Promise<void> {
  await triggerWorkflow(tenantId, workflowKey as AutomationWorkflowKey, triggerEvent, payload, false);
}