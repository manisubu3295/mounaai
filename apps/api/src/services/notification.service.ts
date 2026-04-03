/**
 * Notification Service
 *
 * Core fan-out service for all in-app and email notifications.
 *
 * Design:
 *  - Creates one Notification DB record per TENANT_ADMIN user (scoped to that user)
 *  - Also creates one tenant-wide record (user_id = null) for shared admin visibility
 *  - Dispatches email to configured recipients if NotificationPreference allows it
 *  - All public exports are fire-and-forget safe (callers use `void notifyXxx(...)`)
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import {
  sendEmail,
  insightEmailHtml,
  decisionEmailHtml,
  ruleTriggeredEmailHtml,
  analysisCompletedEmailHtml,
  analysisFailedEmailHtml,
  connectorErrorEmailHtml,
} from './email.service.js';
import type { NotificationType } from '@prisma/client';
import { auditLog } from './audit.service.js';

// ─── Core fan-out ─────────────────────────────────────────────────────────────

interface SendNotificationOpts {
  tenantId: string;
  title: string;
  body: string;
  type: NotificationType;
  resourceType?: string;
  resourceId?: string;
  emailHtml?: string;    // if provided + prefs allow, send email
  emailSubject?: string;
}

async function sendNotification(opts: SendNotificationOpts): Promise<void> {
  const { tenantId, title, body, type, resourceType, resourceId, emailHtml, emailSubject } = opts;

  // Fetch all active TENANT_ADMIN users for this tenant
  const admins = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: 'TENANT_ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true },
  });

  // Persist one notification per admin + one tenant-wide record
  const records = [
    // Per-user records
    ...admins.map(admin => ({
      tenant_id: tenantId,
      user_id: admin.id,
      title,
      body,
      type,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
    })),
    // Tenant-wide broadcast record
    {
      tenant_id: tenantId,
      user_id: null as string | null,
      title,
      body,
      type,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
    },
  ];

  // Batch create — if this fails, log but don't throw (non-fatal)
  try {
    await prisma.notification.createMany({ data: records });
  } catch (err) {
    logger.error('Notification service: failed to persist notifications', {
      tenantId,
      type,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // Send email if configured
  if (!emailHtml || !emailSubject || admins.length === 0) return;

  try {
    const prefs = await getOrCreatePreferences(tenantId);
    if (!prefs.email_enabled) return;

    const shouldSend =
      (type === 'INSIGHT_CRITICAL' && prefs.notify_on_critical) ||
      (type === 'INSIGHT_WARNING' && prefs.notify_on_warning) ||
      (type === 'DECISION_APPROVAL_REQUIRED' && prefs.notify_on_approval_required) ||
      (type === 'RULE_TRIGGERED' && prefs.notify_on_rule_trigger) ||
      (type === 'CONNECTOR_ERROR' && prefs.notify_on_connector_error) ||
      (type === 'ANALYSIS_COMPLETED') ||
      (type === 'ANALYSIS_FAILED');

    if (!shouldSend) return;

    // Use configured recipients, falling back to admin emails. An optional
    // NOTIFICATION_EMAIL can be added as a secondary recipient when configured.
    const tenantRecipients =
      prefs.email_recipients.length > 0
        ? prefs.email_recipients
        : admins.map(a => a.email);

    const recipients = env.NOTIFICATION_EMAIL
      ? [...new Set([...tenantRecipients, env.NOTIFICATION_EMAIL])]
      : tenantRecipients;

    const result = await sendEmail({ to: recipients, subject: emailSubject, html: emailHtml });

    await auditLog({
      tenant_id: tenantId,
      action: 'notification.email.send',
      resource_type: 'notification',
      resource_id: resourceId ?? null,
      status: result.ok ? 'SUCCESS' : 'FAILURE',
      payload: {
        summary: result.ok
          ? `Email sent for ${type.toLowerCase()} notification`
          : `Email delivery failed for ${type.toLowerCase()} notification`,
        notification_type: type,
        subject: emailSubject,
        to: recipients,
        recipient_count: recipients.length,
        from: env.EMAIL_FROM_ADDRESS,
        provider: result.provider,
        provider_status_code: result.statusCode ?? null,
        error_message: result.error ?? null,
        provider_response: result.providerResponse ?? null,
      },
    });
  } catch (err) {
    logger.warn('Notification service: email dispatch error', {
      tenantId,
      type,
      error: err instanceof Error ? err.message : String(err),
    });

    await auditLog({
      tenant_id: tenantId,
      action: 'notification.email.send',
      resource_type: 'notification',
      resource_id: resourceId ?? null,
      status: 'FAILURE',
      payload: {
        summary: `Email dispatch crashed for ${type.toLowerCase()} notification`,
        notification_type: type,
        subject: emailSubject,
        from: env.EMAIL_FROM_ADDRESS,
        error_message: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function getOrCreatePreferences(tenantId: string) {
  const existing = await prisma.notificationPreference.findUnique({
    where: { tenant_id: tenantId },
  });
  if (existing) return existing;

  return prisma.notificationPreference.create({
    data: { tenant_id: tenantId },
  });
}

export async function updatePreferences(
  tenantId: string,
  input: {
    email_enabled?: boolean | undefined;
    email_recipients?: string[] | undefined;
    notify_on_critical?: boolean | undefined;
    notify_on_warning?: boolean | undefined;
    notify_on_rule_trigger?: boolean | undefined;
    notify_on_approval_required?: boolean | undefined;
    notify_on_connector_error?: boolean | undefined;
  }
) {
  await getOrCreatePreferences(tenantId); // ensures record exists
  return prisma.notificationPreference.update({
    where: { tenant_id: tenantId },
    data: {
      ...(input.email_enabled !== undefined         && { email_enabled: input.email_enabled }),
      ...(input.email_recipients !== undefined      && { email_recipients: input.email_recipients }),
      ...(input.notify_on_critical !== undefined    && { notify_on_critical: input.notify_on_critical }),
      ...(input.notify_on_warning !== undefined     && { notify_on_warning: input.notify_on_warning }),
      ...(input.notify_on_rule_trigger !== undefined && { notify_on_rule_trigger: input.notify_on_rule_trigger }),
      ...(input.notify_on_approval_required !== undefined && { notify_on_approval_required: input.notify_on_approval_required }),
      ...(input.notify_on_connector_error !== undefined   && { notify_on_connector_error: input.notify_on_connector_error }),
    },
  });
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function notifyInsightCritical(
  tenantId: string,
  insightId: string,
  title: string,
  summary: string
): Promise<void> {
  await sendNotification({
    tenantId,
    type: 'INSIGHT_CRITICAL',
    title: `Critical Insight: ${title.slice(0, 80)}`,
    body: summary,
    resourceType: 'insight',
    resourceId: insightId,
    emailSubject: `[Mouna AI] Critical Insight: ${title.slice(0, 80)}`,
    emailHtml: insightEmailHtml(title, summary, 'CRITICAL', env.APP_BASE_URL ?? ''),
  });
}

export async function notifyInsightWarning(
  tenantId: string,
  insightId: string,
  title: string,
  summary: string
): Promise<void> {
  await sendNotification({
    tenantId,
    type: 'INSIGHT_WARNING',
    title: `Warning: ${title.slice(0, 80)}`,
    body: summary,
    resourceType: 'insight',
    resourceId: insightId,
    emailSubject: `[Mouna AI] Warning: ${title.slice(0, 80)}`,
    emailHtml: insightEmailHtml(title, summary, 'WARNING', env.APP_BASE_URL ?? ''),
  });
}

export async function notifyDecisionApprovalRequired(
  tenantId: string,
  decisionId: string,
  title: string,
  recommendation: string
): Promise<void> {
  await sendNotification({
    tenantId,
    type: 'DECISION_APPROVAL_REQUIRED',
    title: `Decision requires approval: ${title.slice(0, 80)}`,
    body: recommendation,
    resourceType: 'decision',
    resourceId: decisionId,
    emailSubject: `[Mouna AI] Action Required: ${title.slice(0, 80)}`,
    emailHtml: decisionEmailHtml(title, recommendation, 'MEDIUM', env.APP_BASE_URL ?? ''),
  });
}

export async function notifyRuleTriggered(
  tenantId: string,
  ruleId: string,
  ruleName: string,
  priority: string,
  triggeredField: string
): Promise<void> {
  await sendNotification({
    tenantId,
    type: 'RULE_TRIGGERED',
    title: `Rule triggered: ${ruleName.slice(0, 80)}`,
    body: `Business rule "${ruleName}" was triggered (${priority} priority).`,
    resourceType: 'rule',
    resourceId: ruleId,
    emailSubject: `[Mouna AI] ${priority} Rule Triggered: ${ruleName.slice(0, 80)}`,
    emailHtml: ruleTriggeredEmailHtml(ruleName, priority, triggeredField, env.APP_BASE_URL ?? ''),
  });
}

export async function notifyConnectorErrors(
  tenantId: string,
  errors: string[]
): Promise<void> {
  if (errors.length === 0) return;
  await sendNotification({
    tenantId,
    type: 'CONNECTOR_ERROR',
    title: `${errors.length} connector${errors.length > 1 ? 's' : ''} failed during analysis`,
    body: errors.slice(0, 3).join('; '),
    resourceType: 'run',
    emailSubject: `[Mouna AI] Connector Errors Detected`,
    emailHtml: connectorErrorEmailHtml(errors, env.APP_BASE_URL ?? ''),
  });
}

export async function notifyAnalysisCompleted(
  tenantId: string,
  runId: string,
  insightsCount: number,
  decisionsCount: number
): Promise<void> {
  // Only notify if there are findings worth seeing
  if (insightsCount === 0 && decisionsCount === 0) return;

  await sendNotification({
    tenantId,
    type: 'ANALYSIS_COMPLETED',
    title: `Analysis complete: ${insightsCount} insight${insightsCount !== 1 ? 's' : ''}, ${decisionsCount} decision${decisionsCount !== 1 ? 's' : ''}`,
    body: `Your latest analysis run produced ${insightsCount} insights and ${decisionsCount} decisions.`,
    resourceType: 'run',
    resourceId: runId,
    emailSubject: `[Mouna AI] Analysis Complete`,
    emailHtml: analysisCompletedEmailHtml(insightsCount, decisionsCount, runId, env.APP_BASE_URL ?? ''),
  });
}

export async function notifyAnalysisFailed(
  tenantId: string,
  runId: string,
  errorMsg: string
): Promise<void> {
  await sendNotification({
    tenantId,
    type: 'ANALYSIS_FAILED',
    title: 'Analysis run failed',
    body: errorMsg,
    resourceType: 'run',
    resourceId: runId,
    emailSubject: `[Mouna AI] Analysis Run Failed`,
    emailHtml: analysisFailedEmailHtml(errorMsg, env.APP_BASE_URL ?? ''),
  });
}

// ─── Query helpers (used by controller) ──────────────────────────────────────

export async function listNotifications(
  tenantId: string,
  userId: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;

  // Return notifications for this user OR tenant-wide (user_id = null)
  const where = {
    tenant_id: tenantId,
    OR: [{ user_id: userId }, { user_id: null }],
  };

  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    has_more: skip + items.length < total,
  };
}

export async function getUnreadCount(tenantId: string, userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      tenant_id: tenantId,
      is_read: false,
      OR: [{ user_id: userId }, { user_id: null }],
    },
  });
}

export async function markAsRead(
  tenantId: string,
  userId: string,
  notificationId: string
): Promise<boolean> {
  // Only mark records owned by this user or tenant-wide records
  const n = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      tenant_id: tenantId,
      OR: [{ user_id: userId }, { user_id: null }],
    },
  });
  if (!n) return false;

  await prisma.notification.update({
    where: { id: notificationId },
    data: { is_read: true, read_at: new Date() },
  });
  return true;
}

export async function markAllAsRead(tenantId: string, userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      tenant_id: tenantId,
      is_read: false,
      OR: [{ user_id: userId }, { user_id: null }],
    },
    data: { is_read: true, read_at: new Date() },
  });
  return result.count;
}
