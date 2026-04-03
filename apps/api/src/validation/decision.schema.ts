import { z } from 'zod';

export const listDecisionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'APPROVAL_REQUIRED', 'APPROVED', 'REJECTED', 'TRIGGERED', 'COMPLETED']).optional(),
});

export const updateDecisionStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});