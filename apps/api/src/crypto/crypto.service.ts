import crypto from 'crypto';
import { env } from '../config/env.js';

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
  return JSON.stringify(payload);
}

export function decrypt(encryptedJson: string): string {
  const payload: EncryptedPayload = JSON.parse(encryptedJson) as EncryptedPayload;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return decipher.update(Buffer.from(payload.ciphertext, 'base64')) +
    decipher.final('utf8');
}

export function maskSecret(value: string, showLast = 4): string {
  if (value.length <= showLast) return '****';
  return '*'.repeat(Math.min(value.length - showLast, 8)) + value.slice(-showLast);
}
