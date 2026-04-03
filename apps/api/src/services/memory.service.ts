import { prisma } from '../lib/prisma.js';
import { PlanTier } from '@pocketcomputer/shared-types';
import { PlanGateError } from '../types/errors.js';

// ─── Plan limits ──────────────────────────────────────────────────────────────

interface MemoryLimits {
  max_records: number | null;
  /** Days until auto-expiry. null = never expires */
  expiry_days: number | null;
}

const MEMORY_LIMITS: Record<PlanTier, MemoryLimits> = {
  FREE:       { max_records: 50,   expiry_days: 30  },
  PRO:        { max_records: 500,  expiry_days: 365 },
  ENTERPRISE: { max_records: null, expiry_days: null },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryRecord {
  id: string;
  tenant_id: string;
  category: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  tags: string[];
  access_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertMemoryInput {
  category: string;
  key: string;
  value: string;
  source?: string;
  confidence?: number;
  tags?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRecord(m: {
  id: string; tenant_id: string; category: string; key: string; value: string;
  source: string; confidence: number; tags: unknown; access_count: number;
  last_accessed_at: Date | null; expires_at: Date | null;
  created_at: Date; updated_at: Date;
}): MemoryRecord {
  return {
    ...m,
    tags: m.tags as string[],
    last_accessed_at: m.last_accessed_at?.toISOString() ?? null,
    expires_at: m.expires_at?.toISOString() ?? null,
    created_at: m.created_at.toISOString(),
    updated_at: m.updated_at.toISOString(),
  };
}

async function getTenantPlan(tenantId: string): Promise<PlanTier> {
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } });
  return t.plan as PlanTier;
}

function expiresAt(plan: PlanTier): Date | null {
  const days = MEMORY_LIMITS[plan].expiry_days;
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Upsert a single memory record. Enforces plan quota on insert. */
export async function upsertMemory(tenantId: string, input: UpsertMemoryInput): Promise<MemoryRecord> {
  const plan = await getTenantPlan(tenantId);
  const limits = MEMORY_LIMITS[plan];

  // Check quota only when creating (key doesn't exist yet)
  const existing = await prisma.businessMemory.findUnique({
    where: { tenant_id_key: { tenant_id: tenantId, key: input.key } },
  });

  if (!existing && limits.max_records !== null) {
    const count = await prisma.businessMemory.count({ where: { tenant_id: tenantId } });
    if (count >= limits.max_records) {
      throw new PlanGateError('BUSINESS_MEMORY_LIMIT');
    }
  }

  const record = await prisma.businessMemory.upsert({
    where: { tenant_id_key: { tenant_id: tenantId, key: input.key } },
    create: {
      tenant_id: tenantId,
      category: input.category as never,
      key: input.key,
      value: input.value,
      source: (input.source ?? 'AI_INFERRED') as never,
      confidence: input.confidence ?? 1.0,
      tags: input.tags ?? [],
      expires_at: expiresAt(plan),
    },
    update: {
      value: input.value,
      source: (input.source ?? 'AI_INFERRED') as never,
      confidence: input.confidence ?? 1.0,
      tags: input.tags ?? [],
      expires_at: expiresAt(plan),
    },
  });

  return toRecord(record);
}

/** Bulk upsert — used by the memory extractor after a conversation. */
export async function bulkUpsertMemories(tenantId: string, inputs: UpsertMemoryInput[]): Promise<number> {
  let saved = 0;
  for (const input of inputs) {
    try {
      await upsertMemory(tenantId, input);
      saved++;
    } catch (err) {
      if (err instanceof PlanGateError) break; // quota hit — stop
      // skip individual failures silently
    }
  }
  return saved;
}

/** Fetch memories relevant to a query string for context injection. */
export async function getRelevantMemories(tenantId: string, query: string, limit = 10): Promise<MemoryRecord[]> {
  const now = new Date();
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  // Fetch non-expired memories, ordered by confidence + access_count desc
  const records = await prisma.businessMemory.findMany({
    where: {
      tenant_id: tenantId,
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
    },
    orderBy: [{ confidence: 'desc' }, { access_count: 'desc' }],
    take: limit * 3, // over-fetch then rank client-side
  });

  // Simple keyword relevance scoring
  const scored = records.map((r) => {
    const haystack = `${r.key} ${r.value} ${r.category}`.toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0);
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score || b.r.confidence - a.r.confidence);

  const top = scored.slice(0, limit).map(({ r }) => r);

  // Bump access count asynchronously
  if (top.length) {
    void prisma.businessMemory.updateMany({
      where: { id: { in: top.map((r) => r.id) } },
      data: { access_count: { increment: 1 }, last_accessed_at: now },
    });
  }

  return top.map(toRecord);
}

/** List all memories for a tenant (management UI). */
export async function listMemories(
  tenantId: string,
  opts: { category?: string; page?: number; pageSize?: number } = {}
): Promise<{ data: MemoryRecord[]; total: number }> {
  const { category, page = 1, pageSize = 50 } = opts;
  const where = {
    tenant_id: tenantId,
    ...(category ? { category: category as never } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.businessMemory.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.businessMemory.count({ where }),
  ]);

  return { data: data.map(toRecord), total };
}

/** Delete a single memory record. */
export async function deleteMemory(tenantId: string, memoryId: string): Promise<void> {
  await prisma.businessMemory.deleteMany({
    where: { id: memoryId, tenant_id: tenantId },
  });
}

/** Purge expired memories for all tenants (run via cron or startup). */
export async function purgeExpiredMemories(): Promise<number> {
  const result = await prisma.businessMemory.deleteMany({
    where: { expires_at: { lt: new Date() } },
  });
  return result.count;
}

/** Format memories as context string for injection into system prompt. */
export function formatMemoriesAsContext(memories: MemoryRecord[]): string {
  if (!memories.length) return '';
  const lines = memories.map(
    (m) => `[${m.category}] ${m.key}: ${m.value}` + (m.confidence < 1 ? ` (confidence: ${(m.confidence * 100).toFixed(0)}%)` : '')
  );
  return `\n\n## Business Context (remembered facts)\n${lines.join('\n')}`;
}
