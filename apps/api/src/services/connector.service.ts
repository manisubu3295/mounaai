import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../crypto/crypto.service.js';
import { NotFoundError } from '../types/errors.js';
import { assertConnectorLimit } from './plan-gate.service.js';
import { ApiConnector, validateEndpointPathTemplate, validateOutboundUrl } from '../connectors/api-connector.js';
import { DbConnector } from '../connectors/db-connector.js';
import { validateSqlTemplate } from '../connectors/sql-validator.js';
import { ValidationError } from '../types/errors.js';
import { auditLog } from './audit.service.js';

async function getConnectorMappings(tenantId: string, connectorType: 'API' | 'DB') {
  const mappings = await prisma.connectorSchemaMapping.findMany({
    where: { tenant_id: tenantId, connector_type: connectorType },
  });

  return new Map(mappings.map((mapping) => [mapping.connector_id, mapping]));
}

// ─── API Connectors ───────────────────────────────────────────────────────────

export async function listApiConnectors(tenantId: string) {
  const [connectors, mappings] = await Promise.all([
    prisma.apiConnector.findMany({
      where: { tenant_id: tenantId },
      include: { endpoints: true },
      orderBy: { created_at: 'desc' },
    }),
    getConnectorMappings(tenantId, 'API'),
  ]);

  return connectors.map((connector) => ({
    ...connector,
    mapping: mappings.get(connector.id) ?? null,
  }));
}

export async function createApiConnector(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    description?: string;
    base_url: string;
    auth_type: string;
    auth_config?: Record<string, string>;
    default_headers?: Record<string, string>;
  }
) {
  await assertConnectorLimit(tenantId);

  validateOutboundUrl(input.base_url);

  const auth_config_enc = input.auth_config
    ? encrypt(JSON.stringify(input.auth_config))
    : null;

  const connector = await prisma.apiConnector.create({
    data: {
      tenant_id: tenantId,
      name: input.name,
      description: input.description ?? null,
      base_url: input.base_url,
      auth_type: input.auth_type as never,
      auth_config_enc,
      default_headers: (input.default_headers ?? {}) as object,
    },
    include: { endpoints: true },
  });

  await auditLog({ tenant_id: tenantId, user_id: userId, action: 'connector.api.create', resource_type: 'connector', resource_id: connector.id, status: 'SUCCESS', payload: { name: connector.name } });
  return connector;
}

export async function testApiConnector(tenantId: string, connectorId: string) {
  const connector = await prisma.apiConnector.findUnique({
    where: { id: connectorId },
  });
  if (!connector || connector.tenant_id !== tenantId) throw new NotFoundError('Connector');

  const ac = new ApiConnector({
    id: connector.id,
    base_url: connector.base_url,
    auth_type: connector.auth_type,
    auth_config_enc: connector.auth_config_enc,
    default_headers: connector.default_headers as Record<string, string>,
  });

  const result = await ac.test();
  await prisma.apiConnector.update({
    where: { id: connectorId },
    data: { test_status: result.ok ? 'OK' : 'FAILED', last_tested_at: new Date() },
  });
  return result;
}

export async function addApiEndpoint(
  tenantId: string,
  connectorId: string,
  input: {
    name: string;
    description?: string;
    method: string;
    path_template: string;
    query_params?: Record<string, string>;
    body_template?: Record<string, unknown> | null;
    timeout_ms?: number;
    retry_count?: number;
  }
) {
  const connector = await prisma.apiConnector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.tenant_id !== tenantId) throw new NotFoundError('Connector');

  validateEndpointPathTemplate(connector.base_url, input.path_template);

  const data: Parameters<typeof prisma.apiConnectorEndpoint.create>[0]['data'] = {
    connector_id: connectorId,
    tenant_id: tenantId,
    name: input.name,
    description: input.description ?? null,
    method: input.method,
    path_template: input.path_template,
    query_params: (input.query_params ?? {}) as object,
    timeout_ms: input.timeout_ms ?? 10000,
    retry_count: input.retry_count ?? 1,
  };

  if (input.body_template !== undefined) {
    data.body_template = input.body_template === null
      ? Prisma.JsonNull
      : (input.body_template as Prisma.InputJsonValue);
  }

  return prisma.apiConnectorEndpoint.create({
    data,
  });
}

export async function upsertApiMapping(
  tenantId: string,
  connectorId: string,
  fieldMappings: unknown[]
) {
  const connector = await prisma.apiConnector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.tenant_id !== tenantId) throw new NotFoundError('Connector');

  return prisma.connectorSchemaMapping.upsert({
    where: { connector_id: connectorId },
    update: { field_mappings: fieldMappings as object[] },
    create: {
      connector_id: connectorId,
      connector_type: 'API',
      tenant_id: tenantId,
      field_mappings: fieldMappings as object[],
    },
  });
}

// ─── DB Connectors ────────────────────────────────────────────────────────────

export async function listDbConnectors(tenantId: string) {
  const [connectors, mappings] = await Promise.all([
    prisma.dbConnector.findMany({
      where: { tenant_id: tenantId },
      include: { query_templates: true },
      orderBy: { created_at: 'desc' },
    }),
    getConnectorMappings(tenantId, 'DB'),
  ]);

  return connectors.map((connector) => ({
    ...connector,
    mapping: mappings.get(connector.id) ?? null,
  }));
}

export async function createDbConnector(
  tenantId: string,
  userId: string,
  input: {
    name: string;
    db_type: string;
    host: string;
    port: number;
    database_name: string;
    username: string;
    password: string;
    ssl_mode?: string;
  }
) {
  await assertConnectorLimit(tenantId);

  const connector = await prisma.dbConnector.create({
    data: {
      tenant_id: tenantId,
      name: input.name,
      db_type: input.db_type as never,
      host: input.host,
      port: input.port,
      database_name: input.database_name,
      username_enc: encrypt(input.username),
      password_enc: encrypt(input.password),
      ssl_mode: (input.ssl_mode ?? 'REQUIRE') as never,
    },
    include: { query_templates: true },
  });

  await auditLog({ tenant_id: tenantId, user_id: userId, action: 'connector.db.create', resource_type: 'connector', resource_id: connector.id, status: 'SUCCESS', payload: { name: connector.name, host: connector.host } });
  return connector;
}

export async function testDbConnector(tenantId: string, connectorId: string) {
  const connector = await prisma.dbConnector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.tenant_id !== tenantId) throw new NotFoundError('Connector');

  const dc = new DbConnector({
    id: connector.id,
    db_type: connector.db_type,
    host: connector.host,
    port: connector.port,
    database_name: connector.database_name,
    username_enc: connector.username_enc,
    password_enc: connector.password_enc,
    ssl_mode: connector.ssl_mode,
  });

  const result = await dc.test();
  await prisma.dbConnector.update({
    where: { id: connectorId },
    data: { test_status: result.ok ? 'OK' : 'FAILED', last_tested_at: new Date() },
  });
  return result;
}

export async function getDbSchema(tenantId: string, connectorId: string) {
  const connector = await prisma.dbConnector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.tenant_id !== tenantId) throw new NotFoundError('Connector');

  const dc = new DbConnector({
    id: connector.id,
    db_type: connector.db_type,
    host: connector.host,
    port: connector.port,
    database_name: connector.database_name,
    username_enc: connector.username_enc,
    password_enc: connector.password_enc,
    ssl_mode: connector.ssl_mode,
  });

  return dc.discoverSchema();
}

export async function addQueryTemplate(
  tenantId: string,
  connectorId: string,
  input: {
    name: string;
    description?: string;
    sql_template: string;
    params?: Array<{ name: string; type: string; source: string }>;
    timeout_ms?: number;
  }
) {
  const connector = await prisma.dbConnector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.tenant_id !== tenantId) throw new NotFoundError('Connector');

  const validation = validateSqlTemplate(input.sql_template);
  if (!validation.valid) throw new ValidationError(validation.reason ?? 'Invalid SQL');

  return prisma.dbQueryTemplate.create({
    data: {
      connector_id: connectorId,
      tenant_id: tenantId,
      name: input.name,
      description: input.description ?? null,
      sql_template: input.sql_template,
      params: (input.params ?? []) as object[],
      timeout_ms: input.timeout_ms ?? 5000,
    },
  });
}

export async function deleteConnector(
  tenantId: string,
  connectorId: string,
  type: 'API' | 'DB',
  userId: string
) {
  if (type === 'API') {
    const c = await prisma.apiConnector.findUnique({ where: { id: connectorId } });
    if (!c || c.tenant_id !== tenantId) throw new NotFoundError('Connector');
    await prisma.apiConnector.delete({ where: { id: connectorId } });
  } else {
    const c = await prisma.dbConnector.findUnique({ where: { id: connectorId } });
    if (!c || c.tenant_id !== tenantId) throw new NotFoundError('Connector');
    DbConnector.closePool(connectorId);
    await prisma.dbConnector.delete({ where: { id: connectorId } });
  }

  await auditLog({ tenant_id: tenantId, user_id: userId, action: `connector.${type.toLowerCase()}.delete`, resource_type: 'connector', resource_id: connectorId, status: 'SUCCESS' });
}
