export interface SqlValidationResult {
  valid: boolean;
  reason?: string;
}

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'COPY', 'VACUUM', 'ANALYZE',
  'MERGE', 'REPLACE', 'CALL', 'PROCEDURE', 'FUNCTION', 'TRIGGER',
];

const FORBIDDEN_PATTERNS = ['--', ';', '/*', '*/'];

export function validateSqlTemplate(sql: string): SqlValidationResult {
  const trimmed = sql.trim();
  if (!trimmed) return { valid: false, reason: 'SQL template cannot be empty' };

  const normalized = trimmed.toUpperCase();

  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return { valid: false, reason: 'Only SELECT statements (or CTEs with SELECT) are permitted' };
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Match whole words only
    const re = new RegExp(`\\b${keyword}\\b`, 'i');
    if (re.test(trimmed)) {
      return { valid: false, reason: `Forbidden keyword detected: ${keyword}` };
    }
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (trimmed.includes(pattern)) {
      return { valid: false, reason: `Forbidden pattern detected: ${pattern}` };
    }
  }

  // Must use $N params — not template variables
  if (/\{\{[^}]+\}\}/.test(trimmed)) {
    return {
      valid: false,
      reason: 'Use parameterized placeholders ($1, $2) instead of {{variable}} template syntax',
    };
  }

  return { valid: true };
}
