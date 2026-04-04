import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { executeAnalysisRun } from '../services/analysis-engine.service.js';
import { markDailyReportSent } from '../services/daily-report.service.js';
import { sendEmail, dailyBriefingEmailHtml } from '../services/email.service.js';
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

      // Send daily briefing email if this was triggered by the daily report scheduler
      if (triggeredBy === 'DAILY_REPORT') {
        await sendDailyBriefingEmail(tenantId, runId);
      }
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

async function sendDailyBriefingEmail(tenantId: string, runId: string): Promise<void> {
  try {
    const [dailyReport, run, tenant] = await Promise.all([
      prisma.dailyReport.findUnique({ where: { tenant_id: tenantId } }),
      prisma.analysisRun.findUnique({
        where: { id: runId },
        include: {
          insights: { take: 5, orderBy: { created_at: 'desc' } },
        },
      }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    ]);

    if (!dailyReport || !dailyReport.is_enabled || dailyReport.email_recipients.length === 0) {
      logger.info('Daily briefing: no recipients configured, skipping email', { tenantId });
      return;
    }

    if (!run || !tenant) {
      logger.warn('Daily briefing: run or tenant not found', { tenantId, runId });
      return;
    }

    const decisionsCount = await prisma.decisionPoint.count({
      where: {
        tenant_id: tenantId,
        insight: { analysis_run_id: runId },
      },
    });

    const topInsights = (run.insights ?? []).map(i => ({
      title: i.title,
      summary: i.summary,
      type: i.type,
      severity: i.severity,
    }));

    const html = dailyBriefingEmailHtml(
      tenant.name,
      run.insights?.length ?? 0,
      decisionsCount,
      topInsights,
      runId,
      env.APP_BASE_URL!
    );

    await sendEmail({
      to: dailyReport.email_recipients,
      subject: `Mouna AI — Daily Briefing (${new Date().toLocaleDateString('en-IN')})`,
      html,
    });

    await markDailyReportSent(tenantId);
    logger.info('Daily briefing email sent', { tenantId, recipients: dailyReport.email_recipients.length });
  } catch (err) {
    logger.error('Daily briefing: failed to send email', {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function stopAnalysisWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    logger.info('Analysis run worker stopped');
  }
}
