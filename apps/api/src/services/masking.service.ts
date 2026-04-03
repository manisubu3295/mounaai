import { prisma } from '../lib/prisma.js';

export interface MaskingResult {
  masked_data: Record<string, unknown>;
  masked_fields: string[];
  masking_applied: boolean;
}

interface MaskingRule {
  id: string;
  match_type: string;
  match_pattern: string;
  strategy: string;
  mask_config: Record<string, unknown>;
  priority: number;
}

// System-level rules that always apply regardless of tenant config
const SYSTEM_RULES: MaskingRule[] = [
  { id: 'sys-1', match_type: 'REGEX', match_pattern: '(?i).*(password|secret|token|api_key|private_key|credential).*', strategy: 'FULL_REDACT', mask_config: {}, priority: 1 },
  { id: 'sys-2', match_type: 'REGEX', match_pattern: '(?i).*(ssn|social_security|national_id).*', strategy: 'FULL_REDACT', mask_config: {}, priority: 2 },
  { id: 'sys-3', match_type: 'REGEX', match_pattern: '(?i).*credit_card.*', strategy: 'PARTIAL_MASK', mask_config: { show_last: 4, char: '*' }, priority: 3 },
];

function matchesRule(fieldName: string, rule: MaskingRule): boolean {
  try {
    switch (rule.match_type) {
      case 'FIELD_NAME':
        return fieldName.toLowerCase() === rule.match_pattern.toLowerCase();
      case 'REGEX': {
        // Remove (?i) prefix and use i flag
        const pattern = rule.match_pattern.replace(/^\(\?i\)/, '');
        return new RegExp(pattern, 'i').test(fieldName);
      }
      case 'GLOB': {
        const regexPattern = rule.match_pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`, 'i').test(fieldName);
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function applyStrategy(value: unknown, rule: MaskingRule): unknown {
  switch (rule.strategy) {
    case 'FULL_REDACT':
      return '[REDACTED]';
    case 'PARTIAL_MASK': {
      const str = String(value);
      const showLast = (rule.mask_config['show_last'] as number | undefined) ?? 4;
      const char = (rule.mask_config['char'] as string | undefined) ?? '*';
      if (str.length <= showLast) return char.repeat(str.length);
      return char.repeat(Math.min(str.length - showLast, 8)) + str.slice(-showLast);
    }
    case 'TOKENIZE':
      return `TOKEN_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    default:
      return value;
  }
}

function deepMask(
  obj: Record<string, unknown>,
  rules: MaskingRule[],
  maskedFields: string[],
  parentKey = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
    const matchingRule = sortedRules.find((r) => matchesRule(key, r) || matchesRule(fullKey, r));

    if (matchingRule) {
      result[key] = applyStrategy(value, matchingRule);
      maskedFields.push(fullKey);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMask(value as Record<string, unknown>, rules, maskedFields, fullKey);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function applyMasking(
  tenantId: string,
  data: Record<string, unknown>
): Promise<MaskingResult> {
  const tenantRules = await prisma.maskingRule.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: { priority: 'asc' },
  });

  const allRules: MaskingRule[] = [
    ...SYSTEM_RULES,
    ...tenantRules.map((r: (typeof tenantRules)[number]) => ({
      id: r.id,
      match_type: r.match_type,
      match_pattern: r.match_pattern,
      strategy: r.strategy,
      mask_config: r.mask_config as Record<string, unknown>,
      priority: r.priority,
    })),
  ];

  const maskedFields: string[] = [];
  const masked_data = deepMask(data, allRules, maskedFields);

  return {
    masked_data,
    masked_fields: maskedFields,
    masking_applied: maskedFields.length > 0,
  };
}

export function previewMasking(
  rules: MaskingRule[],
  samplePayload: Record<string, unknown>
): MaskingResult {
  const allRules = [...SYSTEM_RULES, ...rules];
  const maskedFields: string[] = [];
  const masked_data = deepMask(samplePayload, allRules, maskedFields);
  return { masked_data, masked_fields: maskedFields, masking_applied: maskedFields.length > 0 };
}
