import { prisma } from '../lib/prisma.js';
import { decrypt } from '../crypto/crypto.service.js';
import { GeminiProvider } from './gemini.provider.js';
import { OpenAICompatProvider } from './openai-compat.provider.js';
import { ILLMProvider } from './interface.js';
import { AppError } from '../types/errors.js';

export class LLMProviderFactory {
  static async resolve(tenantId: string): Promise<ILLMProvider> {
    const config = await prisma.providerConfig.findFirst({
      where: { tenant_id: tenantId, is_active: true },
      include: { provider: true },
    });

    if (!config) {
      throw new AppError(
        'LLM_NOT_CONFIGURED',
        'No LLM provider is configured. Add your API key in Settings.',
        422
      );
    }

    const apiKey = decrypt(config.api_key_enc);
    const baseUrl = config.base_url ?? config.provider.default_url;

    switch (config.provider.name) {
      case 'gemini':
        return new GeminiProvider({ api_key: apiKey, base_url: baseUrl, model: config.model, timeout_ms: config.timeout_ms });
      default:
        return new OpenAICompatProvider({ api_key: apiKey, base_url: baseUrl, timeout_ms: config.timeout_ms });
    }
  }
}
