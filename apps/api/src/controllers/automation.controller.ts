import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  listWorkflowRunsQuerySchema,
  n8nWorkflowCallbackSchema,
  testWorkflowTriggerSchema,
  triggerReminderSchema,
  triggerWeatherEmailSchema,
  upsertAutomationWorkflowsSchema,
  upsertN8nConfigSchema,
  type N8nWorkflowCallbackInput,
  type TestWorkflowTriggerInput,
  type TriggerReminderInput,
  type TriggerWeatherEmailInput,
  type UpsertAutomationWorkflowsInput,
  type UpsertN8nConfigInput,
} from '../validation/automation.schema.js';
import * as automationService from '../services/automation.service.js';
import { auditLog } from '../services/audit.service.js';

export const automationRouter: ExpressRouter = Router();

automationRouter.post('/callbacks/n8n', validate(n8nWorkflowCallbackSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const callbackSecretHeader = req.headers['x-pocketcomputer-callback-secret'];
    const callbackSecret = Array.isArray(callbackSecretHeader) ? callbackSecretHeader[0] : callbackSecretHeader;
    const body = req.validatedBody as N8nWorkflowCallbackInput;
    const run = await automationService.handleN8nWorkflowCallback(body, callbackSecret);
    res.json({ success: true, data: { workflow_run: run } });
  } catch (err) { next(err); }
});

automationRouter.use(authenticate);

automationRouter.get('/settings/n8n', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await automationService.getN8nIntegration(req.user!.tenant_id);
    res.json({ success: true, data: { config } });
  } catch (err) { next(err); }
});

automationRouter.put('/settings/n8n', requireAdmin, validate(upsertN8nConfigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as UpsertN8nConfigInput;
    const config = await automationService.upsertN8nIntegration(req.user!.tenant_id, body);

    await auditLog({
      tenant_id: req.user!.tenant_id,
      user_id: req.user!.id,
      action: 'automation.n8n.config.update',
      resource_type: 'automation_config',
      resource_id: config.id,
      ip_address: req.ip ?? null,
      status: 'SUCCESS',
      payload: { base_url: config.base_url, is_enabled: config.is_enabled, timeout_ms: config.timeout_ms },
    });

    res.json({ success: true, data: { config } });
  } catch (err) { next(err); }
});

automationRouter.get('/settings/workflows', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflows = await automationService.listAutomationWorkflows(req.user!.tenant_id);
    res.json({ success: true, data: { workflows } });
  } catch (err) { next(err); }
});

automationRouter.put('/settings/workflows', requireAdmin, validate(upsertAutomationWorkflowsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as UpsertAutomationWorkflowsInput;
    const workflows = await automationService.upsertAutomationWorkflows(req.user!.tenant_id, body);

    await auditLog({
      tenant_id: req.user!.tenant_id,
      user_id: req.user!.id,
      action: 'automation.workflow.update',
      resource_type: 'automation_workflow',
      ip_address: req.ip ?? null,
      status: 'SUCCESS',
      payload: { workflow_count: workflows.length },
    });

    res.json({ success: true, data: { workflows } });
  } catch (err) { next(err); }
});

automationRouter.get('/workflow-runs', requireAdmin, validate(listWorkflowRunsQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listWorkflowRunsQuerySchema.parse(req.query);
    const filters = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.workflow_key ? { workflow_key: query.workflow_key } : {}),
    };
    const runs = await automationService.listWorkflowRuns(req.user!.tenant_id, query.page, query.limit, filters);
    res.json({ success: true, data: runs });
  } catch (err) { next(err); }
});

automationRouter.post('/reminders', requireAdmin, validate(triggerReminderSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as TriggerReminderInput;
    const workflowRun = await automationService.triggerReminderAutomation(req.user!.tenant_id, req.user!.id, body);

    await auditLog({
      tenant_id: req.user!.tenant_id,
      user_id: req.user!.id,
      action: 'automation.reminder.trigger',
      resource_type: 'workflow_run',
      resource_id: workflowRun.id,
      ip_address: req.ip ?? null,
      status: 'SUCCESS',
      payload: { title: body.title, remind_at: body.remind_at ?? null, recipients: body.recipients },
    });

    res.status(202).json({ success: true, data: { workflow_run: workflowRun } });
  } catch (err) { next(err); }
});

automationRouter.post('/weather-email', requireAdmin, validate(triggerWeatherEmailSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as TriggerWeatherEmailInput;
    const workflowRun = await automationService.triggerWeatherEmailAutomation(req.user!.tenant_id, req.user!.id, body);

    await auditLog({
      tenant_id: req.user!.tenant_id,
      user_id: req.user!.id,
      action: 'automation.weather_email.trigger',
      resource_type: 'workflow_run',
      resource_id: workflowRun.id,
      ip_address: req.ip ?? null,
      status: 'SUCCESS',
      payload: {
        recipient_email: body.recipient_email,
        connector_name: body.connector_name,
        endpoint_name: body.endpoint_name,
        city_label: body.city_label,
      },
    });

    res.status(202).json({ success: true, data: { workflow_run: workflowRun } });
  } catch (err) { next(err); }
});

automationRouter.post('/workflows/:key/test', requireAdmin, validate(testWorkflowTriggerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workflowRun = await automationService.testWorkflowTrigger(
      req.user!.tenant_id,
      req.params['key'] as Parameters<typeof automationService.testWorkflowTrigger>[1],
      (req.validatedBody as TestWorkflowTriggerInput).payload
    );
    res.status(202).json({ success: true, data: { workflow_run: workflowRun } });
  } catch (err) { next(err); }
});