import { prisma } from '../lib/prisma.js';
import { ApiConnector } from '../connectors/api-connector.js';
import { DbConnector } from '../connectors/db-connector.js';
import { applyMasking } from '../services/masking.service.js';
import { logger } from '../lib/logger.js';
import { LLMTool, LLMToolCall } from './interface.js';
import { MessageSource } from '@pocketcomputer/shared-types';

export interface ToolCallResult {
  tool_call_id: string;
  tool_name: string;
  /** JSON string of the (masked) result to feed back to the LLM */
  content: string;
  source: MessageSource;
  masked_fields: string[];
  latency_ms: number;
  error?: string | undefined;
}

interface ConnectorMeta {
  connectorId: string;
  connectorName: string;
  connectorType: 'API' | 'DB';
  endpointOrQuery: string;
}

/** Sanitise a string so it matches /^[a-zA-Z0-9_-]{1,N}$/ */
function slug(s: string, maxLen = 48): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen);
}

/** Extract {{param}} placeholders from an API path/query/body template */
function extractTemplatePlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{\{(\w+)\}\}/g)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export class ToolRegistry {
  /** tool name → connector metadata */
  private readonly meta = new Map<string, ConnectorMeta>();

  /**
   * Build LLM tool definitions for all active connectors belonging to `tenantId`.
   * Populates the internal meta map so `executeTool` can resolve the right connector.
   */
  async buildTools(tenantId: string): Promise<LLMTool[]> {
    this.meta.clear();

    const [apiConnectors, dbConnectors] = await Promise.all([
      prisma.apiConnector.findMany({
        where: { tenant_id: tenantId, status: 'ACTIVE' },
        include: { endpoints: true },
      }),
      prisma.dbConnector.findMany({
        where: { tenant_id: tenantId, status: 'ACTIVE' },
        include: { query_templates: true },
      }),
    ]);

    const tools: LLMTool[] = [];

    // ── API connectors ──────────────────────────────────────────────────────
    for (const connector of apiConnectors) {
      for (const endpoint of connector.endpoints) {
        const toolName = `api_${slug(connector.id.slice(0, 8))}_${slug(endpoint.name)}`;

        // Collect all template placeholders across path, query params, and body
        const pathPlaceholders = extractTemplatePlaceholders(endpoint.path_template);
        const queryPlaceholders = extractTemplatePlaceholders(
          JSON.stringify(endpoint.query_params ?? {})
        );
        const bodyPlaceholders = extractTemplatePlaceholders(
          JSON.stringify(endpoint.body_template ?? {})
        );
        const allPlaceholders = [
          ...new Set([...pathPlaceholders, ...queryPlaceholders, ...bodyPlaceholders]),
        ];

        const properties: Record<string, unknown> = {};
        for (const p of allPlaceholders) {
          properties[p] = { type: 'string', description: `Template parameter: ${p}` };
        }

        tools.push({
          name: toolName,
          description:
            `Fetch live data from API connector "${connector.name}" — ` +
            `endpoint "${endpoint.name}" (${endpoint.method} ${connector.base_url}${endpoint.path_template}).` +
            (endpoint.description ? ` ${endpoint.description}` : ''),
          parameters: {
            type: 'object',
            properties,
            required: pathPlaceholders, // path params are required; query/body are optional
          },
        });

        this.meta.set(toolName, {
          connectorId: connector.id,
          connectorName: connector.name,
          connectorType: 'API',
          endpointOrQuery: endpoint.name,
        });
      }
    }

    // ── DB connectors ───────────────────────────────────────────────────────
    for (const connector of dbConnectors) {
      for (const template of connector.query_templates) {
        const toolName = `db_${slug(connector.id.slice(0, 8))}_${slug(template.name)}`;

        const params = (template.params ?? []) as Array<{
          name: string;
          type: string;
          description?: string;
        }>;

        const properties: Record<string, unknown> = {};
        for (const p of params) {
          properties[p.name] = {
            type: ['number', 'integer', 'float'].includes(p.type) ? 'number' : 'string',
            description: p.description ?? `Query parameter: ${p.name}`,
          };
        }

        const parameterSummary = params.length > 0
          ? ` Accepts parameters: ${params.map((p) => `${p.name} (${p.type})`).join(', ')}.`
          : ' No parameters required.';

        tools.push({
          name: toolName,
          description:
            `Query "${connector.database_name}" (${connector.db_type}) via connector ` +
            `"${connector.name}" — query template "${template.name}".` +
            (template.description ? ` ${template.description}` : '') +
            parameterSummary,
          parameters: {
            type: 'object',
            properties,
            required: params.map(p => p.name),
          },
        });

        this.meta.set(toolName, {
          connectorId: connector.id,
          connectorName: connector.name,
          connectorType: 'DB',
          endpointOrQuery: template.name,
        });
      }
    }

    return tools;
  }

  /**
   * Execute a single tool call requested by the LLM.
   * Always returns a result (even on error) so the agent loop can continue.
   */
  async executeTool(
    tenantId: string,
    chatId: string,
    call: LLMToolCall
  ): Promise<ToolCallResult> {
    const start = Date.now();
    const connectorMeta = this.meta.get(call.name);

    if (!connectorMeta) {
      logger.warn('Unknown tool called by LLM', { tool: call.name });
      return {
        tool_call_id: call.id,
        tool_name: call.name,
        content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
        source: {
          connector_id: '',
          connector_name: call.name,
          connector_type: 'API',
          endpoint_or_query: '',
          fetched_at: new Date().toISOString(),
        },
        masked_fields: [],
        latency_ms: Date.now() - start,
        error: `Unknown tool: ${call.name}`,
      };
    }

    let rawResult: Record<string, unknown>;
    let toolRunStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let errorMessage: string | undefined;

    try {
      if (connectorMeta.connectorType === 'API') {
        rawResult = await this.runApiConnector(tenantId, connectorMeta, call.arguments);
      } else {
        rawResult = await this.runDbConnector(tenantId, connectorMeta, call.arguments);
      }
    } catch (err) {
      toolRunStatus = 'FAILED';
      errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn('Tool execution failed', { tool: call.name, error: errorMessage });
      rawResult = { error: errorMessage };
    }

    // Apply masking even on partial results
    let maskedData = rawResult;
    let maskedFields: string[] = [];
    if (toolRunStatus === 'SUCCESS') {
      try {
        const maskResult = await applyMasking(tenantId, rawResult);
        maskedData = maskResult.masked_data;
        maskedFields = maskResult.masked_fields;
      } catch {
        // Masking failure should not block the agent loop
      }
    }

    // Log tool run
    await prisma.toolRun.create({
      data: {
        tenant_id: tenantId,
        chat_id: chatId,
        connector_id: connectorMeta.connectorId,
        connector_type: connectorMeta.connectorType,
        endpoint_name: connectorMeta.endpointOrQuery,
        status: toolRunStatus,
        latency_ms: Date.now() - start,
        masked_fields: maskedFields,
        error_message: errorMessage ?? null,
      },
    });

    return {
      tool_call_id: call.id,
      tool_name: call.name,
      content: JSON.stringify(maskedData),
      source: {
        connector_id: connectorMeta.connectorId,
        connector_name: connectorMeta.connectorName,
        connector_type: connectorMeta.connectorType,
        endpoint_or_query: connectorMeta.endpointOrQuery,
        fetched_at: new Date().toISOString(),
      },
      masked_fields: maskedFields,
      latency_ms: Date.now() - start,
      error: errorMessage,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async runApiConnector(
    tenantId: string,
    meta: ConnectorMeta,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const row = await prisma.apiConnector.findFirst({
      where: { id: meta.connectorId, tenant_id: tenantId },
      include: { endpoints: { where: { name: meta.endpointOrQuery }, take: 1 } },
    });
    if (!row || !row.endpoints[0]) throw new Error('API connector or endpoint not found');

    const endpoint = row.endpoints[0];
    const ac = new ApiConnector({
      id: row.id,
      base_url: row.base_url,
      auth_type: row.auth_type,
      auth_config_enc: row.auth_config_enc,
      default_headers: row.default_headers as Record<string, string>,
    });

    const result = await ac.execute(
      {
        name: endpoint.name,
        method: endpoint.method,
        path_template: endpoint.path_template,
        query_params: endpoint.query_params as Record<string, string>,
        body_template: endpoint.body_template as Record<string, unknown> | null,
        timeout_ms: endpoint.timeout_ms,
        retry_count: endpoint.retry_count,
      },
      args
    );

    return result.transformed;
  }

  private async runDbConnector(
    tenantId: string,
    meta: ConnectorMeta,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const row = await prisma.dbConnector.findFirst({
      where: { id: meta.connectorId, tenant_id: tenantId },
      include: { query_templates: { where: { name: meta.endpointOrQuery }, take: 1 } },
    });
    if (!row || !row.query_templates[0]) throw new Error('DB connector or query template not found');

    const template = row.query_templates[0];
    const dc = new DbConnector({
      id: row.id,
      db_type: row.db_type,
      host: row.host,
      port: row.port,
      database_name: row.database_name,
      username_enc: row.username_enc,
      password_enc: row.password_enc,
      ssl_mode: row.ssl_mode,
    });

    const result = await dc.executeTemplate(
      {
        id: template.id,
        name: template.name,
        sql_template: template.sql_template,
        params: template.params as Array<{ name: string; type: string }>,
        timeout_ms: template.timeout_ms,
      },
      args
    );

    return result.transformed;
  }
}
