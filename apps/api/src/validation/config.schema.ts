import { z } from 'zod';

export const upsertLlmConfigSchema = z.object({
  provider_id: z.string().uuid(),
  api_key: z.string().min(1).optional(),
  base_url: z.string().url().nullable().optional(),
  model: z.string().min(1).max(100),
  temperature: z.number().min(0).max(1).default(0.7),
  max_tokens: z.number().int().min(256).max(8192).default(2048),
  timeout_ms: z.number().int().min(5000).max(120000).default(30000),
});

export type UpsertLlmConfigInput = z.infer<typeof upsertLlmConfigSchema>;
