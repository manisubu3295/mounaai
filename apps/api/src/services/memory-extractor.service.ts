import { LLMProviderFactory } from '../llm/provider-factory.js';
import { bulkUpsertMemories, type UpsertMemoryInput } from './memory.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedFact {
  category: string;
  key: string;
  value: string;
  confidence: number;
  tags: string[];
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a business memory extractor. Given a conversation between a user and an AI assistant, extract stable business facts worth remembering for future conversations.

Return ONLY a JSON array. Each element must have:
- category: one of SUPPLIER_PREFERENCE, BUSINESS_RULE, CUSTOMER_INSIGHT, OPERATIONAL_PATTERN, PRODUCT_PREFERENCE, FINANCIAL_RULE, CONTACT_INFO, AI_LEARNING
- key: a short, unique, snake_case key (e.g. "preferred_payment_term", "top_supplier_name")
- value: the fact as a concise human-readable string
- confidence: 0.0–1.0 (how certain you are this is a stable fact, not a one-off)
- tags: array of relevant topic strings

Rules:
- Only extract facts that are stable across time (not "today's sales were X")
- Minimum confidence: 0.6 to include
- Return [] if nothing worth remembering
- Never include PII like passwords, credentials, personal addresses
- Maximum 10 facts per conversation`;

// ─── Core extractor ───────────────────────────────────────────────────────────

/**
 * Called asynchronously after a conversation turn.
 * Runs LLM extraction and bulk-upserts the result.
 * Errors are swallowed — this must never break the main pipeline.
 */
export async function extractAndStoreMemories(
  tenantId: string,
  conversationText: string
): Promise<void> {
  try {
    const provider = await LLMProviderFactory.resolve(tenantId);
    const response = await provider.complete({
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user', content: `Conversation:\n${conversationText}` },
      ],
      model: provider.name.startsWith('gemini') ? 'gemini-1.5-flash' : 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 1024,
    });

    const raw = response.content.trim();
    const jsonStr = raw.startsWith('[') ? raw : raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    const facts: ExtractedFact[] = JSON.parse(jsonStr);

    if (!Array.isArray(facts) || facts.length === 0) return;

    const valid = facts.filter(
      (f) =>
        typeof f.key === 'string' &&
        typeof f.value === 'string' &&
        typeof f.category === 'string' &&
        typeof f.confidence === 'number' &&
        f.confidence >= 0.6
    );

    const inputs: UpsertMemoryInput[] = valid.map((f) => ({
      category: f.category,
      key: f.key,
      value: f.value,
      source: 'AI_INFERRED',
      confidence: f.confidence,
      tags: Array.isArray(f.tags) ? f.tags : [],
    }));

    await bulkUpsertMemories(tenantId, inputs);
  } catch {
    // Extraction failure must never surface to the user
  }
}

/** Build a compact conversation transcript from messages for LLM input. */
export function buildConversationTranscript(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .map((m) => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
}
