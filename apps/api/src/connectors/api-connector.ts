import axios from 'axios';
import { IConnector, ConnectorTestResult, ConnectorExecutionResult } from './interface.js';
import { ConnectorError, SecurityError } from '../types/errors.js';
import { decrypt } from '../crypto/crypto.service.js';

interface ApiConnectorConfig {
  id: string;
  base_url: string;
  auth_type: string;
  auth_config_enc: string | null;
  default_headers: Record<string, string>;
}

interface EndpointConfig {
  name: string;
  method: string;
  path_template: string;
  query_params: Record<string, string>;
  body_template: Record<string, unknown> | null;
  timeout_ms: number;
  retry_count: number;
}

const SSRF_BLOCKED = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /localhost/i,
  /metadata\.google\.internal/i,
];

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function validateOutboundUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SecurityError('Invalid connector URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new SecurityError('Connector URL must use http or https');
  }

  if (parsed.username || parsed.password) {
    throw new SecurityError('Connector URL must not embed credentials');
  }

  for (const pattern of SSRF_BLOCKED) {
    if (pattern.test(parsed.hostname)) {
      throw new SecurityError('Connector URL targets a restricted address');
    }
  }
}

export function validateEndpointPathTemplate(baseUrl: string, pathTemplate: string): void {
  if (!pathTemplate.startsWith('/')) {
    throw new SecurityError('Endpoint path must start with /');
  }

  const normalizedTemplate = pathTemplate.replace(/\{\{\w+\}\}/g, 'placeholder');
  const base = new URL(baseUrl);
  const resolved = new URL(normalizedTemplate, base);

  if (resolved.origin !== base.origin) {
    throw new SecurityError('Endpoint path must remain within the connector base URL');
  }

  validateOutboundUrl(resolved.toString());
}

function resolveTemplate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = params[key as string];
    return val !== undefined ? String(val) : `{{${key as string}}}`;
  });
}

function resolveObjectTemplate(
  obj: Record<string, unknown>,
  params: Record<string, unknown>
): Record<string, unknown> {
  return JSON.parse(resolveTemplate(JSON.stringify(obj), params)) as Record<string, unknown>;
}

export class ApiConnector implements IConnector {
  type = 'API' as const;

  constructor(private config: ApiConnectorConfig) {}

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.auth_config_enc) return {};

    let authConfig: Record<string, string>;
    try {
      authConfig = JSON.parse(decrypt(this.config.auth_config_enc)) as Record<string, string>;
    } catch {
      return {};
    }

    switch (this.config.auth_type) {
      case 'BEARER':
        return { Authorization: `Bearer ${authConfig['token'] ?? ''}` };
      case 'API_KEY': {
        const headerName = authConfig['header_name'] ?? 'X-API-Key';
        return { [headerName]: authConfig['api_key'] ?? '' };
      }
      case 'BASIC': {
        const encoded = Buffer.from(`${authConfig['username'] ?? ''}:${authConfig['password'] ?? ''}`).toString('base64');
        return { Authorization: `Basic ${encoded}` };
      }
      default:
        return {};
    }
  }

  async test(): Promise<ConnectorTestResult> {
    try {
      validateOutboundUrl(this.config.base_url);
      await axios.get(this.config.base_url, {
        headers: { ...this.config.default_headers, ...this.getAuthHeaders() },
        timeout: 5000,
        validateStatus: (s) => s < 500,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  async execute(
    endpoint: EndpointConfig,
    params: Record<string, unknown>
  ): Promise<ConnectorExecutionResult> {
    const start = Date.now();
    const resolvedPath = resolveTemplate(endpoint.path_template, params);
    const url = `${this.config.base_url.replace(/\/$/, '')}${resolvedPath}`;

    validateOutboundUrl(url);

    const headers = {
      'Content-Type': 'application/json',
      ...this.config.default_headers,
      ...this.getAuthHeaders(),
    };

    const resolvedQuery = resolveObjectTemplate(endpoint.query_params, params);
    const body = endpoint.body_template
      ? resolveObjectTemplate(endpoint.body_template, params)
      : undefined;

    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= endpoint.retry_count; attempt++) {
      try {
        const response = await axios.request({
          method: endpoint.method,
          url,
          headers,
          params: resolvedQuery,
          data: body,
          timeout: endpoint.timeout_ms,
        });

        return {
          raw: response.data,
          transformed: response.data as Record<string, unknown>,
          connector_id: this.config.id,
          endpoint_name: endpoint.name,
          latency_ms: Date.now() - start,
        };
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (axios.isAxiosError(err) && err.response && err.response.status < 500) break;
        if (attempt < endpoint.retry_count) await sleep(500 * Math.pow(2, attempt));
      }
    }

    throw new ConnectorError(
      `API connector '${endpoint.name}' failed: ${lastErr?.message ?? 'Unknown error'}`,
      'CONNECTOR_EXEC_FAILED',
      true
    );
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
