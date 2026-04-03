import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createKpiSchema, updateKpiSchema } from '../validation/kpi.schema.js';
import * as kpiService from '../services/kpi.service.js';
import { z } from 'zod';

export const kpiRouter: ExpressRouter = Router();
kpiRouter.use(authenticate);

kpiRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const result = await kpiService.listKpis(req.user!.tenant_id, page, limit);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

kpiRouter.post('/', validate(createKpiSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof createKpiSchema>;
    const kpi = await kpiService.createKpi(req.user!.tenant_id, body);
    res.status(201).json({ success: true, data: { kpi } });
  } catch (err) { next(err); }
});

kpiRouter.put('/:id', validate(updateKpiSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof updateKpiSchema>;
    const kpi = await kpiService.updateKpi(req.user!.tenant_id, req.params['id']!, body);
    if (!kpi) return void res.status(404).json({ success: false, error: 'KPI not found' });
    res.json({ success: true, data: { kpi } });
  } catch (err) { next(err); }
});

kpiRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await kpiService.deleteKpi(req.user!.tenant_id, req.params['id']!);
    if (!deleted) return void res.status(404).json({ success: false, error: 'KPI not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});