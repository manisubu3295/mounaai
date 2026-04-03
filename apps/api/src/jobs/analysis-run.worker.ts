import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { executeAnalysisRun } from '../services/analysis-engine.service.js';
import type { AnalysisRunJobData } from './analysis-run.queue.js';

// Dedicated connection — BullMQ workers need maxRetriesPerRequest: null
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err: Error) =>
  logger.error('Analysis worker Redis error', { message: err.message })
);

let worker: Worker<AnalysisRunJobData> | null = null;

export function startAnalysisWorker(): void {
  worker = new Worker<AnalysisRunJobData>(
    'analysis-runs',
    async (job: Job<AnalysisRunJobData>) => {
      const { tenantId, triggeredBy } = job.data;
      let { runId } = job.data;

      // Scheduler-initiated jobs arrive without a runId.
      // Create the AnalysisRun record here so the engine has a target to update.
      if (!runId) {
        const run = await prisma.analysisRun.create({
          data: {
            tenant_id: tenantId,
            initiated_by_user_id: null,
            status: 'QUEUED',
            summary: { triggered_by: triggeredBy ?? 'SCHEDULER' } as object,
          },
        });
        runId = run.id;
        logger.info('Scheduler created analysis run', { tenantId, runId });
      }

      logger.info('Processing analysis run job', { jobId: job.id, tenantId, runId, triggeredBy });
      await executeAnalysisRun(tenantId, runId);
    },
    {
      connection,
      concurrency: 2,
      stalledInterval: 60_000,
    }
  );

  worker.on('completed', job => {
    logger.info('Analysis run job completed', { jobId: job.id, runId: job.data.runId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Analysis run job failed', {
      jobId: job?.id,
      runId: job?.data.runId,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', err => {
    logger.error('Analysis worker error', { error: err.message });
  });

  logger.info('Analysis run worker started');
}

export async function stopAnalysisWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    logger.info('Analysis run worker stopped');
  }
}
