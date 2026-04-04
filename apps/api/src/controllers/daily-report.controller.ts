import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateDailyReportSchema } from '../validation/daily-report.schema.js';
import * as dailyReportService from '../services/daily-report.service.js';
import { syncDailyReportSchedule } from '../jobs/scheduler.js';
import type { z } from 'zod';
import type { updateDailyReportSchema as Schema } from '../validation/daily-report.schema.js';

export const dailyReportRouter: ExpressRouter = Router();
dailyReportRouter.use(authenticate, requireAdmin);

// GET /api/v1/daily-report — get current config (auto-creates defaults)
dailyReportRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await dailyReportService.getOrCreateDailyReport(req.user!.tenant_id);
    res.json({ success: true, data: { daily_report: config } });
  } catch (err) { next(err); }
});

// PUT /api/v1/daily-report — update config
dailyReportRouter.put(
  '/',
  validate(updateDailyReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.validatedBody as z.infer<typeof Schema>;
      const config = await dailyReportService.updateDailyReport(
        req.user!.tenant_id,
        body as Parameters<typeof dailyReportService.updateDailyReport>[1]
      );

      // Re-sync the BullMQ cron job
      await syncDailyReportSchedule(req.user!.tenant_id);

      res.json({ success: true, data: { daily_report: config } });
    } catch (err) { next(err); }
  }
);
