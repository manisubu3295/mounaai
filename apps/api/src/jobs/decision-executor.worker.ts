import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { executeDecision } from '../services/decision-loop.service.js';
import type { DecisionExecutorJobData } from './decision-executor.queue.js';

// Dedicated connection — BullMQ workers need maxRetriesPerRequest: null
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err: Error) =>
  logger.error('Decision executor worker Redis error', { message: err.message })
);

let worker: Worker<DecisionExecutorJobData> | null = null;

export function startDecisionExecutorWorker(): void {
  worker = new Worker<DecisionExecutorJobData>(
    'decision-executor',
    async (job: Job<DecisionExecutorJobData>) => {
      const { tenantId, decisionId } = job.data;
      logger.info('Processing decision execution job', { jobId: job.id, tenantId, decisionId });
      await executeDecision(tenantId, decisionId);
    },
    {
      connection,
      concurrency: 5,
      stalledInterval: 60_000,
    }
  );

  worker.on('completed', job => {
    logger.info('Decision execution job completed', { jobId: job.id, decisionId: job.data.decisionId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Decision execution job failed', {
      jobId: job?.id,
      decisionId: job?.data.decisionId,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', err => {
    logger.error('Decision executor worker error', { error: err.message });
  });

  logger.info('Decision executor worker started');
}

export async function stopDecisionExecutorWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    logger.info('Decision executor worker stopped');
  }
}
