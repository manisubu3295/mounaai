import { apiClient } from '@/lib/api-client';
import type { DecisionPoint, PaginatedResponse } from '@pocketcomputer/shared-types';

export async function listDecisions(
  page = 1,
  limit = 20,
  status?: 'OPEN' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'REJECTED' | 'TRIGGERED' | 'COMPLETED'
): Promise<PaginatedResponse<DecisionPoint>> {
  const res = await apiClient.get<{ data: PaginatedResponse<DecisionPoint> }>('/decisions', {
    params: { page, limit, status },
  });
  return res.data.data;
}

export async function updateDecisionStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<DecisionPoint> {
  const res = await apiClient.post<{ data: { decision: DecisionPoint } }>(`/decisions/${id}/status`, { status });
  return res.data.data.decision;
}

export async function addDecisionFeedback(id: string, notes: string): Promise<DecisionPoint> {
  const res = await apiClient.post<{ data: { decision: DecisionPoint } }>(`/decisions/${id}/feedback`, { notes });
  return res.data.data.decision;
}