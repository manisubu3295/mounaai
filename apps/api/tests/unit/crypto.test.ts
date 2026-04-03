import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, maskSecret } from '../../src/crypto/crypto.service.js';

describe('crypto.service', () => {
  describe('encrypt / decrypt', () => {
    it('round-trips a plain string', () => {
      const original = 'super-secret-api-key-12345';
      expect(decrypt(encrypt(original))).toBe(original);
    });

    it('round-trips an empty string', () => {
      expect(decrypt(encrypt(''))).toBe('');
    });

    it('round-trips a JSON payload', () => {
      const payload = JSON.stringify({ token: 'abc', header_name: 'Authorization' });
      expect(decrypt(encrypt(payload))).toBe(payload);
    });

    it('produces different ciphertexts for the same input (random IV)', () => {
      const value = 'same-plaintext';
      const a = encrypt(value);
      const b = encrypt(value);
      expect(a).not.toBe(b);
      // Both still decrypt correctly
      expect(decrypt(a)).toBe(value);
      expect(decrypt(b)).toBe(value);
    });

    it('throws on tampered ciphertext', () => {
      const encrypted = JSON.parse(encrypt('hello'));
      encrypted.ciphertext = Buffer.from('corrupted').toString('base64');
      expect(() => decrypt(JSON.stringify(encrypted))).toThrow();
    });
  });

  describe('maskSecret', () => {
    it('masks long secrets showing last 4 chars', () => {
      expect(maskSecret('abcdefghij')).toBe('******ghij');
    });

    it('caps the mask at 8 asterisks', () => {
      const result = maskSecret('a'.repeat(30));
      expect(result.startsWith('********')).toBe(true);
      expect(result).toHaveLength(12); // 8 stars + last 4
    });

    it('returns **** for very short values', () => {
      expect(maskSecret('abc')).toBe('****');
      expect(maskSecret('')).toBe('****');
    });

    it('accepts a custom showLast count', () => {
      expect(maskSecret('abcdefgh', 2)).toMatch(/\*+gh$/);
    });
  });
});
