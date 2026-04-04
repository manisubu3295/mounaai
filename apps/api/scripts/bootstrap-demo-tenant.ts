import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type DbConnector as DbConnectorRow } from '@prisma/client';
import {
  addApiEndpoint,
  createApiConnector,
  createDbConnector,
  testApiConnector,
  testDbConnector,
  upsertApiMapping,
} from '../src/services/connector.service.js';
import { validateSqlTemplate } from '../src/connectors/sql-validator.js';
import { createRule, listRules, updateRule, type ConditionNode } from '../src/services/rules-engine.service.js';
import { executeAnalysisRun } from '../src/services/analysis-engine.service.js';
import { addFeedback, updateDecisionStatus } from '../src/services/decision.service.js';

const prisma = new PrismaClient();

const DEMO_TENANT_NAME = process.env['DEMO_TENANT_NAME']?.trim() || 'Mouna AI Demo Retail';
const DEMO_TENANT_SLUG = process.env['DEMO_TENANT_SLUG']?.trim() || 'mouna-demo';
const DEMO_ADMIN_NAME = process.env['DEMO_ADMIN_NAME']?.trim() || 'Demo Admin';
const DEMO_ADMIN_EMAIL = process.env['DEMO_ADMIN_EMAIL']?.trim() || 'demo@mounai.local';
const DEMO_ADMIN_PASSWORD = process.env['DEMO_ADMIN_PASSWORD']?.trim() || 'Demo@12345';
const ANALYSIS_RUN_COUNT = Math.max(1, Number(process.env['DEMO_ANALYSIS_RUNS'] || '3'));
const SOURCE_PROVIDER_TENANT_SLUG = process.env['DEMO_SOURCE_TENANT_SLUG']?.trim();

const API_CONNECTOR_NAME = 'DummyJSON Sales';
const API_OVERVIEW_ENDPOINT = 'Sales Product Catalog';
const API_CARTS_ENDPOINT = 'Sales Cart Snapshot';
const DB_CONNECTOR_NAME = 'Demo Sales Warehouse';
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

type RuleSeed = {
  name: string;
  description: string;
  priority: number;
  condition: ConditionNode;
  action_type: 'CREATE_DECISION';
  action_config: {
    title: string;
    recommendation: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  };
};

const RULES: RuleSeed[] = [
  {
    name: 'Last Quarter Revenue Exceeded 1.5M',
    description: 'Raises a high-priority decision when the demo sales warehouse reports more than 1.5M revenue in the last completed quarter.',
    priority: 10,
    condition: {
      type: 'condition',
      field: 'Demo Sales Warehouse.Last Quarter Sales Figures.revenue',
      operator: 'gt',
      value: 1500000,
    },
    action_type: 'CREATE_DECISION',
    action_config: {
      title: 'Scale capacity for strong quarterly demand',
      recommendation: 'Last quarter revenue exceeded 1.5M. Review inventory, staffing, and supply commitments so sales momentum is not constrained next quarter.',
      priority: 'HIGH',
    },
  },
  {
    name: 'Electronics Leading Last Quarter Sales',
    description: 'Creates a medium-priority decision when Electronics is the top category in the last completed quarter.',
    priority: 20,
    condition: {
      type: 'condition',
      field: 'Demo Sales Warehouse.Last Quarter Sales Figures.top_category',
      operator: 'eq',
      value: 'Electronics',
    },
    action_type: 'CREATE_DECISION',
    action_config: {
      title: 'Double down on Electronics growth',
      recommendation: 'Electronics is currently the top-performing category. Increase campaign focus and replenishment planning for high-conversion electronics products.',
      priority: 'MEDIUM',
    },
  },
  {
    name: 'Average Order Value Above 150K',
    description: 'Highlights unusually high order values so pricing and enterprise deal motions can be reviewed.',
    priority: 30,
    condition: {
      type: 'condition',
      field: 'Demo Sales Warehouse.Last Quarter Sales Figures.average_order_value',
      operator: 'gt',
      value: 150000,
    },
    action_type: 'CREATE_DECISION',
    action_config: {
      title: 'Prioritize enterprise-size deals',
      recommendation: 'Average order value is above 150K. Review the recent enterprise deals and replicate the pricing and packaging patterns that drove larger orders.',
      priority: 'MEDIUM',
    },
  },
];

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function parseDatabaseUrl() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to bootstrap the demo tenant.');
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

async function ensureProviders() {
  await prisma.llmProvider.upsert({
    where: { name: 'gemini' },
    update: {},
    create: { name: 'gemini', default_url: 'https://generativelanguage.googleapis.com/v1beta' },
  });
  await prisma.llmProvider.upsert({
    where: { name: 'openai' },
    update: {},
    create: { name: 'openai', default_url: 'https://api.openai.com/v1' },
  });
  await prisma.llmProvider.upsert({
    where: { name: 'custom' },
    update: {},
    create: { name: 'custom', default_url: 'https://your-custom-endpoint.com/v1' },
  });
}

async function ensureDemoTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: { name: DEMO_TENANT_NAME, plan: 'PRO', status: 'ACTIVE' },
    create: { name: DEMO_TENANT_NAME, slug: DEMO_TENANT_SLUG, plan: 'PRO', status: 'ACTIVE' },
  });

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const existingAdmin = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, email: DEMO_ADMIN_EMAIL },
  });

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          full_name: DEMO_ADMIN_NAME,
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
          password_hash: passwordHash,
        },
      })
    : await prisma.user.create({
        data: {
          tenant_id: tenant.id,
          email: DEMO_ADMIN_EMAIL,
          full_name: DEMO_ADMIN_NAME,
          password_hash: passwordHash,
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
        },
      });

  await prisma.notificationPreference.upsert({
    where: { tenant_id: tenant.id },
    update: {
      email_enabled: false,
      email_recipients: [],
      notify_on_critical: true,
      notify_on_warning: true,
      notify_on_rule_trigger: true,
      notify_on_approval_required: true,
      notify_on_connector_error: true,
    },
    create: {
      tenant_id: tenant.id,
      email_enabled: false,
      email_recipients: [],
      notify_on_critical: true,
      notify_on_warning: true,
      notify_on_rule_trigger: true,
      notify_on_approval_required: true,
      notify_on_connector_error: true,
    },
  });

  return { tenant, admin };
}

async function cloneActiveProviderConfig(targetTenantId: string) {
  const sourceConfig = SOURCE_PROVIDER_TENANT_SLUG
    ? await prisma.providerConfig.findFirst({
        where: { is_active: true, tenant: { slug: SOURCE_PROVIDER_TENANT_SLUG } },
        include: { provider: true },
      })
    : await prisma.providerConfig.findFirst({
        where: { is_active: true },
        include: { provider: true },
        orderBy: { updated_at: 'desc' },
      });

  if (!sourceConfig) {
    return null;
  }

  await prisma.providerConfig.updateMany({
    where: { tenant_id: targetTenantId },
    data: { is_active: false },
  });

  return prisma.providerConfig.upsert({
    where: {
      tenant_id_provider_id: {
        tenant_id: targetTenantId,
        provider_id: sourceConfig.provider_id,
      },
    },
    update: {
      api_key_enc: sourceConfig.api_key_enc,
      base_url: sourceConfig.base_url,
      model: sourceConfig.model,
      temperature: sourceConfig.temperature,
      max_tokens: sourceConfig.max_tokens,
      timeout_ms: sourceConfig.timeout_ms,
      is_active: true,
      test_status: sourceConfig.test_status,
      last_tested_at: sourceConfig.last_tested_at,
    },
    create: {
      tenant_id: targetTenantId,
      provider_id: sourceConfig.provider_id,
      api_key_enc: sourceConfig.api_key_enc,
      base_url: sourceConfig.base_url,
      model: sourceConfig.model,
      temperature: sourceConfig.temperature,
      max_tokens: sourceConfig.max_tokens,
      timeout_ms: sourceConfig.timeout_ms,
      is_active: true,
      test_status: sourceConfig.test_status,
      last_tested_at: sourceConfig.last_tested_at,
    },
  });
}

async function ensureApiConnector(tenantId: string, userId: string) {
  let connector = await prisma.apiConnector.findFirst({
    where: { tenant_id: tenantId, name: API_CONNECTOR_NAME },
  });

  if (!connector) {
    connector = await createApiConnector(tenantId, userId, {
      name: API_CONNECTOR_NAME,
      description: 'Public demo sales API powered by DummyJSON for product and cart analytics.',
      base_url: 'https://dummyjson.com',
      auth_type: 'NONE',
      default_headers: { Accept: 'application/json' },
    });
  }

  const ensureEndpoint = async (
    name: string,
    config: {
      description: string;
      method: 'GET' | 'POST' | 'PUT' | 'PATCH';
      path_template: string;
      query_params?: Record<string, string>;
      timeout_ms?: number;
      retry_count?: number;
    }
  ) => {
    const existing = await prisma.apiConnectorEndpoint.findFirst({
      where: { connector_id: connector.id, name },
    });
    if (existing) return existing;
    return addApiEndpoint(tenantId, connector.id, {
      name,
      description: config.description,
      method: config.method,
      path_template: config.path_template,
      query_params: config.query_params,
      timeout_ms: config.timeout_ms ?? 10000,
      retry_count: config.retry_count ?? 1,
    });
  };

  await ensureEndpoint(API_OVERVIEW_ENDPOINT, {
    description: 'Fetch a trimmed product catalog snapshot for sales and inventory analysis.',
    method: 'GET',
    path_template: '/products',
    query_params: { limit: '12', select: 'id,title,category,price,stock,rating,brand' },
  });

  await ensureEndpoint(API_CARTS_ENDPOINT, {
    description: 'Fetch a sample of cart totals to emulate sales checkout activity.',
    method: 'GET',
    path_template: '/carts',
    query_params: { limit: '10' },
  });

  await upsertApiMapping(tenantId, connector.id, [
    {
      source_path: 'products',
      alias: 'sales_products',
      type: 'object',
      include_in_context: true,
      maskable: false,
    },
    {
      source_path: 'total',
      alias: 'sales_product_total',
      type: 'number',
      include_in_context: true,
      maskable: false,
    },
  ]);

  const testResult = await testApiConnector(tenantId, connector.id);
  return { connector, testResult };
}

async function ensureSalesTable() {
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

async function ensureDbConnector(tenantId: string, userId: string): Promise<{ connector: DbConnectorRow; testResult: unknown }> {
  const dbConfig = parseDatabaseUrl();
  let connector = await prisma.dbConnector.findFirst({
    where: { tenant_id: tenantId, name: DB_CONNECTOR_NAME },
  });

  if (!connector) {
    connector = await createDbConnector(tenantId, userId, {
      name: DB_CONNECTOR_NAME,
      db_type: 'POSTGRESQL',
      host: dbConfig.host,
      port: dbConfig.port,
      database_name: dbConfig.databaseName,
      username: dbConfig.username,
      password: dbConfig.password,
      ssl_mode: dbConfig.sslMode,
    });
  }

  const upsertQueryTemplate = async (
    name: string,
    description: string,
    sqlTemplate: string,
    params?: Array<{ name: string; type: 'string' | 'number' | 'boolean'; source: 'user_input' | 'extracted' }>
  ) => {
    const validation = validateSqlTemplate(sqlTemplate);
    if (!validation.valid) {
      throw new Error(`Invalid SQL template for '${name}': ${validation.reason}`);
    }

    const existing = await prisma.dbQueryTemplate.findFirst({
      where: { connector_id: connector.id, name },
    });

    if (existing) {
      return prisma.dbQueryTemplate.update({
        where: { id: existing.id },
        data: {
          description,
          sql_template: sqlTemplate,
          params: (params ?? []) as object[],
          timeout_ms: 5000,
        },
      });
    }

    return prisma.dbQueryTemplate.create({
      data: {
        connector_id: connector.id,
        tenant_id: tenantId,
        name,
        description,
        sql_template: sqlTemplate,
        params: (params ?? []) as object[],
        timeout_ms: 5000,
      },
    });
  };

  const lastQuarterSql = `WITH period AS (
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

  const dateRangeSql = `WITH filtered AS (
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

  await upsertQueryTemplate(
    LAST_QUARTER_TEMPLATE,
    'Returns revenue, order count, units sold, average order value, and top category for the last completed quarter.',
    lastQuarterSql
  );
  await upsertQueryTemplate(
    DATE_RANGE_TEMPLATE,
    'Returns revenue, order count, units sold, average order value, and top category for an inclusive start/end date range.',
    dateRangeSql,
    [
      { name: 'start_date', type: 'string', source: 'user_input' },
      { name: 'end_date', type: 'string', source: 'user_input' },
    ]
  );

  const testResult = await testDbConnector(tenantId, connector.id);
  return { connector, testResult };
}

async function ensureKpis(tenantId: string) {
  const kpis = [
    {
      slug: 'quarterly-revenue',
      name: 'Quarterly Revenue',
      description: 'Target for last completed quarter revenue.',
      formula: 'Demo Sales Warehouse.Last Quarter Sales Figures.revenue',
      unit: 'INR',
      target_value: 1500000,
      warning_threshold: 1200000,
      critical_threshold: 900000,
    },
    {
      slug: 'average-order-value',
      name: 'Average Order Value',
      description: 'Tracks whether deal sizes remain in the enterprise range.',
      formula: 'Demo Sales Warehouse.Last Quarter Sales Figures.average_order_value',
      unit: 'INR',
      target_value: 150000,
      warning_threshold: 110000,
      critical_threshold: 80000,
    },
    {
      slug: 'quarterly-order-count',
      name: 'Quarterly Order Count',
      description: 'Measures whether order throughput stays healthy across the quarter.',
      formula: 'Demo Sales Warehouse.Last Quarter Sales Figures.order_count',
      unit: 'orders',
      target_value: 8,
      warning_threshold: 6,
      critical_threshold: 4,
    },
  ];

  for (const kpi of kpis) {
    const existing = await prisma.kpiDefinition.findFirst({
      where: { tenant_id: tenantId, slug: kpi.slug },
    });

    if (existing) {
      await prisma.kpiDefinition.update({
        where: { id: existing.id },
        data: { ...kpi, owner_role: 'TENANT_ADMIN', status: 'ACTIVE' },
      });
    } else {
      await prisma.kpiDefinition.create({
        data: { tenant_id: tenantId, ...kpi, owner_role: 'TENANT_ADMIN', status: 'ACTIVE' },
      });
    }
  }
}

async function ensureRules(tenantId: string) {
  const existingRules = await listRules(tenantId);
  for (const rule of RULES) {
    const existing = existingRules.find((entry) => entry.name === rule.name);
    if (existing) {
      await updateRule(tenantId, existing.id, {
        description: rule.description,
        priority: rule.priority,
        is_active: true,
        condition: rule.condition,
        action_type: rule.action_type,
        action_config: rule.action_config,
      });
    } else {
      await createRule(tenantId, {
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        is_active: true,
        condition: rule.condition,
        action_type: rule.action_type,
        action_config: rule.action_config,
      });
    }
  }
}

async function resetAnalysisData(tenantId: string) {
  const runs = await prisma.analysisRun.findMany({
    where: { tenant_id: tenantId },
    select: { id: true },
  });

  if (runs.length > 0) {
    const runIds = runs.map((run) => run.id);
    await prisma.notification.deleteMany({
      where: { tenant_id: tenantId, resource_type: 'analysis_run', resource_id: { in: runIds } },
    });
  }

  await prisma.analysisRun.deleteMany({ where: { tenant_id: tenantId } });
}

async function createAnalysisStory(tenantId: string, adminUserId: string) {
  const runIds: string[] = [];

  for (let index = 0; index < ANALYSIS_RUN_COUNT; index++) {
    const run = await prisma.analysisRun.create({
      data: {
        tenant_id: tenantId,
        initiated_by_user_id: adminUserId,
        status: 'QUEUED',
        summary: { seeded_by: 'bootstrap-demo-tenant', cycle: index + 1 },
      },
      select: { id: true },
    });

    await executeAnalysisRun(tenantId, run.id);
    runIds.push(run.id);
  }

  const decisions = await prisma.decisionPoint.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ created_at: 'desc' }],
    take: 3,
  });

  if (decisions[0]) {
    await addFeedback(tenantId, decisions[0].id, 'Approved during demo bootstrap because this is the strongest revenue signal in the demo data.');
    await updateDecisionStatus(tenantId, decisions[0].id, adminUserId, 'APPROVED');
  }
  if (decisions[1]) {
    await addFeedback(tenantId, decisions[1].id, 'Rejected during demo bootstrap to demonstrate that stakeholder notes appear in the analysis detail view.');
    await updateDecisionStatus(tenantId, decisions[1].id, adminUserId, 'REJECTED');
  }

  return runIds;
}

async function main() {
  await ensureProviders();

  const { tenant, admin } = await ensureDemoTenant();
  const providerConfig = await cloneActiveProviderConfig(tenant.id);

  const { connector: apiConnector, testResult: apiTest } = await ensureApiConnector(tenant.id, admin.id);
  await ensureSalesTable();
  const { connector: dbConnector, testResult: dbTest } = await ensureDbConnector(tenant.id, admin.id);
  await ensureKpis(tenant.id);
  await ensureRules(tenant.id);
  await resetAnalysisData(tenant.id);

  let runIds: string[] = [];
  let analysisSkippedReason: string | null = null;

  if (providerConfig) {
    runIds = await createAnalysisStory(tenant.id, admin.id);
  } else {
    analysisSkippedReason = 'No active provider config was available to clone into the demo tenant.';
  }

  const summary = await prisma.analysisRun.findMany({
    where: { tenant_id: tenant.id },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: { id: true, status: true, summary: true, created_at: true },
  });

  const counts = {
    insights: await prisma.generatedInsight.count({ where: { tenant_id: tenant.id } }),
    decisions: await prisma.decisionPoint.count({ where: { tenant_id: tenant.id } }),
    approved_decisions: await prisma.decisionPoint.count({ where: { tenant_id: tenant.id, status: 'APPROVED' } }),
    rejected_decisions: await prisma.decisionPoint.count({ where: { tenant_id: tenant.id, status: 'REJECTED' } }),
  };

  console.log(JSON.stringify({
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
    admin: { email: admin.email, password: DEMO_ADMIN_PASSWORD },
    provider_config_cloned: providerConfig ? { provider_id: providerConfig.provider_id, model: providerConfig.model } : null,
    api_connector: { id: apiConnector.id, name: apiConnector.name, test_result: apiTest },
    db_connector: { id: dbConnector.id, name: dbConnector.name, test_result: dbTest },
    analysis_runs_created: runIds,
    analysis_skipped_reason: analysisSkippedReason,
    counts,
    recent_runs: summary,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });