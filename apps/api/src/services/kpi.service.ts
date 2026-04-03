import { prisma } from '../lib/prisma.js';
import type { CreateKpiInput, UpdateKpiInput } from '../validation/kpi.schema.js';
import type { KpiDefinition, PaginatedResponse } from '@pocketcomputer/shared-types';

function formatKpi(kpi: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  formula: string;
  unit: string | null;
  target_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  owner_role: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER' | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  created_at: Date;
  updated_at: Date;
}): KpiDefinition {
  return {
    id: kpi.id,
    name: kpi.name,
    slug: kpi.slug,
    description: kpi.description,
    formula: kpi.formula,
    unit: kpi.unit,
    target_value: kpi.target_value,
    warning_threshold: kpi.warning_threshold,
    critical_threshold: kpi.critical_threshold,
    owner_role: kpi.owner_role,
    status: kpi.status,
    created_at: kpi.created_at.toISOString(),
    updated_at: kpi.updated_at.toISOString(),
  };
}

export async function listKpis(tenantId: string, page = 1, limit = 20): Promise<PaginatedResponse<KpiDefinition>> {
  const skip = (page - 1) * limit;
  const [total, items] = await Promise.all([
    prisma.kpiDefinition.count({ where: { tenant_id: tenantId } }),
    prisma.kpiDefinition.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: items.map(formatKpi),
    total,
    page,
    limit,
    has_more: skip + items.length < total,
  };
}

export async function createKpi(tenantId: string, input: CreateKpiInput): Promise<KpiDefinition> {
  const created = await prisma.kpiDefinition.create({
    data: {
      tenant_id: tenantId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      formula: input.formula,
      unit: input.unit ?? null,
      target_value: input.target_value ?? null,
      warning_threshold: input.warning_threshold ?? null,
      critical_threshold: input.critical_threshold ?? null,
      owner_role: input.owner_role ?? null,
      status: input.status,
    },
  });

  return formatKpi(created);
}

export async function updateKpi(
  tenantId: string,
  kpiId: string,
  input: UpdateKpiInput
): Promise<KpiDefinition | null> {
  const existing = await prisma.kpiDefinition.findFirst({
    where: { id: kpiId, tenant_id: tenantId },
  });
  if (!existing) return null;

  const updated = await prisma.kpiDefinition.update({
    where: { id: kpiId },
    data: {
      ...(input.name              !== undefined && { name: input.name }),
      ...(input.slug              !== undefined && { slug: input.slug }),
      ...(input.description       !== undefined && { description: input.description }),
      ...(input.formula           !== undefined && { formula: input.formula }),
      ...(input.unit              !== undefined && { unit: input.unit }),
      ...(input.target_value      !== undefined && { target_value: input.target_value }),
      ...(input.warning_threshold !== undefined && { warning_threshold: input.warning_threshold }),
      ...(input.critical_threshold !== undefined && { critical_threshold: input.critical_threshold }),
      ...(input.owner_role        !== undefined && { owner_role: input.owner_role }),
      ...(input.status            !== undefined && { status: input.status }),
    },
  });

  return formatKpi(updated);
}

export async function deleteKpi(tenantId: string, kpiId: string): Promise<boolean> {
  const existing = await prisma.kpiDefinition.findFirst({
    where: { id: kpiId, tenant_id: tenantId },
  });
  if (!existing) return false;
  await prisma.kpiDefinition.delete({ where: { id: kpiId } });
  return true;
}