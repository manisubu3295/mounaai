import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { runSimulationSchema } from '../validation/simulate.schema.js';
import { runSimulation } from '../services/simulate.service.js';
import { z } from 'zod';

export const simulateRouter: ExpressRouter = Router();

simulateRouter.use(authenticate);

// POST /api/v1/simulate
simulateRouter.post(
  '/',
  validate(runSimulationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scenario } = req.validatedBody as z.infer<typeof runSimulationSchema>;
      const result = await runSimulation(req.user!.tenant_id, scenario);
      res.json({ success: true, data: { simulation: result } });
    } catch (err) {
      next(err);
    }
  }
);
