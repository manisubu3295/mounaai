import 'dotenv/config';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import { startAnalysisWorker, stopAnalysisWorker } from './jobs/analysis-run.worker.js';
import { startDecisionExecutorWorker, stopDecisionExecutorWorker } from './jobs/decision-executor.worker.js';
import { bootstrapScheduler, bootstrapDailyReports } from './jobs/scheduler.js';
import { enqueueAnalysisRun } from './jobs/analysis-run.queue.js';

/** Re-enqueue any runs left in QUEUED state from a previous crash / restart. */
async function recoverOrphanedRuns(): Promise<void> {
  const orphans = await prisma.analysisRun.findMany({
    where: { status: 'QUEUED' },
    select: { id: true, tenant_id: true },
  });

  if (orphans.length === 0) return;

  logger.warn(`Recovering ${orphans.length} orphaned QUEUED analysis run(s)`, {
    ids: orphans.map((r) => r.id),
  });

  await Promise.all(
    orphans.map((r) =>
      enqueueAnalysisRun(r.tenant_id, r.id).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Could not re-enqueue orphaned run — marking FAILED', { runId: r.id, error: message });
        return prisma.analysisRun.update({
          where: { id: r.id },
          data: { status: 'FAILED', completed_at: new Date(), summary: { error: 'Re-enqueue after restart failed: ' + message } },
        });
      })
    )
  );
}

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    await redis.connect();

    startAnalysisWorker();
    startDecisionExecutorWorker();

    // Re-enqueue any runs that were stuck in QUEUED from a previous crash
    await recoverOrphanedRuns();

    // Register per-tenant scheduled analysis jobs for tenants with auto-analysis enabled
    await bootstrapScheduler();

    // Register daily briefing cron jobs for tenants with daily report enabled
    await bootstrapDailyReports();

    app.listen(env.PORT, () => {
      logger.info(`🚀 PocketComputer API running on port ${env.PORT}`, {
        env: env.NODE_ENV,
        port: env.PORT,
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { err });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down');
  await stopDecisionExecutorWorker();
  await stopAnalysisWorker();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

void bootstrap();
