import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateDecisionStatusSchema } from '../validation/decision.schema.js';
import * as decisionService from '../services/decision.service.js';
import { explainDecision } from '../services/explanation.service.js';
import { z } from 'zod';

export const decisionRouter: ExpressRouter = Router();
decisionRouter.use(authenticate);

decisionRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);
    const status = req.query['status'] as 'OPEN' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'REJECTED' | 'TRIGGERED' | 'COMPLETED' | undefined;
    const result = await decisionService.listDecisions(req.user!.tenant_id, page, limit, status);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

decisionRouter.post('/:id/status', validate(updateDecisionStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof updateDecisionStatusSchema>;
    const decision = await decisionService.updateDecisionStatus(req.user!.tenant_id, req.params['id']!, req.user!.id, body.status);
    res.json({ success: true, data: { decision } });
  } catch (err) { next(err); }
});

// POST /api/v1/decisions/:id/feedback — save human feedback notes
decisionRouter.post('/:id/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = (req.body as { notes?: string }).notes ?? '';
    const decision = await decisionService.addFeedback(req.user!.tenant_id, req.params['id']!, notes);
    res.json({ success: true, data: { decision } });
  } catch (err) { next(err); }
});

// GET /api/v1/decisions/:id/explain — on-demand plain-English explanation
decisionRouter.get('/:id/explain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await explainDecision(req.user!.tenant_id, req.params['id']!);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});