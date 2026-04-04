import { apiClient } from '@/lib/api-client';
import type { DailyReport } from '@pocketcomputer/shared-types';

interface DailyReportResponse {
  data: {
    daily_report: DailyReport;
  };
}

export interface UpdateDailyReportInput {
  is_enabled?: boolean;
  send_time?: string;
  timezone?: string;
  email_recipients?: string[];
}

export async function getDailyReport(): Promise<DailyReport> {
  const res = await apiClient.get<DailyReportResponse>('/daily-report');
  return res.data.data.daily_report;
}

export async function updateDailyReport(input: UpdateDailyReportInput): Promise<DailyReport> {
  const res = await apiClient.put<DailyReportResponse>('/daily-report', input);
  return res.data.data.daily_report;
}
