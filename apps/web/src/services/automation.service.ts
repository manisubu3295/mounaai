import { apiClient } from '@/lib/api-client';
import type {
  AutomationWorkflowDefinition,
  AutomationWorkflowKey,
  N8nIntegrationConfig,
  WorkflowRun,
  PaginatedResponse,
} from '@pocketcomputer/shared-types';

export async function getN8nConfig(): Promise<N8nIntegrationConfig | null> {
  const res = await apiClient.get<{ data: { config: N8nIntegrationConfig | null } }>('/automation/settings/n8n');
  return res.data.data.config;
}

export async function upsertN8nConfig(data: {
  base_url: string;
  api_key?: string;
  callback_secret?: string;
  timeout_ms: number;
  is_enabled: boolean;
}): Promise<N8nIntegrationConfig> {
  const res = await apiClient.put<{ data: { config: N8nIntegrationConfig } }>('/automation/settings/n8n', data);
  return res.data.data.config;
}

export async function listAutomationWorkflows(): Promise<AutomationWorkflowDefinition[]> {
  const res = await apiClient.get<{ data: { workflows: AutomationWorkflowDefinition[] } }>('/automation/settings/workflows');
  return res.data.data.workflows;
}

export async function saveAutomationWorkflows(workflows: AutomationWorkflowDefinition[]): Promise<AutomationWorkflowDefinition[]> {
  const res = await apiClient.put<{ data: { workflows: AutomationWorkflowDefinition[] } }>('/automation/settings/workflows', {
    workflows: workflows.map((workflow) => ({
      key: workflow.key,
      name: workflow.name,
      description: workflow.description,
      webhook_path: workflow.webhook_path,
      workflow_version: workflow.workflow_version,
      is_enabled: workflow.is_enabled,
      trigger_source: workflow.trigger_source,
    })),
  });
  return res.data.data.workflows;
}

export async function listWorkflowRuns(params?: {
  page?: number;
  limit?: number;
  status?: WorkflowRun['status'];
  workflow_key?: AutomationWorkflowKey;
}): Promise<PaginatedResponse<WorkflowRun>> {
  const res = await apiClient.get<{ data: PaginatedResponse<WorkflowRun> }>('/automation/workflow-runs', { params });
  return res.data.data;
}

export async function triggerReminder(data: {
  title: string;
  message: string;
  remind_at?: string;
  recipients: string[];
  related_decision_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<WorkflowRun> {
  const res = await apiClient.post<{ data: { workflow_run: WorkflowRun } }>('/automation/reminders', data);
  return res.data.data.workflow_run;
}

export async function triggerWeatherEmail(data: {
  recipient_email: string;
  connector_name?: string;
  endpoint_name?: string;
  subject?: string;
  city_label?: string;
}): Promise<WorkflowRun> {
  const res = await apiClient.post<{ data: { workflow_run: WorkflowRun } }>('/automation/weather-email', data);
  return res.data.data.workflow_run;
}

export async function testAutomationWorkflow(key: AutomationWorkflowKey, payload?: Record<string, unknown>): Promise<WorkflowRun> {
  const res = await apiClient.post<{ data: { workflow_run: WorkflowRun } }>(`/automation/workflows/${key}/test`, { payload: payload ?? {} });
  return res.data.data.workflow_run;
}