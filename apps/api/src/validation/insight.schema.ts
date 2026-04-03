import { z } from 'zod';

export const listInsightsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  type: z.enum(['RISK', 'OPPORTUNITY', 'INEFFICIENCY', 'WATCH']).optional(),
});