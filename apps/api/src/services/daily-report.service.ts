/**
 * Daily Report Service
 *
 * Manages per-tenant daily briefing configuration.
 * The scheduler calls syncDailyReportSchedule() whenever settings change.
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface UpdateDailyReportInput {
  is_enabled?: boolean;
  send_time?: string;      // HH:MM in 24h format, e.g. "09:00"
  timezone?: string;
  email_recipients?: string[];
}

export async function getOrCreateDailyReport(tenantId: string) {
  const existing = await prisma.dailyReport.findUnique({ where: { tenant_id: tenantId } });
  if (existing) return existing;

  return prisma.dailyReport.create({
    data: { tenant_id: tenantId },
  });
}

export async function updateDailyReport(tenantId: string, input: UpdateDailyReportInput) {
  const report = await prisma.dailyReport.upsert({
    where: { tenant_id: tenantId },
    create: {
      tenant_id: tenantId,
      is_enabled: input.is_enabled ?? false,
      send_time: input.send_time ?? '09:00',
      timezone: input.timezone ?? 'Asia/Kolkata',
      email_recipients: input.email_recipients ?? [],
    },
    update: {
      ...(input.is_enabled !== undefined && { is_enabled: input.is_enabled }),
      ...(input.send_time !== undefined && { send_time: input.send_time }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.email_recipients !== undefined && { email_recipients: input.email_recipients }),
    },
  });

  logger.info('Daily report config updated', { tenantId, is_enabled: report.is_enabled });
  return report;
}

export async function markDailyReportSent(tenantId: string): Promise<void> {
  await prisma.dailyReport.update({
    where: { tenant_id: tenantId },
    data: { last_sent_at: new Date() },
  });
}

export async function getAllEnabledDailyReports() {
  return prisma.dailyReport.findMany({
    where: { is_enabled: true },
    include: { tenant: { select: { name: true } } },
  });
}
