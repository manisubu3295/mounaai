import { apiClient } from '@/lib/api-client';
import type { AnalysisRun, AnalysisRunDetail, PaginatedResponse } from '@pocketcomputer/shared-types';

export async function listAnalysisRuns(page = 1, limit = 20): Promise<PaginatedResponse<AnalysisRun>> {
  const res = await apiClient.get<{ data: PaginatedResponse<AnalysisRun> }>('/analysis-runs', {
    params: { page, limit },
  });
  return res.data.data;
}

export async function createAnalysisRun(summary?: Record<string, unknown>): Promise<AnalysisRun> {
  const res = await apiClient.post<{ data: { analysis_run: AnalysisRun } }>('/analysis-runs', { summary });
  return res.data.data.analysis_run;
}

export async function getAnalysisRun(id: string): Promise<AnalysisRunDetail> {
  const res = await apiClient.get<{ data: { analysis_run: AnalysisRunDetail } }>(`/analysis-runs/${id}`);
  return res.data.data.analysis_run;
}