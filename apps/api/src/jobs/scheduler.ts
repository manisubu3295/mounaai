/**
 * Mouna AI — Autonomous Analysis Scheduler
 *
 * Registers a per-tenant repeatable BullMQ job that fires analysis runs
 * on the interval configured in AutonomyConfig.
 *
 * Call syncTenantSchedule() whenever auto_analysis_enabled or
 * analysis_interval_minutes changes.
 * Call bootstrapScheduler() once at server startup.
 *
 * Also manages daily briefing jobs:
 * Call syncDailyReportSchedule() whenever daily report settings change.
 */

import { analysisRunQueue } from './analysis-run.queue.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const SCHEDULED_JOB_NAME = 'scheduled-execute';
const DAILY_REPORT_JOB_NAME = 'daily-report-execute';

function repeatKeyPrefix(tenantId: string): string {
  return `scheduled-analysis:${tenantId}`;
}

function dailyReportKeyPrefix(tenantId: string): string {
  return `daily-report:${tenantId}`;
}

/**
 * Remove any existing repeatable analysis jobs for a tenant,
 * then register a new one if auto-analysis is enabled.
 */
export async function syncTenantSchedule(tenantId: string): Promise<void> {
  // Remove existing repeatable jobs for this tenant
  const existing = await analysisRunQueue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === SCHEDULED_JOB_NAME && job.key.includes(tenantId)) {
      await analysisRunQueue.removeRepeatableByKey(job.key);
      logger.info('Scheduler: removed old repeatable job', { tenantId, key: job.key });
    }
  }

  const config = await prisma.autonomyConfig.findUnique({ where: { tenant_id: tenantId } });

  if (!config?.auto_analysis_enabled) {
    logger.info('Scheduler: auto-analysis disabled, no job registered', { tenantId });
    return;
  }

  const repeatEveryMs = config.analysis_interval_minutes * 60 * 1_000;

  await analysisRunQueue.add(
    SCHEDULED_JOB_NAME,
    // runId is empty — the worker creates the AnalysisRun record on pickup
    { tenantId, runId: '', triggeredBy: 'SCHEDULER' },
    {
      repeat: { every: repeatEveryMs },
      // Encode tenantId in the custom key so we can find and remove it later
      jobId: repeatKeyPrefix(tenantId),
    }
  );

  logger.info('Scheduler: registered repeatable analysis job', {
    tenantId,
    interval_minutes: config.analysis_interval_minutes,
  });
}

/**
 * Bootstrap: sync schedules for all tenants that have auto-analysis enabled.
 * Called once during server startup.
 */
export async function bootstrapScheduler(): Promise<void> {
  const configs = await prisma.autonomyConfig.findMany({
    where: { auto_analysis_enabled: true },
    select: { tenant_id: true },
  });

  logger.info('Scheduler: bootstrapping', { tenant_count: configs.length });

  await Promise.allSettled(configs.map(c => syncTenantSchedule(c.tenant_id)));
}

// ─── Daily Report Scheduler ───────────────────────────────────────────────────

/**
 * Convert HH:MM to a cron expression: "MM HH * * *"
 * e.g. "09:30" → "30 9 * * *"
 */
function timeToCron(sendTime: string): string {
  const [hh, mm] = sendTime.split(':');
  return `${parseInt(mm!, 10)} ${parseInt(hh!, 10)} * * *`;
}

/**
 * Remove any existing daily report jobs for a tenant,
 * then register a new cron job if the report is enabled.
 */
export async function syncDailyReportSchedule(tenantId: string): Promise<void> {
  // Remove existing daily report jobs for this tenant
  const existing = await analysisRunQueue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === DAILY_REPORT_JOB_NAME && job.key.includes(tenantId)) {
      await analysisRunQueue.removeRepeatableByKey(job.key);
      logger.info('Daily report scheduler: removed old cron job', { tenantId, key: job.key });
    }
  }

  const config = await prisma.dailyReport.findUnique({ where: { tenant_id: tenantId } });

  if (!config?.is_enabled) {
    logger.info('Daily report scheduler: disabled, no job registered', { tenantId });
    return;
  }

  const cronPattern = timeToCron(config.send_time);

  await analysisRunQueue.add(
    DAILY_REPORT_JOB_NAME,
    { tenantId, runId: '', triggeredBy: 'DAILY_REPORT' },
    {
      repeat: {
        pattern: cronPattern,
        tz: config.timezone,
      },
      jobId: dailyReportKeyPrefix(tenantId),
    }
  );

  logger.info('Daily report scheduler: registered cron job', {
    tenantId,
    cron: cronPattern,
    timezone: config.timezone,
  });
}

/**
 * Bootstrap: sync daily report schedules for all tenants that have it enabled.
 * Called once during server startup.
 */
export async function bootstrapDailyReports(): Promise<void> {
  const reports = await prisma.dailyReport.findMany({
    where: { is_enabled: true },
    select: { tenant_id: true },
  });

  logger.info('Daily report scheduler: bootstrapping', { tenant_count: reports.length });

  await Promise.allSettled(reports.map(r => syncDailyReportSchedule(r.tenant_id)));
}
