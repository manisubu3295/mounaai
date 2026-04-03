import { z } from 'zod';

export const updateAutonomyConfigSchema = z.object({
  auto_analysis_enabled: z.boolean().optional(),
  analysis_interval_minutes: z.number().int().min(30).max(10080).optional(), // 30 min – 1 week
  auto_approve_threshold: z.number().min(0.5).max(1).optional(),
  review_threshold: z.number().min(0.1).max(0.9).optional(),
  max_auto_actions_per_run: z.number().int().min(1).max(20).optional(),
});

export type UpdateAutonomyConfigInput = z.infer<typeof updateAutonomyConfigSchema>;
