/**
 * Mouna AI — Autonomous Analysis Scheduler
 *
 * Registers a per-tenant repeatable BullMQ job that fires analysis runs
 * on the interval configured in AutonomyConfig.
 *
 * Call syncTenantSchedule() whenever auto_analysis_enabled or
 * analysis_interval_minutes changes.
 * Call bootstrapScheduler() once at server startup.
 */

import { analysisRunQueue } from './analysis-run.queue.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const SCHEDULED_JOB_NAME = 'scheduled-execute';

function repeatKeyPrefix(tenantId: string): string {
  return `scheduled-analysis:${tenantId}`;
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
