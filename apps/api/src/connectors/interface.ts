export interface ConnectorTestResult {
  ok: boolean;
  message?: string;
  tables?: string[];
}

export interface ConnectorExecutionResult {
  raw: unknown;
  transformed: Record<string, unknown>;
  connector_id: string;
  endpoint_name?: string;
  latency_ms: number;
}

export interface IConnector {
  type: 'API' | 'DB';
  test(): Promise<ConnectorTestResult>;
}
