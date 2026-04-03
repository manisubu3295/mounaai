import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt, maskSecret } from '../crypto/crypto.service.js';
import { NotFoundError } from '../types/errors.js';
import { ProviderConfig } from '@pocketcomputer/shared-types';
import { UpsertLlmConfigInput } from '../validation/config.schema.js';
import { LLMProviderFactory } from '../llm/provider-factory.js';

export async function getLlmConfig(tenantId: string): Promise<ProviderConfig | null> {
  const config = await prisma.providerConfig.findFirst({
    where: { tenant_id: tenantId, is_active: true },
    include: { provider: true },
  });

  if (!config) return null;

  let decrypted = '';
  try { decrypted = decrypt(config.api_key_enc); } catch { /* key not decryptable */ }

  return {
    id: config.id,
    provider_id: config.provider_id,
    provider_name: config.provider.name,
    base_url: config.base_url,
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    timeout_ms: config.timeout_ms,
    is_active: config.is_active,
    test_status: config.test_status,
    last_tested_at: config.last_tested_at?.toISOString() ?? null,
    api_key_hint: decrypted ? maskSecret(decrypted) : null,
  };
}

export async function upsertLlmConfig(
  tenantId: string,
  input: UpsertLlmConfigInput
): Promise<ProviderConfig> {
  const provider = await prisma.llmProvider.findUnique({ where: { id: input.provider_id } });
  if (!provider) throw new NotFoundError('LLM Provider');

  const existing = await prisma.providerConfig.findUnique({
    where: { tenant_id_provider_id: { tenant_id: tenantId, provider_id: input.provider_id } },
  });

  const api_key_enc = input.api_key
    ? encrypt(input.api_key)
    : (existing?.api_key_enc ?? encrypt(''));

  const config = await prisma.providerConfig.upsert({
    where: {
      tenant_id_provider_id: { tenant_id: tenantId, provider_id: input.provider_id },
    },
    update: {
      api_key_enc,
      base_url: input.base_url ?? null,
      model: input.model,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
      timeout_ms: input.timeout_ms,
      test_status: 'UNTESTED',
    },
    create: {
      tenant_id: tenantId,
      provider_id: input.provider_id,
      api_key_enc,
      base_url: input.base_url ?? null,
      model: input.model,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
      timeout_ms: input.timeout_ms,
    },
    include: { provider: true },
  });

  const decrypted = decrypt(config.api_key_enc);
  return {
    id: config.id,
    provider_id: config.provider_id,
    provider_name: config.provider.name,
    base_url: config.base_url,
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    timeout_ms: config.timeout_ms,
    is_active: config.is_active,
    test_status: config.test_status,
    last_tested_at: config.last_tested_at?.toISOString() ?? null,
    api_key_hint: decrypted ? maskSecret(decrypted) : null,
  };
}

export async function testLlmConfig(tenantId: string): Promise<{ status: 'OK' | 'FAILED'; message?: string }> {
  const config = await prisma.providerConfig.findFirst({
    where: { tenant_id: tenantId, is_active: true },
    include: { provider: true },
  });

  if (!config) return { status: 'FAILED', message: 'No LLM configuration found.' };

  try {
    const provider = await LLMProviderFactory.resolve(tenantId);
    await provider.complete({
      messages: [{ role: 'user', content: 'Reply with the word OK only.' }],
      model: config.model,
      temperature: 0,
      max_tokens: 10,
    });

    await prisma.providerConfig.update({
      where: { id: config.id },
      data: { test_status: 'OK', last_tested_at: new Date() },
    });

    return { status: 'OK' };
  } catch (err) {
    await prisma.providerConfig.update({
      where: { id: config.id },
      data: { test_status: 'FAILED', last_tested_at: new Date() },
    });
    return { status: 'FAILED', message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function listProviders() {
  const providers = await prisma.llmProvider.findMany({ where: { is_active: true } });
  return providers.map((p: (typeof providers)[number]) => ({ id: p.id, name: p.name, default_url: p.default_url }));
}
