/**
 * Simulate Service
 *
 * Runs a "what-if" scenario simulation against the tenant's live connector data.
 *
 * Flow:
 *   1. Fetch all active connector data for the tenant
 *   2. Build a focused simulation prompt with week dates pre-calculated
 *   3. Call the tenant's LLM with temperature 0.4 (some creativity, still grounded)
 *   4. Parse and return the structured SimulationResult
 */

import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { ApiConnector } from '../connectors/api-connector.js';
import { DbConnector } from '../connectors/db-connector.js';
import { applyMasking } from './masking.service.js';
import { LLMProviderFactory } from '../llm/provider-factory.js';
import { AppError } from '../types/errors.js';
import { logger } from '../lib/logger.js';
import type { SimulationResult, SimulationWeek } from '@pocketcomputer/shared-types';

type ApiConnectorSnapshot = Prisma.ApiConnectorGetPayload<{ include: { endpoints: true } }>;
type DbConnectorSnapshot = Prisma.DbConnectorGetPayload<{ include: { query_templates: true } }>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format: "Apr 7 – Apr 13" */
function weekLabel(startDate: Date, weekOffset: number): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const from = new Date(startDate);
  from.setDate(from.getDate() + weekOffset * 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return `${fmt(from)} – ${fmt(to)}`;
}

/** Compact JSON summary of connector data (max ~4 KB to avoid prompt bloat) */
function summariseConnectorData(data: Record<string, unknown>): string {
  const keys = Object.keys(data);
  if (keys.length === 0) return 'No live business data is currently connected.';

  const lines: string[] = [];
  for (const key of keys.slice(0, 8)) {
    const value = data[key];
    const short = JSON.stringify(value).slice(0, 240);
    lines.push(`[${key}]:\n${short}`);
  }
  return lines.join('\n\n');
}

/** Pull out just the JSON block from an LLM response that might have markdown or prose around it */
function extractJson(raw: string): string {
  // Strip markdown fences like ```json ... ``` or ``` ... ```
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object found in LLM response (length: ${raw.length})`);
  return stripped.slice(start, end + 1);
}

// ─── Data fetcher (mirrors analysis-engine, kept separate for SRP) ────────────

async function fetchConnectorSnapshot(
  tenantId: string
): Promise<{ data: Record<string, unknown>; errors: string[]; hasLiveData: boolean }> {
  const [apiConnectors, dbConnectors, fileConnectors] = await Promise.all([
    prisma.apiConnector.findMany({
      where: { tenant_id: tenantId, status: 'ACTIVE' },
      include: { endpoints: true },
    }),
    prisma.dbConnector.findMany({
      where: { tenant_id: tenantId, status: 'ACTIVE' },
      include: { query_templates: true },
    }),
    prisma.fileConnector.findMany({
      where: { tenant_id: tenantId, status: 'ACTIVE' },
    }),
  ]);

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  const apiTasks = apiConnectors.flatMap((connector: ApiConnectorSnapshot) =>
    connector.endpoints.map(async (endpoint: ApiConnectorSnapshot['endpoints'][number]) => {
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
        logger.warn('Simulate: API connector failed', { key, error: msg });
      }
    })
  );

  const dbTasks = dbConnectors.flatMap((connector: DbConnectorSnapshot) =>
    connector.query_templates.map(async (template: DbConnectorSnapshot['query_templates'][number]) => {
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
        logger.warn('Simulate: DB connector failed', { key, error: msg });
      }
    })
  );

  for (const fc of fileConnectors) {
    data[`file.${fc.name}`] = { headers: fc.headers, rows: fc.data, row_count: fc.row_count };
  }

  await Promise.allSettled([...apiTasks, ...dbTasks]);

  const hasLiveData = Object.keys(data).length > 0;
  return { data, errors, hasLiveData };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSimulationPrompt(
  scenario: string,
  connectorSummary: string,
  weekLabels: string[],
  today: string
): string {
  return `Return one valid JSON object only. No markdown. No code fences. No prose outside JSON.

Today: ${today}
Scenario: ${scenario}

Business data snapshot:
${connectorSummary}

Predict the next 30 days for a business owner in plain English.
Use actual numbers from the data where possible. If data is missing, say that clearly.
Keep all strings concise.

Use these exact week date labels:
- Week 1: ${weekLabels[0]}
- Week 2: ${weekLabels[1]}
- Week 3: ${weekLabels[2]}
- Week 4: ${weekLabels[3]}

Required JSON shape:
{
  "scenario_plain": "",
  "overall_impact": "positive | negative | neutral | mixed",
  "confidence": 0.0,
  "summary": "max 2 short sentences",
  "month_headline": "max 1 short sentence",
  "weeks": [
    { "week": 1, "dates": "${weekLabels[0]}", "headline": "", "detail": "", "direction": "up | down | flat", "key_metric": "" },
    { "week": 2, "dates": "${weekLabels[1]}", "headline": "", "detail": "", "direction": "up | down | flat", "key_metric": "" },
    { "week": 3, "dates": "${weekLabels[2]}", "headline": "", "detail": "", "direction": "up | down | flat", "key_metric": "" },
    { "week": 4, "dates": "${weekLabels[3]}", "headline": "", "detail": "", "direction": "up | down | flat", "key_metric": "" }
  ],
  "best_case": "max 1 sentence",
  "worst_case": "max 1 sentence",
  "risks": ["max 3 items"],
  "opportunities": ["max 2 items"],
  "recommendation": "max 2 short sentences",
  "data_basis": "max 1 short sentence"
}`;
}

function buildCompactSimulationRetryPrompt(
  scenario: string,
  connectorSummary: string,
  weekLabels: string[],
  today: string
): string {
  return `Return one complete valid JSON object only.

Today: ${today}
Scenario: ${scenario}
Data: ${connectorSummary}

Be brief. Every string must stay under 140 characters.
If data is missing, use cautious business assumptions.

Required keys:
- scenario_plain
- overall_impact (positive|negative|neutral|mixed)
- confidence (0 to 1)
- summary
- month_headline
- weeks (exactly 4 objects for weeks 1-4 using dates ${weekLabels.join(', ')})
- best_case
- worst_case
- risks (0 to 3 items)
- opportunities (0 to 2 items)
- recommendation
- data_basis

Each week object must contain: week, dates, headline, detail, direction, key_metric.
direction must be one of: up, down, flat.`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

interface RawSimulation {
  scenario_plain?: string;
  overall_impact?: string;
  confidence?: number;
  summary?: string;
  month_headline?: string;
  weeks?: Array<{
    week?: number;
    dates?: string;
    headline?: string;
    detail?: string;
    direction?: string;
    key_metric?: string | null;
  }>;
  best_case?: string;
  worst_case?: string;
  risks?: string[];
  opportunities?: string[];
  recommendation?: string;
  data_basis?: string;
}

function parseSimulation(
  raw: string,
  scenario: string,
  weekLabels: string[],
  hasLiveData: boolean
): SimulationResult {
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as RawSimulation;

  const validImpacts = ['positive', 'negative', 'neutral', 'mixed'];
  const validDirections = ['up', 'down', 'flat'];

  const weeks: SimulationWeek[] = (parsed.weeks ?? []).slice(0, 4).map((w, i) => ({
    week:       w.week      ?? (i + 1),
    dates:      w.dates     ?? weekLabels[i] ?? '',
    headline:   w.headline  ?? '',
    detail:     w.detail    ?? '',
    direction:  (validDirections.includes(w.direction ?? '') ? w.direction : 'flat') as SimulationWeek['direction'],
    key_metric: w.key_metric ?? null,
  }));

  // Pad to 4 weeks if LLM returned fewer
  while (weeks.length < 4) {
    const i = weeks.length;
    weeks.push({ week: i + 1, dates: weekLabels[i] ?? '', headline: '', detail: '', direction: 'flat', key_metric: null });
  }

  return {
    scenario,
    scenario_plain:  parsed.scenario_plain  ?? scenario,
    overall_impact:  (validImpacts.includes(parsed.overall_impact ?? '') ? parsed.overall_impact : 'neutral') as SimulationResult['overall_impact'],
    confidence:      Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
    summary:         parsed.summary         ?? '',
    month_headline:  parsed.month_headline  ?? '',
    weeks,
    best_case:       parsed.best_case       ?? '',
    worst_case:      parsed.worst_case      ?? '',
    risks:           Array.isArray(parsed.risks)         ? parsed.risks         : [],
    opportunities:   Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    recommendation:  parsed.recommendation  ?? '',
    data_basis:      parsed.data_basis      ?? '',
    has_live_data:   hasLiveData,
    simulated_at:    new Date().toISOString(),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runSimulation(
  tenantId: string,
  scenario: string
): Promise<SimulationResult> {
  // 1. Calculate week date labels (starting next Monday)
  const today = new Date();
  const dayOfWeek = today.getDay();                          // 0=Sun, 1=Mon…
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);

  const weekLabels = [0, 1, 2, 3].map(i => weekLabel(nextMonday, i));
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // 2. Fetch live connector data
  const { data, hasLiveData } = await fetchConnectorSnapshot(tenantId);
  const connectorSummary = summariseConnectorData(data);

  // 3. Resolve LLM provider
  const provider  = await LLMProviderFactory.resolve(tenantId);
  const llmConfig = await prisma.providerConfig.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });

  // 4. Build prompt and call LLM
  const prompt = buildSimulationPrompt(scenario, connectorSummary, weekLabels, todayStr);

  logger.info('Simulate: calling LLM', { tenantId, scenario: scenario.slice(0, 80) });

  const requestSimulation = async (content: string, temperature: number) => provider.complete({
    messages: [
      { role: 'user', content },
    ],
    model:       llmConfig?.model ?? 'gemini-2.0-flash',
    temperature,
    max_tokens:  Math.max(llmConfig?.max_tokens ?? 3000, 4096),
    response_mime_type: 'application/json',
  });

  let response;
  try {
    response = await requestSimulation(prompt, 0.2);
  } catch (err) {
    // Re-throw AppErrors (rate limit, invalid key, etc.) directly
    if (err instanceof AppError) throw err;
    throw new AppError('SIMULATION_LLM_FAILED', 'The AI could not run the simulation. Please try again.', 502);
  }

  // 5. Parse structured result — LLM sometimes wraps JSON in markdown fences
  let result: SimulationResult;
  try {
    result = parseSimulation(response.content, scenario, weekLabels, hasLiveData);
  } catch (parseErr) {
    logger.warn('Simulate: JSON parse failed', {
      tenantId,
      rawLength: response.content?.length,
      raw: response.content?.slice(0, 300),
      finishReason: response.finish_reason,
      outputTokens: response.output_tokens,
    });

    try {
      const retryPrompt = buildCompactSimulationRetryPrompt(scenario, connectorSummary, weekLabels, todayStr);
      response = await requestSimulation(retryPrompt, 0);
      result = parseSimulation(response.content, scenario, weekLabels, hasLiveData);
    } catch (retryErr) {
      logger.warn('Simulate: retry parse failed', {
        tenantId,
        rawLength: response?.content?.length,
        raw: response?.content?.slice(0, 300),
        finishReason: response?.finish_reason,
        outputTokens: response?.output_tokens,
        error: retryErr instanceof Error ? retryErr.message : String(retryErr),
      });

      throw new AppError(
        'SIMULATION_PARSE_FAILED',
        'The AI returned an unexpected response. Please try rephrasing your scenario and try again.',
        502
      );
    }
  }

  logger.info('Simulate: complete', {
    tenantId,
    impact:     result.overall_impact,
    confidence: result.confidence,
    latency_ms: response.latency_ms,
  });

  return result;
}
