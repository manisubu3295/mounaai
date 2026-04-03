import { apiClient } from '@/lib/api-client';
import type { ProviderConfig, LLMProvider } from '@pocketcomputer/shared-types';

export async function getLlmConfig(): Promise<ProviderConfig | null> {
  const res = await apiClient.get<{ data: { config: ProviderConfig | null } }>('/settings/llm');
  return res.data.data.config;
}

export async function getProviders(): Promise<LLMProvider[]> {
  const res = await apiClient.get<{ data: { providers: LLMProvider[] } }>('/settings/llm/providers');
  return res.data.data.providers;
}

export async function upsertLlmConfig(data: {
  provider_id: string;
  api_key?: string;
  base_url?: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
}): Promise<ProviderConfig> {
  const res = await apiClient.put<{ data: { config: ProviderConfig } }>('/settings/llm', data);
  return res.data.data.config;
}

export async function testLlmConfig(): Promise<{ status: 'OK' | 'FAILED'; message?: string }> {
  const res = await apiClient.post<{ data: { status: 'OK' | 'FAILED'; message?: string } }>('/settings/llm/test');
  return res.data.data;
}
