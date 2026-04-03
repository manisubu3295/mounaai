import { prisma } from '../lib/prisma.js';
import { PlanGateError } from '../types/errors.js';
import { PlanTier } from '@pocketcomputer/shared-types';

interface PlanFeatures {
  max_users: number | null;
  max_connectors: number | null;
  change_llm_provider: boolean;
  unlimited_history: boolean;
  advanced_masking: boolean;
}

const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  FREE: {
    max_users: 1,
    max_connectors: 1,
    change_llm_provider: false,
    unlimited_history: false,
    advanced_masking: false,
  },
  PRO: {
    max_users: 10,
    max_connectors: null,
    change_llm_provider: true,
    unlimited_history: true,
    advanced_masking: true,
  },
  ENTERPRISE: {
    max_users: null,
    max_connectors: null,
    change_llm_provider: true,
    unlimited_history: true,
    advanced_masking: true,
  },
};

export async function assertConnectorLimit(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const features = PLAN_FEATURES[tenant.plan as PlanTier];

  if (features.max_connectors === null) return;

  const [apiCount, dbCount] = await Promise.all([
    prisma.apiConnector.count({ where: { tenant_id: tenantId, status: 'ACTIVE' } }),
    prisma.dbConnector.count({ where: { tenant_id: tenantId, status: 'ACTIVE' } }),
  ]);

  if (apiCount + dbCount >= features.max_connectors) {
    throw new PlanGateError('MULTIPLE_CONNECTORS');
  }
}

export async function assertCanChangeLlmProvider(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (!PLAN_FEATURES[tenant.plan as PlanTier].change_llm_provider) {
    throw new PlanGateError('CUSTOM_LLM_PROVIDER');
  }
}

export function getPlanFeatures(plan: PlanTier): PlanFeatures {
  return PLAN_FEATURES[plan];
}
