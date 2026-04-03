import { z } from 'zod';

export const listKpisQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createKpiSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  formula: z.string().min(1).max(2000),
  unit: z.string().max(50).optional(),
  target_value: z.number().optional(),
  warning_threshold: z.number().optional(),
  critical_threshold: z.number().optional(),
  owner_role: z.enum(['TENANT_ADMIN', 'ANALYST', 'VIEWER']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

export type CreateKpiInput = z.infer<typeof createKpiSchema>;

export const updateKpiSchema = z.object({
  name:               z.string().min(1).max(255).optional(),
  slug:               z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  description:        z.string().max(1000).optional(),
  formula:            z.string().min(1).max(2000).optional(),
  unit:               z.string().max(50).optional(),
  target_value:       z.number().nullable().optional(),
  warning_threshold:  z.number().nullable().optional(),
  critical_threshold: z.number().nullable().optional(),
  owner_role:         z.enum(['TENANT_ADMIN', 'ANALYST', 'VIEWER']).nullable().optional(),
  status:             z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

export type UpdateKpiInput = z.infer<typeof updateKpiSchema>;