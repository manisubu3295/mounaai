import { describe, it, expect } from 'vitest';
import { validateSqlTemplate } from '../../src/connectors/sql-validator.js';

describe('validateSqlTemplate', () => {
  it('accepts a plain SELECT', () => {
    expect(validateSqlTemplate('SELECT * FROM orders')).toMatchObject({ valid: true });
  });

  it('accepts a parameterised SELECT', () => {
    expect(
      validateSqlTemplate('SELECT id, total FROM orders WHERE tenant_id = $1 AND status = $2')
    ).toMatchObject({ valid: true });
  });

  it('accepts a CTE (WITH … SELECT)', () => {
    expect(
      validateSqlTemplate('WITH ranked AS (SELECT *, ROW_NUMBER() OVER () AS rn FROM sales) SELECT * FROM ranked')
    ).toMatchObject({ valid: true });
  });

  it('rejects an empty string', () => {
    expect(validateSqlTemplate('')).toMatchObject({ valid: false });
  });

  it('rejects INSERT (caught by SELECT-only guard)', () => {
    const result = validateSqlTemplate('INSERT INTO orders VALUES ($1)');
    expect(result.valid).toBe(false);
    // INSERT doesn't start with SELECT/WITH so it's caught by the first guard
    expect(result.reason).toContain('SELECT');
  });

  it('rejects DROP', () => {
    expect(validateSqlTemplate('DROP TABLE orders')).toMatchObject({ valid: false });
  });

  it('rejects DELETE', () => {
    expect(validateSqlTemplate('DELETE FROM orders')).toMatchObject({ valid: false });
  });

  it('rejects inline comment (--)', () => {
    expect(validateSqlTemplate("SELECT 1 -- drop table")).toMatchObject({ valid: false });
  });

  it('rejects semicolon (multi-statement injection)', () => {
    expect(validateSqlTemplate('SELECT 1; DROP TABLE users')).toMatchObject({ valid: false });
  });

  it('rejects block comment (/* */)', () => {
    expect(validateSqlTemplate('SELECT /* hidden */ 1')).toMatchObject({ valid: false });
  });

  it('rejects {{variable}} template syntax', () => {
    const result = validateSqlTemplate('SELECT * FROM orders WHERE id = {{id}}');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('$1');
  });

  it('rejects SQL that does not start with SELECT or WITH', () => {
    expect(validateSqlTemplate('EXEC sp_executesql N\'SELECT 1\'')).toMatchObject({ valid: false });
  });
});
