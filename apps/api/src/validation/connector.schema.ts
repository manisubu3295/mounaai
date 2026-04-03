import { z } from 'zod';

export const createApiConnectorSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  base_url: z.string().url().refine((value) => /^https?:\/\//i.test(value), {
    message: 'Base URL must start with http:// or https://',
  }),
  auth_type: z.enum(['NONE', 'BEARER', 'API_KEY', 'BASIC', 'OAUTH2_CLIENT']),
  auth_config: z.record(z.string()).optional(),
  default_headers: z.record(z.string()).optional(),
});

export const createApiEndpointSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH']),
  path_template: z.string().min(1).refine((value) => value.startsWith('/'), {
    message: 'Endpoint path must start with /',
  }),
  query_params: z.record(z.string()).optional(),
  body_template: z.record(z.unknown()).nullable().optional(),
  timeout_ms: z.number().int().min(1000).max(30000).default(10000),
  retry_count: z.number().int().min(0).max(3).default(1),
});

export const createDbConnectorSchema = z.object({
  name: z.string().min(1).max(255),
  db_type: z.enum(['POSTGRESQL', 'MYSQL']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database_name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl_mode: z.enum(['DISABLE', 'REQUIRE', 'VERIFY_CA', 'VERIFY_FULL']).default('REQUIRE'),
});

export const createQueryTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  sql_template: z.string().min(1),
  params: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean']),
    source: z.enum(['user_input', 'extracted']),
  })).default([]),
  timeout_ms: z.number().int().min(1000).max(30000).default(5000),
});

export const schemaMappingSchema = z.object({
  field_mappings: z.array(z.object({
    source_path: z.string().min(1),
    alias: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'object']).default('string'),
    include_in_context: z.boolean().default(true),
    maskable: z.boolean().default(false),
  })),
});
