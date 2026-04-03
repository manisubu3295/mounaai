import { apiClient } from '@/lib/api-client';
import type { KpiDefinition, KpiStatus, PaginatedResponse } from '@pocketcomputer/shared-types';

export type { KpiDefinition, KpiStatus };

export interface CreateKpiInput {
  name: string;
  slug: string;
  description?: string;
  formula: string;
  unit?: string;
  target_value?: number | null;
  warning_threshold?: number | null;
  critical_threshold?: number | null;
  owner_role?: 'TENANT_ADMIN' | 'ANALYST' | 'VIEWER' | null;
  status: KpiStatus;
}

export type UpdateKpiInput = Partial<CreateKpiInput>;

export async function listKpis(page = 1, limit = 50): Promise<PaginatedResponse<KpiDefinition>> {
  const res = await apiClient.get<{ data: PaginatedResponse<KpiDefinition> }>('/kpis', {
    params: { page, limit },
  });
  return res.data.data;
}

export async function createKpi(input: CreateKpiInput): Promise<KpiDefinition> {
  const res = await apiClient.post<{ data: { kpi: KpiDefinition } }>('/kpis', input);
  return res.data.data.kpi;
}

export async function updateKpi(id: string, input: UpdateKpiInput): Promise<KpiDefinition> {
  const res = await apiClient.put<{ data: { kpi: KpiDefinition } }>(`/kpis/${id}`, input);
  return res.data.data.kpi;
}

export async function deleteKpi(id: string): Promise<void> {
  await apiClient.delete(`/kpis/${id}`);
}
