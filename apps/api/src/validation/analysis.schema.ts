import { z } from 'zod';

export const listAnalysisRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createAnalysisRunSchema = z.object({
  summary: z.record(z.unknown()).optional(),
});

export type CreateAnalysisRunInput = z.infer<typeof createAnalysisRunSchema>;