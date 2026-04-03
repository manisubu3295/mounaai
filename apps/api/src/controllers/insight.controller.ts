import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as insightService from '../services/insight.service.js';
import { explainInsight } from '../services/explanation.service.js';

export const insightRouter: ExpressRouter = Router();
insightRouter.use(authenticate);

insightRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const severity = req.query['severity'] as 'INFO' | 'WARNING' | 'CRITICAL' | undefined;
    const type = req.query['type'] as 'RISK' | 'OPPORTUNITY' | 'INEFFICIENCY' | 'WATCH' | undefined;
    const filters = {
      ...(severity ? { severity } : {}),
      ...(type ? { type } : {}),
    };
    const result = await insightService.listInsights(req.user!.tenant_id, page, limit, filters);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/v1/insights/:id/explain — on-demand plain-English explanation
insightRouter.get('/:id/explain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await explainInsight(req.user!.tenant_id, req.params['id']!);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});