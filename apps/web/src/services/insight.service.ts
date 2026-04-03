import { apiClient } from '@/lib/api-client';
import type { Insight, PaginatedResponse } from '@pocketcomputer/shared-types';

export async function listInsights(
  page = 1,
  limit = 20,
  filters?: { severity?: 'INFO' | 'WARNING' | 'CRITICAL'; type?: 'RISK' | 'OPPORTUNITY' | 'INEFFICIENCY' | 'WATCH' }
): Promise<PaginatedResponse<Insight>> {
  const res = await apiClient.get<{ data: PaginatedResponse<Insight> }>('/insights', {
    params: { page, limit, ...filters },
  });
  return res.data.data;
}