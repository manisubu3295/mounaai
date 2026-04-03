import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { upsertLlmConfigSchema } from '../validation/config.schema.js';
import * as llmConfigService from '../services/llm-config.service.js';
import { auditLog } from '../services/audit.service.js';
import { z } from 'zod';

export const configRouter: ExpressRouter = Router();
configRouter.use(authenticate);

// GET /settings/llm/providers
configRouter.get('/llm/providers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = await llmConfigService.listProviders();
    res.json({ success: true, data: { providers } });
  } catch (err) { next(err); }
});

// GET /settings/llm
configRouter.get('/llm', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await llmConfigService.getLlmConfig(req.user!.tenant_id);
    res.json({ success: true, data: { config } });
  } catch (err) { next(err); }
});

// PUT /settings/llm
configRouter.put('/llm', requireAdmin, validate(upsertLlmConfigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof upsertLlmConfigSchema>;
    const config = await llmConfigService.upsertLlmConfig(req.user!.tenant_id, body);

    await auditLog({
      tenant_id: req.user!.tenant_id,
      user_id: req.user!.id,
      action: 'llm.config.update',
      resource_type: 'config',
      resource_id: config.id,
      ip_address: req.ip ?? null,
      status: 'SUCCESS',
      payload: { model: config.model, provider: config.provider_name },
    });

    res.json({ success: true, data: { config } });
  } catch (err) { next(err); }
});

// POST /settings/llm/test
configRouter.post('/llm/test', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await llmConfigService.testLlmConfig(req.user!.tenant_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
