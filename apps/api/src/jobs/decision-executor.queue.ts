import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface DecisionExecutorJobData {
  tenantId: string;
  decisionId: string;
}

// BullMQ requires maxRetriesPerRequest: null for blocking commands
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err: Error) =>
  logger.error('Decision executor queue Redis error', { message: err.message })
);

export const decisionExecutorQueue = new Queue<DecisionExecutorJobData>('decision-executor', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export async function enqueueDecisionExecution(tenantId: string, decisionId: string): Promise<void> {
  await decisionExecutorQueue.add(
    'execute',
    { tenantId, decisionId },
    { jobId: `decision-exec-${decisionId}` }
  );
  logger.info('Decision execution enqueued', { tenantId, decisionId });
}
