import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  addApiEndpoint,
  createApiConnector,
  testApiConnector,
  upsertApiMapping,
} from '../src/services/connector.service.js';

const prisma = new PrismaClient();

const CONNECTOR_NAME = 'DummyJSON Sales';
const SALES_OVERVIEW_ENDPOINT = 'Sales Product Catalog';
const CARTS_ENDPOINT = 'Sales Cart Snapshot';

async function ensureEndpoint(
  tenantId: string,
  connectorId: string,
  name: string,
  config: {
    description: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    path_template: string;
    query_params?: Record<string, string>;
    timeout_ms?: number;
    retry_count?: number;
  }
) {
  const existing = await prisma.apiConnectorEndpoint.findFirst({
    where: { connector_id: connectorId, name },
  });

  if (existing) {
    return existing;
  }

  return addApiEndpoint(tenantId, connectorId, {
    name,
    description: config.description,
    method: config.method,
    path_template: config.path_template,
    query_params: config.query_params,
    timeout_ms: config.timeout_ms ?? 10000,
    retry_count: config.retry_count ?? 1,
  });
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

    let connector = await prisma.apiConnector.findFirst({
      where: { tenant_id: tenant.id, name: CONNECTOR_NAME },
    });

    if (!connector) {
      connector = await createApiConnector(tenant.id, adminUser.id, {
        name: CONNECTOR_NAME,
        description: 'Public demo sales API powered by DummyJSON for product and cart analytics.',
        base_url: 'https://dummyjson.com',
        auth_type: 'NONE',
        default_headers: {
          Accept: 'application/json',
        },
      });
    }

    await ensureEndpoint(tenant.id, connector.id, SALES_OVERVIEW_ENDPOINT, {
      description: 'Fetch a trimmed product catalog snapshot for sales and inventory analysis.',
      method: 'GET',
      path_template: '/products',
      query_params: {
        limit: '12',
        select: 'id,title,category,price,stock,rating,brand',
      },
    });

    await ensureEndpoint(tenant.id, connector.id, CARTS_ENDPOINT, {
      description: 'Fetch a sample of cart totals to emulate sales checkout activity.',
      method: 'GET',
      path_template: '/carts',
      query_params: {
        limit: '10',
      },
    });

    await upsertApiMapping(tenant.id, connector.id, [
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
      {
        source_path: 'limit',
        alias: 'sales_product_limit',
        type: 'number',
        include_in_context: false,
        maskable: false,
      },
    ]);

    const testResult = await testApiConnector(tenant.id, connector.id);

    results.push({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
      admin_user: {
        id: adminUser.id,
        email: adminUser.email,
      },
      connector: {
        id: connector.id,
        name: connector.name,
        base_url: connector.base_url,
      },
      endpoints: [SALES_OVERVIEW_ENDPOINT, CARTS_ENDPOINT],
      test_result: testResult,
    });
  }

  await fs.writeFile(
    path.resolve(process.cwd(), 'scripts', 'sales-api-result.json'),
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