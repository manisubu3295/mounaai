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

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { created_at: 'asc' },
  });

  if (tenants.length === 0) {
    throw new Error('No active tenant found. Register in the app first, then rerun this script.');
  }

  const results: Array<Record<string, unknown>> = [];

  for (const tenant of tenants) {
    const adminUser = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: 'TENANT_ADMIN', status: 'ACTIVE' },
      orderBy: { created_at: 'asc' },
    });

    if (!adminUser) {
      results.push({
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        skipped: true,
        reason: 'No active tenant admin found',
      });
      continue;
    }

    let connector = await prisma.apiConnector.findFirst({
      where: { tenant_id: tenant.id, name: 'Open-Meteo Weather' },
    });

    if (!connector) {
      connector = await createApiConnector(tenant.id, adminUser.id, {
        name: 'Open-Meteo Weather',
        description: 'Public outsourced weather API for testing external connector execution.',
        base_url: 'https://api.open-meteo.com',
        auth_type: 'NONE',
        default_headers: {
          Accept: 'application/json',
        },
      });
    }

    const existingEndpoint = await prisma.apiConnectorEndpoint.findFirst({
      where: { connector_id: connector.id, name: 'Current Weather Chennai' },
    });

    if (!existingEndpoint) {
      await addApiEndpoint(tenant.id, connector.id, {
        name: 'Current Weather Chennai',
        description: 'Fetch the current weather for Chennai using Open-Meteo.',
        method: 'GET',
        path_template: '/v1/forecast',
        query_params: {
          latitude: '13.0827',
          longitude: '80.2707',
          current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
          timezone: 'auto',
        },
        timeout_ms: 10000,
        retry_count: 1,
      });
    }

    await upsertApiMapping(tenant.id, connector.id, [
      {
        source_path: 'current.temperature_2m',
        alias: 'current_temperature_c',
        type: 'number',
        include_in_context: true,
        maskable: false,
      },
      {
        source_path: 'current.relative_humidity_2m',
        alias: 'current_humidity_percent',
        type: 'number',
        include_in_context: true,
        maskable: false,
      },
      {
        source_path: 'current.wind_speed_10m',
        alias: 'current_wind_speed_kmh',
        type: 'number',
        include_in_context: true,
        maskable: false,
      },
      {
        source_path: 'current.weather_code',
        alias: 'weather_code',
        type: 'number',
        include_in_context: true,
        maskable: false,
      },
    ]);

    const testResult = await testApiConnector(tenant.id, connector.id);

    results.push({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
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
      endpoint_name: 'Current Weather Chennai',
      test_result: testResult,
    });
  }

  await fs.writeFile(
    path.resolve(process.cwd(), 'scripts', 'public-api-result.json'),
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