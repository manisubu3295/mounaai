import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  upsertAutomationWorkflows,
  upsertN8nIntegration,
} from '../src/services/automation.service.js';

const prisma = new PrismaClient();
const callbackSecret = 'pocketcomputer-local-n8n-callback-secret';

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { created_at: 'asc' },
  });

  if (tenants.length === 0) {
    throw new Error('No active tenants found. Create a tenant first, then rerun this script.');
  }

  const results: Array<Record<string, unknown>> = [];

  for (const tenant of tenants) {
    const config = await upsertN8nIntegration(tenant.id, {
      base_url: 'http://127.0.0.1:5678',
      callback_secret: callbackSecret,
      timeout_ms: 15000,
      is_enabled: true,
    });

    const existing = await prisma.automationWorkflow.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { key: 'asc' },
    });

    const workflows = await upsertAutomationWorkflows(tenant.id, {
      workflows: existing.map((workflow) => ({
        key: workflow.key as 'REMINDER_SCHEDULED' | 'DECISION_APPROVED' | 'DECISION_REJECTED' | 'ANALYSIS_RUN_REQUESTED' | 'WEATHER_EMAIL',
        name: workflow.name,
        description: workflow.description,
        webhook_path: workflow.key === 'WEATHER_EMAIL'
          ? '/webhook/pocketcomputer-weather-email'
          : workflow.webhook_path,
        workflow_version: workflow.workflow_version,
        is_enabled: workflow.key === 'WEATHER_EMAIL' ? true : workflow.is_enabled,
        trigger_source: workflow.trigger_source as 'MANUAL' | 'EVENT',
      })),
    });

    results.push({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      n8n_config: config,
      workflows: workflows.map((workflow) => ({
        key: workflow.key,
        webhook_path: workflow.webhook_path,
        is_enabled: workflow.is_enabled,
      })),
    });
  }

  await fs.writeFile(
    path.resolve(process.cwd(), 'scripts', 'local-n8n-config-result.json'),
    JSON.stringify({
      base_url: 'http://127.0.0.1:5678',
      callback_secret: callbackSecret,
      tenants: results,
    }, null, 2),
    'utf8'
  );

  console.log(JSON.stringify({
    base_url: 'http://127.0.0.1:5678',
    callback_secret: callbackSecret,
    tenants: results,
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