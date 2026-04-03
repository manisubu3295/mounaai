import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { createRule, updateRule, listRules, type ConditionNode } from '../src/services/rules-engine.service.js';

const prisma = new PrismaClient();

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
    const connector = await prisma.dbConnector.findFirst({
      where: { tenant_id: tenant.id, name: 'Demo Sales Warehouse', status: 'ACTIVE' },
    });

    if (!connector) {
      results.push({
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        skipped: true,
        reason: 'Demo Sales Warehouse connector not found. Run configure:sales-warehouse first.',
      });
      continue;
    }

    const existingRules = await listRules(tenant.id);
    const upsertedNames: string[] = [];

    for (const seed of RULES) {
      const existing = existingRules.find((rule) => rule.name === seed.name);
      if (existing) {
        await updateRule(tenant.id, existing.id, {
          description: seed.description,
          priority: seed.priority,
          is_active: true,
          condition: seed.condition,
          action_type: seed.action_type,
          action_config: seed.action_config,
        });
      } else {
        await createRule(tenant.id, {
          name: seed.name,
          description: seed.description,
          priority: seed.priority,
          is_active: true,
          condition: seed.condition,
          action_type: seed.action_type,
          action_config: seed.action_config,
        });
      }
      upsertedNames.push(seed.name);
    }

    results.push({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
      connector: { id: connector.id, name: connector.name },
      rules_upserted: upsertedNames,
    });
  }

  await fs.writeFile(
    path.resolve(process.cwd(), 'scripts', 'business-rules-result.json'),
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