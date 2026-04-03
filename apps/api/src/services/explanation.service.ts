/**
 * Explanation Service
 *
 * Provides on-demand plain-English explanations for GeneratedInsights and
 * DecisionPoints. When an item was created before the explainability feature
 * (or the LLM omitted the field), this service generates the explanation
 * retroactively using the tenant's configured LLM and caches it on the record.
 */

import { prisma } from '../lib/prisma.js';
import { LLMProviderFactory } from '../llm/provider-factory.js';
import { logger } from '../lib/logger.js';
import { NotFoundError } from '../types/errors.js';

// ─── Insight explain ──────────────────────────────────────────────────────────

export async function explainInsight(
  tenantId: string,
  insightId: string
): Promise<{ explanation: string; cached: boolean }> {
  const insight = await prisma.generatedInsight.findFirst({
    where: { id: insightId, tenant_id: tenantId },
  });
  if (!insight) throw new NotFoundError('Insight');

  // Return cached explanation if present
  if (insight.explanation) {
    return { explanation: insight.explanation, cached: true };
  }

  // Build prompt for plain-English explanation
  const prompt = `You are a business analyst explaining a data insight to a non-technical business owner.

Insight details:
- Title: ${insight.title}
- Summary: ${insight.summary}
- Type: ${insight.type}
- Severity: ${insight.severity}
- Confidence: ${((insight.confidence ?? 0) * 100).toFixed(0)}%
- Evidence: ${JSON.stringify(insight.evidence ?? {})}

Write 2-3 sentences in plain, jargon-free English that explain:
1. Exactly what data pattern was observed
2. Why it matters to the business
3. How confident we are in this finding

Respond with ONLY the explanation text — no headings, no bullet points, no markdown.`;

  const provider = await LLMProviderFactory.resolve(tenantId);
  const llmConfig = await prisma.providerConfig.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });

  const response = await provider.complete({
    messages: [{ role: 'user', content: prompt }],
    model: llmConfig?.model ?? 'gemini-1.5-pro',
    temperature: 0.3,
    max_tokens: 300,
  });

  const explanation = response.content.trim();

  // Persist for future requests
  await prisma.generatedInsight.update({
    where: { id: insightId },
    data: { explanation },
  });

  logger.info('Explanation service: insight explanation generated', { tenantId, insightId });

  return { explanation, cached: false };
}

// ─── Decision explain ─────────────────────────────────────────────────────────

export async function explainDecision(
  tenantId: string,
  decisionId: string
): Promise<{ explanation: string; reasoning_chain: Record<string, unknown> | null; cached: boolean }> {
  const decision = await prisma.decisionPoint.findFirst({
    where: { id: decisionId, tenant_id: tenantId },
    include: {
      insight: {
        select: { title: true, summary: true, type: true, severity: true, evidence: true },
      },
    },
  });
  if (!decision) throw new NotFoundError('Decision');

  // Return cached explanation if present
  if (decision.explanation) {
    return {
      explanation: decision.explanation,
      reasoning_chain: decision.reasoning_chain as Record<string, unknown> | null,
      cached: true,
    };
  }

  // Build prompt for plain-English explanation
  const prompt = `You are a business analyst explaining a recommended action to a non-technical business owner.

Decision details:
- Title: ${decision.title}
- Recommendation: ${decision.recommendation}
- Priority: ${decision.priority}
- Confidence: ${((decision.confidence ?? 0) * 100).toFixed(0)}%
- Source: ${decision.triggered_source ?? 'AI analysis'}
- Related insight: ${decision.insight?.title ?? 'N/A'} — ${decision.insight?.summary ?? ''}

Write 2-3 sentences in plain, jargon-free English that explain:
1. Exactly what action is being recommended and why
2. What problem it will prevent or resolve
3. What the risk is if nothing is done

Then on a new line starting with "REASONING:", list the key data points that led to this recommendation as a brief comma-separated list.

Format:
<explanation text>
REASONING: <point1>, <point2>, ...`;

  const provider = await LLMProviderFactory.resolve(tenantId);
  const llmConfig = await prisma.providerConfig.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });

  const response = await provider.complete({
    messages: [{ role: 'user', content: prompt }],
    model: llmConfig?.model ?? 'gemini-1.5-pro',
    temperature: 0.3,
    max_tokens: 400,
  });

  const raw = response.content.trim();
  const reasoningMatch = raw.match(/\nREASONING:\s*(.+)$/s);
  const explanation = reasoningMatch
    ? raw.slice(0, raw.lastIndexOf('\nREASONING:')).trim()
    : raw;

  const reasoningChain: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    model_used: response.model,
    key_factors: reasoningMatch
      ? reasoningMatch[1]!.split(',').map(s => s.trim())
      : [],
    triggered_source: decision.triggered_source ?? 'LLM_ANALYSIS',
  };

  // Persist for future requests
  await prisma.decisionPoint.update({
    where: { id: decisionId },
    data: { explanation, reasoning_chain: reasoningChain as object },
  });

  logger.info('Explanation service: decision explanation generated', { tenantId, decisionId });

  return { explanation, reasoning_chain: reasoningChain, cached: false };
}
