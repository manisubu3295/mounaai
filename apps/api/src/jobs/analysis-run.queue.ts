import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface AnalysisRunJobData {
  tenantId: string;
  runId: string;
  triggeredBy?: 'USER' | 'SCHEDULER' | 'DAILY_REPORT';
}

// BullMQ requires maxRetriesPerRequest: null for blocking commands
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err: Error) =>
  logger.error('Analysis queue Redis error', { message: err.message })
);

export const analysisRunQueue = new Queue<AnalysisRunJobData>('analysis-runs', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export async function enqueueAnalysisRun(tenantId: string, runId: string): Promise<void> {
  await analysisRunQueue.add(
    'execute',
    { tenantId, runId },
    { jobId: `analysis-run-${runId}` }
  );
  logger.info('Analysis run enqueued', { tenantId, runId });
}
