import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createAnalysisRunSchema } from '../validation/analysis.schema.js';
import * as analysisRunService from '../services/analysis-run.service.js';
import { z } from 'zod';

export const analysisRouter: ExpressRouter = Router();
analysisRouter.use(authenticate);

analysisRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const result = await analysisRunService.listAnalysisRuns(req.user!.tenant_id, page, limit);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

analysisRouter.post('/', validate(createAnalysisRunSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof createAnalysisRunSchema>;
    const run = await analysisRunService.createAnalysisRun(req.user!.tenant_id, req.user!.id, body.summary);
    res.status(201).json({ success: true, data: { analysis_run: run } });
  } catch (err) { next(err); }
});

analysisRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await analysisRunService.getAnalysisRunDetail(req.user!.tenant_id, req.params['id']!);
    res.json({ success: true, data: { analysis_run: detail } });
  } catch (err) { next(err); }
});