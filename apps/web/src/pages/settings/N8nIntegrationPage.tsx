import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CheckCircle, Loader2, Play, Save, Workflow, XCircle } from 'lucide-react';
import type { AutomationWorkflowDefinition, WorkflowRun } from '@pocketcomputer/shared-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getN8nConfig,
  listAutomationWorkflows,
  listWorkflowRuns,
  saveAutomationWorkflows,
  testAutomationWorkflow,
  triggerReminder,
  triggerWeatherEmail,
  upsertN8nConfig,
} from '@/services/automation.service';
import { useAuthStore } from '@/stores/auth.store';

interface N8nConfigFormValues {
  base_url: string;
  api_key: string;
  callback_secret: string;
  timeout_ms: number;
  is_enabled: boolean;
}

interface ReminderFormValues {
  title: string;
  message: string;
  remind_at: string;
  recipients: string;
}

interface WeatherEmailFormValues {
  recipient_email: string;
  subject: string;
  city_label: string;
}

function StatusBadge({ status }: { status: WorkflowRun['status'] }) {
  const classes = status === 'COMPLETED'
    ? 'text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] border-[hsl(var(--success)/0.3)]'
    : status === 'FAILED' || status === 'TIMED_OUT'
    ? 'text-[hsl(var(--error))] bg-[hsl(var(--error)/0.1)] border-[hsl(var(--error)/0.3)]'
    : 'text-[hsl(var(--accent-hover))] bg-[hsl(var(--accent)/0.1)] border-[hsl(var(--accent)/0.3)]';

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes}`}>{status}</span>;
}

export function N8nIntegrationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [workflowDrafts, setWorkflowDrafts] = useState<AutomationWorkflowDefinition[]>([]);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<string | null>(null);
  const [weatherResult, setWeatherResult] = useState<string | null>(null);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['n8n-config'],
    queryFn: getN8nConfig,
  });

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery({
    queryKey: ['automation-workflows'],
    queryFn: listAutomationWorkflows,
  });

  const { data: workflowRuns, isLoading: runsLoading } = useQuery({
    queryKey: ['workflow-runs'],
    queryFn: () => listWorkflowRuns({ page: 1, limit: 10 }),
    refetchInterval: 15000,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting: isConfigSubmitting },
  } = useForm<N8nConfigFormValues>({
    defaultValues: {
      base_url: '',
      api_key: '',
      callback_secret: '',
      timeout_ms: 15000,
      is_enabled: false,
    },
  });

  const reminderForm = useForm<ReminderFormValues>({
    defaultValues: {
      title: 'Daily follow-up reminder',
      message: 'Review pending decisions and send the next escalation if they are still open.',
      remind_at: '',
      recipients: '',
    },
  });

  const weatherForm = useForm<WeatherEmailFormValues>({
    defaultValues: {
      recipient_email: user?.email ?? '',
      subject: 'Current Chennai weather update',
      city_label: 'Chennai',
    },
  });

  useEffect(() => {
    if (config) {
      reset({
        base_url: config.base_url,
        api_key: '',
        callback_secret: '',
        timeout_ms: config.timeout_ms,
        is_enabled: config.is_enabled,
      });
    }
  }, [config, reset]);

  useEffect(() => {
    if (user?.email) {
      weatherForm.reset({
        recipient_email: user.email,
        subject: 'Current Chennai weather update',
        city_label: 'Chennai',
      });
    }
  }, [user?.email, weatherForm]);

  useEffect(() => {
    setWorkflowDrafts(workflows);
  }, [workflows]);

  const saveConfigMutation = useMutation({
    mutationFn: upsertN8nConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-config'] });
      queryClient.invalidateQueries({ queryKey: ['automation-workflows'] });
    },
  });

  const saveWorkflowsMutation = useMutation({
    mutationFn: saveAutomationWorkflows,
    onSuccess: (saved) => {
      setWorkflowDrafts(saved);
      setWorkflowMessage('Workflow definitions saved.');
      queryClient.invalidateQueries({ queryKey: ['automation-workflows'] });
    },
    onError: () => setWorkflowMessage('Could not save workflow definitions.'),
  });

  const testWorkflowMutation = useMutation({
    mutationFn: ({ key }: { key: AutomationWorkflowDefinition['key'] }) => testAutomationWorkflow(key, { source: 'settings_page' }),
    onSuccess: (run) => {
      setWorkflowMessage(`Triggered ${run.workflow_key} test run.`);
      queryClient.invalidateQueries({ queryKey: ['workflow-runs'] });
    },
    onError: () => setWorkflowMessage('Workflow test failed to start.'),
  });

  const reminderMutation = useMutation({
    mutationFn: triggerReminder,
    onSuccess: (run) => {
      setReminderResult(`Reminder workflow queued as ${run.workflow_key} (${run.id.slice(0, 8)}).`);
      queryClient.invalidateQueries({ queryKey: ['workflow-runs'] });
      reminderForm.reset({
        title: 'Daily follow-up reminder',
        message: 'Review pending decisions and send the next escalation if they are still open.',
        remind_at: '',
        recipients: '',
      });
    },
    onError: () => setReminderResult('Could not trigger the reminder workflow.'),
  });

  const weatherMutation = useMutation({
    mutationFn: triggerWeatherEmail,
    onSuccess: (run) => {
      setWeatherResult(`Weather email workflow queued as ${run.workflow_key} (${run.id.slice(0, 8)}).`);
      queryClient.invalidateQueries({ queryKey: ['workflow-runs'] });
    },
    onError: () => setWeatherResult('Could not trigger the weather email workflow.'),
  });

  const hasWorkflows = workflowDrafts.length > 0;
  const recentRuns = workflowRuns?.items ?? [];

  const onboardingHint = useMemo(() => {
    if (!config) return 'Add your self-hosted n8n base URL, optional bearer token, and callback secret.';
    return config.is_enabled
      ? 'n8n automation is enabled. Configure workflow paths and trigger reminders from this page.'
      : 'n8n configuration is saved but currently disabled.';
  }, [config]);

  if (configLoading && workflowsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--text-secondary))]" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[hsl(var(--text-primary))]">n8n Automation</h1>
            <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">{onboardingHint}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
            Callback header: <span className="font-mono text-[hsl(var(--text-primary))]">x-pocketcomputer-callback-secret</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Workflow className="w-4 h-4 text-[hsl(var(--accent-hover))]" />
                Integration Settings
              </CardTitle>
              <CardDescription>
                Point PocketComputer at your self-hosted n8n instance and secure callbacks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((values) => saveConfigMutation.mutate(values))} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="base_url">n8n Base URL</Label>
                  <Input id="base_url" placeholder="https://n8n.yourcompany.com" {...register('base_url', { required: true })} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="api_key">
                      Bearer Token
                      {config?.api_key_hint && <span className="ml-1.5 text-[hsl(var(--text-disabled))]">({config.api_key_hint})</span>}
                    </Label>
                    <Input id="api_key" type="password" placeholder="Optional n8n API token" {...register('api_key')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="callback_secret">
                      Callback Secret
                      {config?.callback_secret_hint && <span className="ml-1.5 text-[hsl(var(--text-disabled))]">({config.callback_secret_hint})</span>}
                    </Label>
                    <Input id="callback_secret" type="password" placeholder="Shared secret for callback verification" {...register('callback_secret')} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="timeout_ms">Timeout (ms)</Label>
                    <Input id="timeout_ms" type="number" min={1000} max={120000} {...register('timeout_ms', { valueAsNumber: true })} />
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm text-[hsl(var(--text-primary))]">
                    <input type="checkbox" className="accent-[hsl(var(--accent))]" {...register('is_enabled')} />
                    Enable n8n automation
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" loading={isConfigSubmitting || saveConfigMutation.isPending}>
                    <Save className="w-4 h-4" /> Save Settings
                  </Button>
                  {saveConfigMutation.isSuccess && (
                    <span className="text-xs text-[hsl(var(--success))] flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                  {saveConfigMutation.isError && (
                    <span className="text-xs text-[hsl(var(--error))] flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Save failed
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reminder Trigger</CardTitle>
              <CardDescription>
                Send immediate or scheduled reminder payloads into the configured n8n reminder workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={reminderForm.handleSubmit((values) => reminderMutation.mutate({
                  title: values.title,
                  message: values.message,
                  remind_at: values.remind_at ? new Date(values.remind_at).toISOString() : undefined,
                  recipients: values.recipients.split(',').map((item) => item.trim()).filter(Boolean),
                  metadata: { source: 'settings_page' },
                }))}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reminder_title">Title</Label>
                  <Input id="reminder_title" {...reminderForm.register('title', { required: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reminder_message">Message</Label>
                  <textarea
                    id="reminder_message"
                    rows={4}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                    {...reminderForm.register('message', { required: true })}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="remind_at">Remind At</Label>
                    <Input id="remind_at" type="datetime-local" {...reminderForm.register('remind_at')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="recipients">Recipients</Label>
                    <Input id="recipients" placeholder="ops@company.com, manager@company.com" {...reminderForm.register('recipients')} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={reminderMutation.isPending}>
                    <Play className="w-4 h-4" /> Trigger Reminder
                  </Button>
                  {reminderResult && <span className="text-xs text-[hsl(var(--text-secondary))]">{reminderResult}</span>}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weather Email Trigger</CardTitle>
            <CardDescription>
              Fetch the current weather from the Open-Meteo connector and send it to your email through a self-hosted n8n workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={weatherForm.handleSubmit((values) => weatherMutation.mutate({
                recipient_email: values.recipient_email,
                subject: values.subject,
                city_label: values.city_label,
                connector_name: 'Open-Meteo Weather',
                endpoint_name: 'Current Weather Chennai',
              }))}
              className="grid gap-4 md:grid-cols-[1fr_1fr_180px] md:items-end"
            >
              <div className="space-y-1.5">
                <Label htmlFor="weather_email_recipient">Recipient Email</Label>
                <Input id="weather_email_recipient" type="email" {...weatherForm.register('recipient_email', { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weather_email_subject">Subject</Label>
                <Input id="weather_email_subject" {...weatherForm.register('subject', { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weather_city_label">Location Label</Label>
                <Input id="weather_city_label" {...weatherForm.register('city_label', { required: true })} />
              </div>
              <div className="md:col-span-3 flex items-center gap-3">
                <Button type="submit" loading={weatherMutation.isPending}>
                  <Play className="w-4 h-4" /> Send Weather Email
                </Button>
                {weatherResult && <span className="text-xs text-[hsl(var(--text-secondary))]">{weatherResult}</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow Definitions</CardTitle>
            <CardDescription>
              Each event can point to a different n8n webhook path. These are relative to your configured base URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasWorkflows && (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] px-4 py-5 text-sm text-[hsl(var(--text-secondary))]">
                Save the integration settings first to provision the default workflow keys.
              </div>
            )}

            {workflowDrafts.map((workflow, index) => (
              <div key={workflow.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{workflow.name}</p>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">{workflow.key} · {workflow.trigger_source}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                    <input
                      type="checkbox"
                      className="accent-[hsl(var(--accent))]"
                      checked={workflow.is_enabled}
                      onChange={(event) => {
                        setWorkflowDrafts((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, is_enabled: event.target.checked } : item));
                      }}
                    />
                    Enabled
                  </label>
                </div>

                <div className="grid md:grid-cols-[1fr_120px] gap-3">
                  <div className="space-y-1.5">
                    <Label>Webhook Path</Label>
                    <Input
                      value={workflow.webhook_path}
                      onChange={(event) => {
                        const webhook_path = event.target.value;
                        setWorkflowDrafts((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, webhook_path } : item));
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Version</Label>
                    <Input
                      value={workflow.workflow_version}
                      onChange={(event) => {
                        const workflow_version = event.target.value;
                        setWorkflowDrafts((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, workflow_version } : item));
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => testWorkflowMutation.mutate({ key: workflow.key })}
                    loading={testWorkflowMutation.isPending}
                  >
                    <Play className="w-3.5 h-3.5" /> Test Workflow
                  </Button>
                  <span className="text-xs text-[hsl(var(--text-secondary))]">{workflow.description}</span>
                </div>
              </div>
            ))}

            {hasWorkflows && (
              <div className="flex items-center gap-3">
                <Button type="button" onClick={() => saveWorkflowsMutation.mutate(workflowDrafts)} loading={saveWorkflowsMutation.isPending}>
                  <Save className="w-4 h-4" /> Save Workflows
                </Button>
                {workflowMessage && <span className="text-xs text-[hsl(var(--text-secondary))]">{workflowMessage}</span>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Workflow Runs</CardTitle>
            <CardDescription>
              Monitor the last 10 workflow invocations and correlate them with n8n executions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading workflow runs
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="text-sm text-[hsl(var(--text-secondary))]">No workflow runs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-left text-[11px] uppercase tracking-wide text-[hsl(var(--text-disabled))]">
                      <th className="px-3 py-2">Workflow</th>
                      <th className="px-3 py-2">Trigger</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">External Run</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run) => (
                      <tr key={run.id} className="border-b border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]">
                        <td className="px-3 py-3 font-medium text-[hsl(var(--text-primary))]">{run.workflow_key}</td>
                        <td className="px-3 py-3">{run.trigger_event}</td>
                        <td className="px-3 py-3"><StatusBadge status={run.status} /></td>
                        <td className="px-3 py-3 font-mono text-xs">{run.external_run_id ?? '—'}</td>
                        <td className="px-3 py-3">{new Date(run.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}