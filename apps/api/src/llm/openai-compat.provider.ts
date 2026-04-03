import axios from 'axios';
import {
  ILLMProvider,
  LLMAgentMessage,
  LLMAgentRequest,
  LLMAgentResponse,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamRequest,
  LLMToolCall,
} from './interface.js';
import { LLMError } from '../types/errors.js';

interface OpenAICompatConfig {
  api_key: string;
  base_url: string;
  timeout_ms: number;
}

// Covers: OpenAI, Azure OpenAI, Groq, Mistral, Together AI, Anthropic (via proxy), etc.
export class OpenAICompatProvider implements ILLMProvider {
  name = 'openai-compat';

  constructor(private config: OpenAICompatConfig) {}

  // ─── Simple completion ──────────────────────────────────────────────────────

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const start = Date.now();

    try {
      const response = await axios.post(
        `${this.config.base_url}/chat/completions`,
        {
          model: req.model,
          messages: req.messages,
          temperature: req.temperature,
          max_tokens: req.max_tokens,
        },
        {
          headers: { Authorization: `Bearer ${this.config.api_key}` },
          timeout: this.config.timeout_ms,
        }
      );

      const choice = response.data.choices?.[0];
      return {
        content: choice?.message?.content ?? '',
        model: response.data.model ?? req.model,
        input_tokens: response.data.usage?.prompt_tokens ?? 0,
        output_tokens: response.data.usage?.completion_tokens ?? 0,
        finish_reason: choice?.finish_reason === 'length' ? 'length' : 'stop',
        latency_ms: Date.now() - start,
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ─── Tool-calling / agentic completion ──────────────────────────────────────

  async completeWithTools(req: LLMAgentRequest): Promise<LLMAgentResponse> {
    const start = Date.now();

    const body: Record<string, unknown> = {
      model: req.model,
      messages: this.toOpenAIMessages(req.messages),
      temperature: req.temperature,
      max_tokens: req.max_tokens,
    };

    if (req.tools.length > 0) {
      body['tools'] = req.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body['tool_choice'] = 'auto';
    }

    try {
      const response = await axios.post(
        `${this.config.base_url}/chat/completions`,
        body,
        {
          headers: { Authorization: `Bearer ${this.config.api_key}` },
          timeout: this.config.timeout_ms,
        }
      );

      const choice = response.data.choices?.[0];
      const message = choice?.message;
      const usage = response.data.usage ?? {};

      if (choice?.finish_reason === 'tool_calls' && message?.tool_calls?.length) {
        const tool_calls: LLMToolCall[] = message.tool_calls.map(
          (tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: (() => {
              try { return JSON.parse(tc.function.arguments) as Record<string, unknown>; }
              catch { return {}; }
            })(),
          })
        );

        return {
          content: message.content ?? null,
          tool_calls,
          model: response.data.model ?? req.model,
          input_tokens: usage.prompt_tokens ?? 0,
          output_tokens: usage.completion_tokens ?? 0,
          finish_reason: 'tool_calls',
          latency_ms: Date.now() - start,
        };
      }

      return {
        content: message?.content ?? '',
        tool_calls: [],
        model: response.data.model ?? req.model,
        input_tokens: usage.prompt_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? 0,
        finish_reason: choice?.finish_reason === 'length' ? 'length' : 'stop',
        latency_ms: Date.now() - start,
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ─── Streaming completion ───────────────────────────────────────────────────

  async streamCompletion(req: LLMStreamRequest, onChunk: (text: string) => void): Promise<void> {
    const response = await axios.post(
      `${this.config.base_url}/chat/completions`,
      {
        model: req.messages[0] ? req.messages[0] : req.messages, // use messages
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: true,
      },
      {
        headers: { Authorization: `Bearer ${this.config.api_key}` },
        timeout: this.config.timeout_ms,
        responseType: 'stream',
      }
    );

    await new Promise<void>((resolve, reject) => {
      let buffer = '';
      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (!json || json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json) as { choices?: Array<{ delta?: { content?: string } }> };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onChunk(text);
          } catch { /* skip */ }
        }
      });
      response.data.on('end', resolve);
      response.data.on('error', reject);
    });
  }

  // ─── Message converter ──────────────────────────────────────────────────────

  private toOpenAIMessages(messages: LLMAgentMessage[]): unknown[] {
    return messages.map(msg => {
      if (msg.role === 'system') return { role: 'system', content: msg.content };
      if (msg.role === 'user')   return { role: 'user', content: msg.content };

      if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          return {
            role: 'assistant',
            content: msg.content ?? null,
            tool_calls: msg.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          };
        }
        return { role: 'assistant', content: msg.content };
      }

      if (msg.role === 'tool') {
        return { role: 'tool', tool_call_id: msg.call_id, content: msg.content };
      }

      return {};
    });
  }

  // ─── Error handling ─────────────────────────────────────────────────────────

  private wrapError(err: unknown): Error {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401) return new LLMError('Invalid API key', 'INVALID_API_KEY');
      if (status === 429) return new LLMError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', true);
      if (err.code === 'ECONNABORTED') return new LLMError('Request timed out', 'TIMEOUT');
      return new LLMError(`Provider error: ${err.message}`, 'PROVIDER_UNREACHABLE', true);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
