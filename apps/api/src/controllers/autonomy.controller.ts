import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateAutonomyConfigSchema } from '../validation/autonomy.schema.js';
import * as decisionLoopService from '../services/decision-loop.service.js';
import { syncTenantSchedule } from '../jobs/scheduler.js';
import { z } from 'zod';

export const autonomyRouter: ExpressRouter = Router();
autonomyRouter.use(authenticate);

// GET /api/v1/autonomy — read current config (any authenticated user)
autonomyRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await decisionLoopService.getOrCreateAutonomyConfig(req.user!.tenant_id);
    res.json({ success: true, data: { config } });
  } catch (err) { next(err); }
});

// PUT /api/v1/autonomy — update config (admin only)
autonomyRouter.put(
  '/',
  requireAdmin,
  validate(updateAutonomyConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as z.infer<typeof updateAutonomyConfigSchema>;
      const config = await decisionLoopService.updateAutonomyConfig(req.user!.tenant_id, {
        auto_analysis_enabled: body.auto_analysis_enabled,
        analysis_interval_minutes: body.analysis_interval_minutes,
        auto_approve_threshold: body.auto_approve_threshold,
        review_threshold: body.review_threshold,
        max_auto_actions_per_run: body.max_auto_actions_per_run,
      });

      // Sync the scheduler whenever the config changes
      void syncTenantSchedule(req.user!.tenant_id);

      res.json({ success: true, data: { config } });
    } catch (err) { next(err); }
  }
);
