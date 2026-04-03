import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createRuleSchema, updateRuleSchema } from '../validation/rules.schema.js';
import * as rulesEngine from '../services/rules-engine.service.js';
import { fetchConnectorDataForTenant } from '../services/analysis-engine.service.js';
import { NotFoundError } from '../types/errors.js';
import { z } from 'zod';

export const rulesRouter: ExpressRouter = Router();
rulesRouter.use(authenticate);

// GET /api/v1/rules — list all rules
rulesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await rulesEngine.listRules(req.user!.tenant_id);
    res.json({ success: true, data: { rules } });
  } catch (err) { next(err); }
});

// POST /api/v1/rules — create rule (admin only)
rulesRouter.post(
  '/',
  requireAdmin,
  validate(createRuleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as z.infer<typeof createRuleSchema>;
      const rule = await rulesEngine.createRule(req.user!.tenant_id, {
        name:          body.name,
        description:   body.description,
        is_active:     body.is_active,
        priority:      body.priority,
        condition:     body.condition as rulesEngine.ConditionNode,
        action_type:   body.action_type,
        action_config: body.action_config as Record<string, unknown>,
      });
      res.status(201).json({ success: true, data: { rule } });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/rules/:id — get single rule
rulesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await rulesEngine.getRule(req.user!.tenant_id, req.params['id']!);
    if (!rule) throw new NotFoundError('Business rule');
    res.json({ success: true, data: { rule } });
  } catch (err) { next(err); }
});

// PUT /api/v1/rules/:id — update rule (admin only)
rulesRouter.put(
  '/:id',
  requireAdmin,
  validate(updateRuleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as z.infer<typeof updateRuleSchema>;
      const rule = await rulesEngine.updateRule(req.user!.tenant_id, req.params['id']!, {
        name:          body.name,
        description:   body.description,
        is_active:     body.is_active,
        priority:      body.priority,
        condition:     body.condition as rulesEngine.ConditionNode | undefined,
        action_type:   body.action_type,
        action_config: body.action_config as Record<string, unknown> | undefined,
      });
      if (!rule) throw new NotFoundError('Business rule');
      res.json({ success: true, data: { rule } });
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/rules/:id — delete rule (admin only)
rulesRouter.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await rulesEngine.deleteRule(req.user!.tenant_id, req.params['id']!);
    if (!deleted) throw new NotFoundError('Business rule');
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/v1/rules/:id/test — dry-run against latest connector data (no side effects)
rulesRouter.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connectorData = await fetchConnectorDataForTenant(req.user!.tenant_id);
    const result = await rulesEngine.testRule(req.user!.tenant_id, req.params['id']!, connectorData);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/rules/:id/executions — execution history for a rule
rulesRouter.get('/:id/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const executions = await rulesEngine.listRuleExecutions(req.user!.tenant_id, req.params['id']!, limit);
    res.json({ success: true, data: { executions } });
  } catch (err) { next(err); }
});
