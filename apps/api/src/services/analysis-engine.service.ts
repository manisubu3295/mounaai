/**
 * Analysis Engine
 *
 * Executes a queued AnalysisRun:
 *   1. Fetches all active connector data for the tenant
 *   2. Loads active KPI definitions
 *   3. Calls the tenant's LLM with a structured analysis prompt
 *   4. Parses the structured JSON response
 *   5. Writes GeneratedInsight + DecisionPoint records
 *   6. Marks the run COMPLETED (or FAILED on error)
 */

import { prisma } from '../lib/prisma.js';
import { ApiConnector } from '../connectors/api-connector.js';
import { DbConnector } from '../connectors/db-connector.js';
import { applyMasking } from './masking.service.js';
import { LLMProviderFactory } from '../llm/provider-factory.js';
import { ANALYST_SYSTEM_PROMPT } from '../llm/context-assembler.js';
import { getRelevantMemories, formatMemoriesAsContext } from './memory.service.js';
import { routeDecisions } from './decision-loop.service.js';
import { evaluateRulesForTenant } from './rules-engine.service.js';
import {
  notifyInsightCritical,
  notifyInsightWarning,
  notifyAnalysisCompleted,
  notifyAnalysisFailed,
  notifyConnectorErrors,
} from './notification.service.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../types/errors.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawInsight {
  title: string;
  summary: string;
  type: 'RISK' | 'OPPORTUNITY' | 'INEFFICIENCY' | 'WATCH';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  confidence: number;
  evidence: Record<string, unknown>;
  explanation?: string;
}

interface RawDecision {
  insight_index: number;
  title: string;
  recommendation: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  confidence: number;
  owner_role: 'TENANT_ADMIN' | 'ANALYST' | null;
  explanation?: string;
}

interface AnalysisOutput {
  insights: RawInsight[];
  decisions: RawDecision[];
}

// ─── Connector data fetcher ───────────────────────────────────────────────────

async function fetchAllConnectorData(
  tenantId: string
): Promise<{ data: Record<string, unknown>; errors: string[] }> {
  const [apiConnectors, dbConnectors] = await Promise.all([
    prisma.apiConnector.findMany({
      where: { tenant_id: tenantId, status: 'ACTIVE' },
      include: { endpoints: true },
    }),
    prisma.dbConnector.findMany({
      where: { tenant_id: tenantId, status: 'ACTIVE' },
      include: { query_templates: true },
    }),
  ]);

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  // API connectors — run every endpoint
  const apiTasks = apiConnectors.flatMap(connector =>
    connector.endpoints.map(async endpoint => {
      const key = `${connector.name}.${endpoint.name}`;
      try {
        const ac = new ApiConnector({
          id: connector.id,
          base_url: connector.base_url,
          auth_type: connector.auth_type,
          auth_config_enc: connector.auth_config_enc,
          default_headers: connector.default_headers as Record<string, string>,
        });
        const result = await ac.execute(
          {
            name: endpoint.name,
            method: endpoint.method,
            path_template: endpoint.path_template,
            query_params: endpoint.query_params as Record<string, string>,
            body_template: endpoint.body_template as Record<string, unknown> | null,
            timeout_ms: endpoint.timeout_ms,
            retry_count: endpoint.retry_count,
          },
          {}
        );
        const masked = await applyMasking(tenantId, result.transformed);
        data[key] = masked.masked_data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${key}: ${msg}`);
        logger.warn('Analysis engine: connector fetch failed', { key, error: msg });
      }
    })
  );

  // DB connectors — run every query template
  const dbTasks = dbConnectors.flatMap(connector =>
    connector.query_templates.map(async template => {
      const key = `${connector.name}.${template.name}`;
      try {
        const dc = new DbConnector({
          id: connector.id,
          db_type: connector.db_type,
          host: connector.host,
          port: connector.port,
          database_name: connector.database_name,
          username_enc: connector.username_enc,
          password_enc: connector.password_enc,
          ssl_mode: connector.ssl_mode,
        });
        const result = await dc.executeTemplate(
          {
            id: template.id,
            name: template.name,
            sql_template: template.sql_template,
            params: template.params as Array<{ name: string; type: string }>,
            timeout_ms: template.timeout_ms,
          },
          {}
        );
        const masked = await applyMasking(tenantId, result.transformed);
        data[key] = masked.masked_data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${key}: ${msg}`);
        logger.warn('Analysis engine: connector fetch failed', { key, error: msg });
      }
    })
  );

  // File connectors — include all active file data
  const fileConnectors = await prisma.fileConnector.findMany({
    where: { tenant_id: tenantId, status: 'ACTIVE' },
  });
  for (const fc of fileConnectors) {
    const key = `file.${fc.name}`;
    data[key] = { headers: fc.headers, rows: fc.data, row_count: fc.row_count };
  }

  await Promise.allSettled([...apiTasks, ...dbTasks]);
  return { data, errors };
}

/** Exported for the rules test endpoint — returns only the data snapshot. */
export async function fetchConnectorDataForTenant(tenantId: string): Promise<Record<string, unknown>> {
  const { data } = await fetchAllConnectorData(tenantId);
  return data;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildAnalysisPrompt(
  kpis: Array<{
    name: string;
    slug: string;
    formula: string;
    unit: string | null;
    target_value: number | null;
    warning_threshold: number | null;
    critical_threshold: number | null;
  }>,
  connectorData: Record<string, unknown>,
  connectorErrors: string[],
  memoryContext: string
): string {
  const kpiSection =
    kpis.length > 0
      ? JSON.stringify(
          kpis.map(k => ({
            name: k.name,
            slug: k.slug,
            formula: k.formula,
            unit: k.unit,
            target: k.target_value,
            warning_threshold: k.warning_threshold,
            critical_threshold: k.critical_threshold,
          })),
          null,
          2
        )
      : 'No KPI definitions configured.';

  const dataSection =
    Object.keys(connectorData).length > 0
      ? JSON.stringify(connectorData, null, 2)
      : 'No connector data available.';

  const errorSection =
    connectorErrors.length > 0
      ? `\nNote: The following data sources failed to load:\n${connectorErrors.map(e => `- ${e}`).join('\n')}`
      : '';

  return `## Analysis Run
${memoryContext ? `\n${memoryContext}\n` : ''}
### Active KPI Definitions
\`\`\`json
${kpiSection}
\`\`\`

### Data from Connected Sources
\`\`\`json
${dataSection}
\`\`\`
${errorSection}

### Task
Analyse the data above against the KPI definitions. Identify risks, opportunities, inefficiencies, and items to watch.

Respond with ONLY valid JSON — no markdown fences, no explanation — in this exact structure:
{
  "insights": [
    {
      "title": "string (max 80 chars)",
      "summary": "2-3 sentence explanation of the finding",
      "type": "RISK" | "OPPORTUNITY" | "INEFFICIENCY" | "WATCH",
      "severity": "INFO" | "WARNING" | "CRITICAL",
      "confidence": 0.0,
      "evidence": { "metric": "observed value", "threshold": "expected value", "source": "connector.endpoint" },
      "explanation": "1-2 plain English sentences for the business owner: exactly what data was observed, which threshold was violated, and why it requires attention."
    }
  ],
  "decisions": [
    {
      "insight_index": 0,
      "title": "string (max 80 chars)",
      "recommendation": "Clear actionable recommendation",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      "confidence": 0.0,
      "owner_role": "TENANT_ADMIN" | "ANALYST" | null,
      "explanation": "1-2 plain English sentences for the business owner: what this action will achieve, what problem it prevents, and what the risk is if nothing is done."
    }
  ]
}

Rules:
- Only include insights supported by the data provided.
- Each decision must reference a valid insight_index (0-based).
- severity: CRITICAL = KPI critical threshold breached, WARNING = warning threshold breached, INFO = trend or watch.
- priority: URGENT = needs immediate action, HIGH = within 24h, MEDIUM = within a week, LOW = informational.
- explanation must be in simple language a non-technical business owner can understand — no jargon.
- If there is nothing notable, return { "insights": [], "decisions": [] }.`;
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseAnalysisOutput(raw: string): AnalysisOutput {
  // Strip optional markdown code fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  const parsed = JSON.parse(cleaned) as unknown;

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>)['insights']) ||
    !Array.isArray((parsed as Record<string, unknown>)['decisions'])
  ) {
    throw new AppError('ANALYSIS_PARSE_FAILED', 'LLM returned unexpected structure', 500);
  }

  return parsed as AnalysisOutput;
}

// ─── Main execution function ──────────────────────────────────────────────────

export async function executeAnalysisRun(
  tenantId: string,
  runId: string
): Promise<void> {
  logger.info('Analysis run starting', { tenantId, runId });

  // Mark RUNNING
  await prisma.analysisRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', started_at: new Date() },
  });

  try {
    // 1. Load KPIs
    const kpis = await prisma.kpiDefinition.findMany({
      where: { tenant_id: tenantId, status: 'ACTIVE' },
      select: {
        name: true,
        slug: true,
        formula: true,
        unit: true,
        target_value: true,
        warning_threshold: true,
        critical_threshold: true,
      },
    });

    // 2. Load business memories for context injection
    const memories = await getRelevantMemories(
      tenantId,
      'business analysis kpi stock sales revenue supplier',
      15
    );
    const memoryContext = formatMemoriesAsContext(memories);

    // 3. Fetch all connector data
    const { data: connectorData, errors: connectorErrors } = await fetchAllConnectorData(tenantId);

    // 4. Run business rules engine — deterministic, fires before LLM
    const rulesResult = await evaluateRulesForTenant(tenantId, runId, connectorData);

    if (Object.keys(connectorData).length === 0 && kpis.length === 0) {
      await prisma.analysisRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          summary: {
            insights_count: rulesResult.insights_created,
            decisions_count: rulesResult.decisions_created,
            connector_errors: connectorErrors,
            rules_triggered: rulesResult.rules_triggered,
            note: 'No active connectors or KPI definitions found.',
          } as object,
        },
      });
      return;
    }

    // 5. Build prompt + call LLM
    const provider = await LLMProviderFactory.resolve(tenantId);
    const llmConfig = await prisma.providerConfig.findFirst({
      where: { tenant_id: tenantId, is_active: true },
    });

    const prompt = buildAnalysisPrompt(kpis, connectorData, connectorErrors, memoryContext);

    const llmResponse = await provider.complete({
      messages: [
        { role: 'system', content: ANALYST_SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
      model: llmConfig?.model ?? 'gemini-1.5-pro',
      temperature: 0.2,          // low temperature for consistent structured output
      max_tokens: llmConfig?.max_tokens ?? 4096,
    });

    // 5. Parse structured response
    let output: AnalysisOutput;
    try {
      output = parseAnalysisOutput(llmResponse.content);
    } catch (parseErr) {
      logger.warn('Analysis engine: failed to parse LLM response', {
        runId,
        raw: llmResponse.content.slice(0, 500),
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      output = { insights: [], decisions: [] };
    }

    // 6. Persist insights + linked decisions in a transaction
    const insightIds: string[] = [];
    const createdDecisionIds: string[] = [];

    await prisma.$transaction(async tx => {
      for (const raw of output.insights) {
        const insight = await tx.generatedInsight.create({
          data: {
            tenant_id: tenantId,
            analysis_run_id: runId,
            title: raw.title.slice(0, 255),
            summary: raw.summary,
            type: raw.type,
            severity: raw.severity,
            confidence: Math.min(1, Math.max(0, raw.confidence ?? 0)),
            evidence: (raw.evidence ?? {}) as object,
            ...(raw.explanation ? { explanation: raw.explanation } : {}),
          },
        });
        insightIds.push(insight.id);
      }

      for (const raw of output.decisions) {
        const insightId = insightIds[raw.insight_index];
        if (!insightId) continue; // skip bad index

        const decision = await tx.decisionPoint.create({
          data: {
            tenant_id: tenantId,
            insight_id: insightId,
            title: raw.title.slice(0, 255),
            recommendation: raw.recommendation,
            priority: raw.priority,
            confidence: Math.min(1, Math.max(0, raw.confidence ?? 0)),
            owner_role: raw.owner_role ?? null,
            status: 'OPEN',
            triggered_source: 'LLM_ANALYSIS',
            ...(raw.explanation ? { explanation: raw.explanation } : {}),
          },
        });
        createdDecisionIds.push(decision.id);
      }
    });

    // 7. Route LLM decisions by confidence threshold (auto-approve / review / open)
    const routing = await routeDecisions(tenantId, createdDecisionIds);

    // Notify on critical/warning insights (fire-and-forget, max 5 per run to avoid spam)
    const criticalInsights = output.insights.filter(i => i.severity === 'CRITICAL').slice(0, 5);
    const warningInsights  = output.insights.filter(i => i.severity === 'WARNING').slice(0, 3);
    criticalInsights.forEach((ins, idx) => {
      void notifyInsightCritical(tenantId, insightIds[idx] ?? '', ins.title, ins.summary);
    });
    warningInsights.forEach((ins, idx) => {
      void notifyInsightWarning(tenantId, insightIds[criticalInsights.length + idx] ?? '', ins.title, ins.summary);
    });

    // 8. Mark COMPLETED
    await prisma.analysisRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        summary: {
          insights_count:            insightIds.length + rulesResult.insights_created,
          decisions_count:           createdDecisionIds.length + rulesResult.decisions_created,
          decisions_auto_approved:   routing.auto_approved + rulesResult.decisions_created,
          decisions_review_required: routing.review_required,
          decisions_open:            routing.open,
          rules_evaluated:           rulesResult.rules_evaluated,
          rules_triggered:           rulesResult.rules_triggered,
          rules_insights_created:    rulesResult.insights_created,
          rules_decisions_created:   rulesResult.decisions_created,
          connector_sources:         Object.keys(connectorData),
          connector_errors:          connectorErrors,
          memories_injected:         memories.length,
          model_used:                llmResponse.model,
          input_tokens:              llmResponse.input_tokens,
          output_tokens:             llmResponse.output_tokens,
          latency_ms:                llmResponse.latency_ms,
        } as object,
      },
    });

    logger.info('Analysis run completed', {
      tenantId,
      runId,
      insights: insightIds.length,
      decisions: createdDecisionIds.length,
      auto_approved: routing.auto_approved,
      review_required: routing.review_required,
    });

    // Notify: analysis summary + connector errors (fire-and-forget)
    void notifyAnalysisCompleted(
      tenantId,
      runId,
      insightIds.length + rulesResult.insights_created,
      createdDecisionIds.length + rulesResult.decisions_created
    );
    if (connectorErrors.length > 0) {
      void notifyConnectorErrors(tenantId, connectorErrors);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Analysis run failed', { tenantId, runId, error: message });

    await prisma.analysisRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completed_at: new Date(),
        summary: { error: message } as object,
      },
    });

    void notifyAnalysisFailed(tenantId, runId, message);

    throw err; // re-throw so BullMQ can retry
  }
}
