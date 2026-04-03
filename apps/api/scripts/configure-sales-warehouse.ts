import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient, type DbConnector as DbConnectorRow } from '@prisma/client';
import {
  createDbConnector,
  testDbConnector,
} from '../src/services/connector.service.js';
import { validateSqlTemplate } from '../src/connectors/sql-validator.js';

const prisma = new PrismaClient();

const CONNECTOR_NAME = 'Demo Sales Warehouse';
const LAST_QUARTER_TEMPLATE = 'Last Quarter Sales Figures';
const DATE_RANGE_TEMPLATE = 'Sales Figures Between Dates';

const SALES_ROWS = [
  ['SO-2025-1001', '2025-10-08', 'Aster Retail', 'Smart Display', 'Electronics', 'South', 4, 45000, 3000, 177000],
  ['SO-2025-1002', '2025-10-22', 'BlueCart', 'POS Tablet', 'Electronics', 'West', 6, 18000, 1200, 106800],
  ['SO-2025-1003', '2025-11-05', 'Clover Stores', 'Barcode Scanner', 'Accessories', 'North', 10, 6500, 500, 64500],
  ['SO-2025-1004', '2025-11-19', 'Delta Mart', 'Receipt Printer', 'Accessories', 'East', 5, 12000, 750, 59250],
  ['SO-2025-1005', '2025-12-03', 'Evergreen Foods', 'Inventory Beacon', 'IoT', 'South', 8, 9400, 400, 74800],
  ['SO-2025-1006', '2025-12-21', 'Fresh Basket', 'Shelf Sensor', 'IoT', 'West', 12, 5200, 624, 61776],
  ['SO-2026-2001', '2026-01-07', 'Giga Retail', 'Smart Display', 'Electronics', 'South', 7, 46000, 2300, 319700],
  ['SO-2026-2002', '2026-01-18', 'Harbor Hyper', 'POS Tablet', 'Electronics', 'North', 9, 18200, 1800, 162000],
  ['SO-2026-2003', '2026-01-27', 'Indigo Bazaar', 'Inventory Beacon', 'IoT', 'East', 15, 9500, 1425, 141075],
  ['SO-2026-2004', '2026-02-04', 'Jade Superstore', 'Receipt Printer', 'Accessories', 'West', 11, 12100, 1331, 131769],
  ['SO-2026-2005', '2026-02-14', 'Kite Market', 'Shelf Sensor', 'IoT', 'South', 20, 5300, 2120, 103880],
  ['SO-2026-2006', '2026-02-22', 'Lotus Grocers', 'Barcode Scanner', 'Accessories', 'North', 14, 6600, 924, 91476],
  ['SO-2026-2007', '2026-03-03', 'Metro Retail', 'Smart Kiosk', 'Electronics', 'East', 3, 88000, 2640, 261360],
  ['SO-2026-2008', '2026-03-12', 'Nova Stores', 'POS Tablet', 'Electronics', 'South', 10, 18400, 1840, 182160],
  ['SO-2026-2009', '2026-03-19', 'Orbit Mart', 'Inventory Beacon', 'IoT', 'West', 18, 9600, 1728, 171072],
  ['SO-2026-2010', '2026-03-28', 'Prime Retail', 'Support Subscription', 'Services', 'North', 25, 3200, 800, 79200],
];

function parseDatabaseUrl() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to configure the demo sales warehouse.');
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const sslModeParam = parsed.searchParams.get('sslmode')?.toUpperCase();

  if (!databaseName || !username || !password) {
    throw new Error('DATABASE_URL must include database name, username, and password.');
  }

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    databaseName,
    username,
    password,
    sslMode: (sslModeParam === 'DISABLE' ? 'DISABLE' : (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') ? 'DISABLE' : 'REQUIRE') as 'DISABLE' | 'REQUIRE',
  };
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function ensureSalesTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS demo_sales_orders (
      id BIGSERIAL PRIMARY KEY,
      external_order_id TEXT NOT NULL UNIQUE,
      order_date DATE NOT NULL,
      customer_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      region TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      net_sales NUMERIC(12, 2) NOT NULL CHECK (net_sales >= 0)
    )
  `);

  for (const row of SALES_ROWS) {
    const [externalOrderId, orderDate, customerName, productName, category, region, quantity, unitPrice, discountAmount, netSales] = row;

    await prisma.$executeRawUnsafe(`
      INSERT INTO demo_sales_orders (
        external_order_id,
        order_date,
        customer_name,
        product_name,
        category,
        region,
        quantity,
        unit_price,
        discount_amount,
        net_sales
      ) VALUES (
        ${quote(String(externalOrderId))},
        ${quote(String(orderDate))},
        ${quote(String(customerName))},
        ${quote(String(productName))},
        ${quote(String(category))},
        ${quote(String(region))},
        ${Number(quantity)},
        ${Number(unitPrice)},
        ${Number(discountAmount)},
        ${Number(netSales)}
      )
      ON CONFLICT (external_order_id) DO NOTHING
    `);
  }
}

async function ensureDbConnector(tenantId: string, userId: string): Promise<DbConnectorRow> {
  const dbConfig = parseDatabaseUrl();

  const existing = await prisma.dbConnector.findFirst({
    where: { tenant_id: tenantId, name: CONNECTOR_NAME },
  });

  if (existing) {
    return existing;
  }

  return createDbConnector(tenantId, userId, {
    name: CONNECTOR_NAME,
    db_type: 'POSTGRESQL',
    host: dbConfig.host,
    port: dbConfig.port,
    database_name: dbConfig.databaseName,
    username: dbConfig.username,
    password: dbConfig.password,
    ssl_mode: dbConfig.sslMode,
  });
}

async function upsertQueryTemplate(
  tenantId: string,
  connectorId: string,
  input: {
    name: string;
    description: string;
    sql_template: string;
    params?: Array<{ name: string; type: 'string' | 'number' | 'boolean'; source: 'user_input' | 'extracted' }>;
    timeout_ms?: number;
  }
) {
  const validation = validateSqlTemplate(input.sql_template);
  if (!validation.valid) {
    throw new Error(`Invalid SQL template for '${input.name}': ${validation.reason}`);
  }

  const existing = await prisma.dbQueryTemplate.findFirst({
    where: { connector_id: connectorId, name: input.name },
  });

  if (existing) {
    return prisma.dbQueryTemplate.update({
      where: { id: existing.id },
      data: {
        description: input.description,
        sql_template: input.sql_template,
        params: (input.params ?? []) as object[],
        timeout_ms: input.timeout_ms ?? 5000,
      },
    });
  }

  return prisma.dbQueryTemplate.create({
    data: {
      connector_id: connectorId,
      tenant_id: tenantId,
      name: input.name,
      description: input.description,
      sql_template: input.sql_template,
      params: (input.params ?? []) as object[],
      timeout_ms: input.timeout_ms ?? 5000,
    },
  });
}

function lastQuarterSql(): string {
  return `WITH period AS (
  SELECT
    (date_trunc('quarter', CURRENT_DATE) - interval '3 months')::date AS start_date,
    date_trunc('quarter', CURRENT_DATE)::date AS end_date
),
filtered AS (
  SELECT s.*
  FROM demo_sales_orders s
  CROSS JOIN period p
  WHERE s.order_date >= p.start_date
    AND s.order_date < p.end_date
),
top_category AS (
  SELECT category
  FROM filtered
  GROUP BY category
  ORDER BY SUM(net_sales) DESC
  LIMIT 1
)
SELECT
  to_char((SELECT start_date FROM period), 'YYYY-MM-DD') AS period_start,
  to_char(((SELECT end_date FROM period) - interval '1 day')::date, 'YYYY-MM-DD') AS period_end,
  COALESCE(ROUND(SUM(net_sales)::numeric, 2), 0) AS revenue,
  COUNT(*)::int AS order_count,
  COALESCE(SUM(quantity), 0)::int AS units_sold,
  COALESCE(ROUND(AVG(net_sales)::numeric, 2), 0) AS average_order_value,
  COALESCE((SELECT category FROM top_category), 'N/A') AS top_category
FROM filtered`;
}

function dateRangeSql(): string {
  return `WITH filtered AS (
  SELECT *
  FROM demo_sales_orders
  WHERE order_date >= $1::date
    AND order_date < ($2::date + interval '1 day')
),
top_category AS (
  SELECT category
  FROM filtered
  GROUP BY category
  ORDER BY SUM(net_sales) DESC
  LIMIT 1
)
SELECT
  $1::date AS period_start,
  $2::date AS period_end,
  COALESCE(ROUND(SUM(net_sales)::numeric, 2), 0) AS revenue,
  COUNT(*)::int AS order_count,
  COALESCE(SUM(quantity), 0)::int AS units_sold,
  COALESCE(ROUND(AVG(net_sales)::numeric, 2), 0) AS average_order_value,
  COALESCE((SELECT category FROM top_category), 'N/A') AS top_category
FROM filtered`;
}

async function main() {
  const targetTenantSlug = process.env['TARGET_TENANT_SLUG']?.trim();
  const tenants = await prisma.tenant.findMany({
    where: {
      status: 'ACTIVE',
      ...(targetTenantSlug ? { slug: targetTenantSlug } : {}),
    },
    orderBy: { created_at: 'asc' },
  });

  if (tenants.length === 0) {
    throw new Error(targetTenantSlug
      ? `No active tenant found for slug '${targetTenantSlug}'.`
      : 'No active tenant found. Register in the app first, then rerun this script.');
  }

  await ensureSalesTable();

  const results: Array<Record<string, unknown>> = [];

  for (const tenant of tenants) {
    const adminUser = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
      orderBy: { created_at: 'asc' },
    });

    if (!adminUser) {
      results.push({
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
        skipped: true,
        reason: 'No active tenant admin found',
      });
      continue;
    }

    const connector = await ensureDbConnector(tenant.id, adminUser.id);

    await upsertQueryTemplate(tenant.id, connector.id, {
      name: LAST_QUARTER_TEMPLATE,
      description: 'Returns revenue, order count, units sold, average order value, and top category for the last completed quarter.',
      sql_template: lastQuarterSql(),
    });

    await upsertQueryTemplate(tenant.id, connector.id, {
      name: DATE_RANGE_TEMPLATE,
      description: 'Returns revenue, order count, units sold, average order value, and top category for an inclusive start/end date range.',
      sql_template: dateRangeSql(),
      params: [
        { name: 'start_date', type: 'string', source: 'user_input' },
        { name: 'end_date', type: 'string', source: 'user_input' },
      ],
    });

    const testResult = await testDbConnector(tenant.id, connector.id);

    results.push({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
      admin_user: { id: adminUser.id, email: adminUser.email },
      connector: {
        id: connector.id,
        name: connector.name,
        database_name: connector.database_name,
        host: connector.host,
        port: connector.port,
      },
      query_templates: [LAST_QUARTER_TEMPLATE, DATE_RANGE_TEMPLATE],
      seeded_orders: SALES_ROWS.length,
      test_result: testResult,
    });
  }

  await fs.writeFile(
    path.resolve(process.cwd(), 'scripts', 'sales-warehouse-result.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });