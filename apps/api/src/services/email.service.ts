/**
 * Email Service
 *
 * Sends transactional emails via the Resend REST API using the existing
 * httpClient axios singleton. No additional npm dependency required.
 *
 * If RESEND_API_KEY is not configured, all calls are silently no-ops so
 * in-app notifications still work in environments without email set up.
 */

import { httpClient } from '../lib/http-client.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import axios from 'axios';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendEmailParams {
  to: string[];
  subject: string;
  html: string;
}

export interface EmailSendResult {
  ok: boolean;
  provider: 'resend';
  statusCode?: number;
  error?: string;
  providerResponse?: unknown;
}

export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  if (!env.RESEND_API_KEY) {
    logger.debug('Email service: RESEND_API_KEY not configured, skipping email', {
      subject: params.subject,
      to: params.to,
    });
    return {
      ok: false,
      provider: 'resend',
      error: 'RESEND_API_KEY not configured',
    };
  }

  try {
    const response = await httpClient.post(
      RESEND_API_URL,
      {
        from: env.EMAIL_FROM_ADDRESS,
        to: params.to,
        subject: params.subject,
        html: params.html,
      },
      {
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );

    logger.info('Email service: email sent', {
      subject: params.subject,
      recipients: params.to.length,
    });

    return {
      ok: true,
      provider: 'resend',
      statusCode: response.status,
      providerResponse: response.data,
    };
  } catch (err) {
    // Email failures are non-fatal — log and continue
    const message = err instanceof Error ? err.message : String(err);
    const statusCode = axios.isAxiosError(err) ? err.response?.status : undefined;
    const providerResponse = axios.isAxiosError(err) ? err.response?.data : undefined;
    logger.warn('Email service: failed to send email', {
      subject: params.subject,
      error: message,
      statusCode,
    });

    return {
      ok: false,
      provider: 'resend',
      statusCode,
      error: message,
      providerResponse,
    };
  }
}

// ─── HTML email templates ──────────────────────────────────────────────────────

function baseTemplate(title: string, body: string, ctaHref?: string, ctaLabel?: string): string {
  const cta = ctaHref
    ? `<div style="margin-top:24px;text-align:center">
         <a href="${ctaHref}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
           ${ctaLabel ?? 'View Details'}
         </a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <tr><td style="background:#6366f1;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:700">Mouna AI</span>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#111;font-size:18px">${title}</h2>
          <div style="color:#444;font-size:15px;line-height:1.6">${body}</div>
          ${cta}
          <hr style="margin:32px 0;border:none;border-top:1px solid #eee" />
          <p style="color:#999;font-size:12px;margin:0">
            You received this email because you are a Mouna AI administrator.
            Manage notification settings in your account preferences.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function insightEmailHtml(title: string, summary: string, severity: string, appUrl: string): string {
  const color = severity === 'CRITICAL' ? '#dc2626' : '#d97706';
  return baseTemplate(
    `${severity} Insight: ${title}`,
    `<span style="color:${color};font-weight:700">${severity}</span>
     <p>${summary}</p>`,
    `${appUrl}/insights`,
    'View Insights'
  );
}

export function decisionEmailHtml(title: string, recommendation: string, priority: string, appUrl: string): string {
  return baseTemplate(
    `Decision Requires Approval: ${title}`,
    `<p><strong>Priority:</strong> ${priority}</p>
     <p><strong>Recommendation:</strong> ${recommendation}</p>
     <p>Please review and approve or reject this decision.</p>`,
    `${appUrl}/decisions`,
    'Review Decision'
  );
}

export function ruleTriggeredEmailHtml(ruleName: string, priority: string, triggeredField: string, appUrl: string): string {
  return baseTemplate(
    `Business Rule Triggered: ${ruleName}`,
    `<p>The business rule <strong>${ruleName}</strong> was triggered with priority <strong>${priority}</strong>.</p>
     <p><strong>Detected condition:</strong> ${triggeredField}</p>`,
    `${appUrl}/decisions`,
    'View Decision'
  );
}

export function analysisCompletedEmailHtml(insightsCount: number, decisionsCount: number, runId: string, appUrl: string): string {
  return baseTemplate(
    'Analysis Run Completed',
    `<p>Your latest AI analysis has completed with the following results:</p>
     <ul>
       <li><strong>${insightsCount}</strong> insight${insightsCount !== 1 ? 's' : ''} generated</li>
       <li><strong>${decisionsCount}</strong> decision${decisionsCount !== 1 ? 's' : ''} created</li>
     </ul>`,
    `${appUrl}/insights`,
    'View Results'
  );
}

export function analysisFailedEmailHtml(errorMsg: string, appUrl: string): string {
  return baseTemplate(
    'Analysis Run Failed',
    `<p>An analysis run encountered an error and could not complete.</p>
     <p><strong>Error:</strong> ${errorMsg}</p>
     <p>Please check your connector configuration and try again.</p>`,
    `${appUrl}/settings/connectors`,
    'Check Connectors'
  );
}

export function connectorErrorEmailHtml(errors: string[], appUrl: string): string {
  const errorList = errors.map(e => `<li>${e}</li>`).join('');
  return baseTemplate(
    'Connector Errors During Analysis',
    `<p>The following data sources failed to load during your last analysis run:</p>
     <ul>${errorList}</ul>
     <p>Insights may be incomplete. Please review your connector settings.</p>`,
    `${appUrl}/settings/connectors`,
    'Fix Connectors'
  );
}
