import { Pool as PgPool } from 'pg';
import { IConnector, ConnectorTestResult, ConnectorExecutionResult } from './interface.js';
import { ConnectorError } from '../types/errors.js';
import { decrypt } from '../crypto/crypto.service.js';

interface DbConnectorConfig {
  id: string;
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  username_enc: string;
  password_enc: string;
  ssl_mode: string;
}

interface QueryTemplateConfig {
  id: string;
  name: string;
  sql_template: string;
  params: Array<{ name: string; type: string }>;
  timeout_ms: number;
}

const pools = new Map<string, PgPool>();

export class DbConnector implements IConnector {
  type = 'DB' as const;

  private pool: PgPool;

  constructor(private config: DbConnectorConfig) {
    this.pool = this.getOrCreatePool();
  }

  private getOrCreatePool(): PgPool {
    const existing = pools.get(this.config.id);
    if (existing) return existing;

    const username = decrypt(this.config.username_enc);
    const password = decrypt(this.config.password_enc);

    const ssl =
      this.config.ssl_mode === 'DISABLE'
        ? false
        : this.config.ssl_mode === 'REQUIRE'
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true };

    const pool = new PgPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database_name,
      user: username,
      password,
      ssl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pools.set(this.config.id, pool);
    return pool;
  }

  static closePool(connectorId: string): void {
    const pool = pools.get(connectorId);
    if (pool) {
      void pool.end();
      pools.delete(connectorId);
    }
  }

  async test(): Promise<ConnectorTestResult> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        const tablesResult = await client.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
        );
        return { ok: true, tables: tablesResult.rows.map((r) => r.table_name) };
      } finally {
        client.release();
      }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message.replace(/password=[^\s]*/g, '***') : 'Connection failed',
      };
    }
  }

  async discoverSchema(): Promise<Array<{ name: string; columns: Array<{ name: string; type: string }> }>> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ table_name: string; column_name: string; data_type: string }>(
        `SELECT table_name, column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, ordinal_position`
      );

      const tables = new Map<string, Array<{ name: string; type: string }>>();
      for (const row of result.rows) {
        if (!tables.has(row.table_name)) tables.set(row.table_name, []);
        tables.get(row.table_name)!.push({ name: row.column_name, type: row.data_type });
      }

      return Array.from(tables.entries()).map(([name, columns]) => ({ name, columns }));
    } finally {
      client.release();
    }
  }

  async executeTemplate(
    template: QueryTemplateConfig,
    paramValues: Record<string, unknown>
  ): Promise<ConnectorExecutionResult> {
    const start = Date.now();
    const values = template.params.map((p) => paramValues[p.name] ?? null);

    const client = await this.pool.connect();
    try {
      const result = await client.query<Record<string, unknown>>(template.sql_template, values);

      return {
        raw: result.rows,
        transformed: { rows: result.rows, row_count: result.rowCount ?? 0 } as Record<string, unknown>,
        connector_id: this.config.id,
        endpoint_name: template.name,
        latency_ms: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query failed';
      throw new ConnectorError(`DB query '${template.name}' failed: ${msg}`, 'CONNECTOR_EXEC_FAILED');
    } finally {
      client.release();
    }
  }
}
