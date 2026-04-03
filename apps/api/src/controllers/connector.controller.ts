import { Router, Request, Response, NextFunction, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';
import { rateLimits } from '../middleware/rate-limit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createApiConnectorSchema, createApiEndpointSchema,
  createDbConnectorSchema, createQueryTemplateSchema, schemaMappingSchema,
} from '../validation/connector.schema.js';
import * as connectorService from '../services/connector.service.js';
import * as fileConnectorService from '../services/file-connector.service.js';
import { z } from 'zod';
import { previewMasking } from '../services/masking.service.js';
import { prisma } from '../lib/prisma.js';

export const connectorRouter: ExpressRouter = Router();
connectorRouter.use(authenticate, requireAdmin);

// ─── API Connectors ───────────────────────────────────────────────────────────

connectorRouter.get('/api', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await connectorService.listApiConnectors(req.user!.tenant_id);
    res.json({ success: true, data: { connectors: items } });
  } catch (err) { next(err); }
});

connectorRouter.post('/api', validate(createApiConnectorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof createApiConnectorSchema>;
    const input: {
      name: string;
      description?: string;
      base_url: string;
      auth_type: string;
      auth_config?: Record<string, string>;
      default_headers?: Record<string, string>;
    } = {
      name: body.name,
      base_url: body.base_url,
      auth_type: body.auth_type,
    };

    if (body.description !== undefined) input.description = body.description;
    if (body.auth_config !== undefined) input.auth_config = body.auth_config;
    if (body.default_headers !== undefined) input.default_headers = body.default_headers;

    const c = await connectorService.createApiConnector(req.user!.tenant_id, req.user!.id, input);
    res.status(201).json({ success: true, data: { connector: c } });
  } catch (err) { next(err); }
});

connectorRouter.post('/api/:id/test', rateLimits.connectorTest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await connectorService.testApiConnector(req.user!.tenant_id, req.params['id']!);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

connectorRouter.post('/api/:id/endpoints', validate(createApiEndpointSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof createApiEndpointSchema>;
    const input: {
      name: string;
      description?: string;
      method: string;
      path_template: string;
      query_params?: Record<string, string>;
      body_template?: Record<string, unknown> | null;
      timeout_ms?: number;
      retry_count?: number;
    } = {
      name: body.name,
      method: body.method,
      path_template: body.path_template,
      timeout_ms: body.timeout_ms,
      retry_count: body.retry_count,
    };

    if (body.description !== undefined) input.description = body.description;
    if (body.query_params !== undefined) input.query_params = body.query_params;
    if (body.body_template !== undefined) input.body_template = body.body_template;

    const ep = await connectorService.addApiEndpoint(req.user!.tenant_id, req.params['id']!, input);
    res.status(201).json({ success: true, data: { endpoint: ep } });
  } catch (err) { next(err); }
});

connectorRouter.put('/api/:id/mapping', validate(schemaMappingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof schemaMappingSchema>;
    const mapping = await connectorService.upsertApiMapping(req.user!.tenant_id, req.params['id']!, body.field_mappings);
    res.json({ success: true, data: { mapping } });
  } catch (err) { next(err); }
});

connectorRouter.delete('/api/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await connectorService.deleteConnector(req.user!.tenant_id, req.params['id']!, 'API', req.user!.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── DB Connectors ────────────────────────────────────────────────────────────

connectorRouter.get('/db', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await connectorService.listDbConnectors(req.user!.tenant_id);
    res.json({ success: true, data: { connectors: items } });
  } catch (err) { next(err); }
});

connectorRouter.post('/db', validate(createDbConnectorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof createDbConnectorSchema>;
    const c = await connectorService.createDbConnector(req.user!.tenant_id, req.user!.id, body);
    res.status(201).json({ success: true, data: { connector: c } });
  } catch (err) { next(err); }
});

connectorRouter.post('/db/:id/test', rateLimits.connectorTest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await connectorService.testDbConnector(req.user!.tenant_id, req.params['id']!);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

connectorRouter.get('/db/:id/schema', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = await connectorService.getDbSchema(req.user!.tenant_id, req.params['id']!);
    res.json({ success: true, data: { tables: schema } });
  } catch (err) { next(err); }
});

connectorRouter.post('/db/:id/queries', validate(createQueryTemplateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.validatedBody as z.infer<typeof createQueryTemplateSchema>;
    const input: {
      name: string;
      description?: string;
      sql_template: string;
      params?: Array<{ name: string; type: string; source: string }>;
      timeout_ms?: number;
    } = {
      name: body.name,
      sql_template: body.sql_template,
      params: body.params,
      timeout_ms: body.timeout_ms,
    };

    if (body.description !== undefined) input.description = body.description;

    const t = await connectorService.addQueryTemplate(req.user!.tenant_id, req.params['id']!, input);
    res.status(201).json({ success: true, data: { template: t } });
  } catch (err) { next(err); }
});

connectorRouter.delete('/db/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await connectorService.deleteConnector(req.user!.tenant_id, req.params['id']!, 'DB', req.user!.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── File Connectors ──────────────────────────────────────────────────────────

connectorRouter.get('/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await fileConnectorService.listFileConnectors(req.user!.tenant_id);
    res.json({ success: true, data: { connectors: items } });
  } catch (err) { next(err); }
});

connectorRouter.post('/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, file_name, csv_text } = req.body as {
      name: string; description?: string; file_name: string; csv_text: string;
    };
    if (!name || !file_name || !csv_text) {
      return void res.status(400).json({ success: false, error: 'name, file_name, and csv_text are required' });
    }
    const fc = await fileConnectorService.createFileConnector(req.user!.tenant_id, { name, description, file_name, csv_text });
    res.status(201).json({ success: true, data: { connector: fc } });
  } catch (err) { next(err); }
});

connectorRouter.delete('/file/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await fileConnectorService.deleteFileConnector(req.user!.tenant_id, req.params['id']!);
    if (!deleted) return void res.status(404).json({ success: false, error: 'File connector not found' });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─── Masking ──────────────────────────────────────────────────────────────────

connectorRouter.get('/masking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.maskingRule.findMany({
      where: { tenant_id: req.user!.tenant_id },
      orderBy: { priority: 'asc' },
    });
    res.json({ success: true, data: { rules } });
  } catch (err) { next(err); }
});

connectorRouter.post('/masking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, match_type, match_pattern, strategy, mask_config, priority } = req.body as {
      name: string; match_type: string; match_pattern: string; strategy: string;
      mask_config?: object; priority?: number;
    };
    const rule = await prisma.maskingRule.create({
      data: {
        tenant_id: req.user!.tenant_id,
        name, match_type: match_type as never, match_pattern,
        strategy: strategy as never,
        mask_config: (mask_config ?? {}) as object,
        priority: priority ?? 100,
      },
    });
    res.status(201).json({ success: true, data: { rule } });
  } catch (err) { next(err); }
});

connectorRouter.delete('/masking/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.maskingRule.deleteMany({
      where: { id: req.params['id']!, tenant_id: req.user!.tenant_id },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

connectorRouter.post('/masking/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.maskingRule.findMany({
      where: { tenant_id: req.user!.tenant_id, is_active: true },
      orderBy: { priority: 'asc' },
    });
    const sample = req.body['sample_payload'] as Record<string, unknown>;
    const result = previewMasking(
      rules.map((r: (typeof rules)[number]) => ({
        id: r.id, match_type: r.match_type, match_pattern: r.match_pattern,
        strategy: r.strategy, mask_config: r.mask_config as Record<string, unknown>, priority: r.priority,
      })),
      sample
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
