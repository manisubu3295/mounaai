import axios from 'axios';
import {
  ILLMProvider,
  LLMAgentMessage,
  LLMAgentRequest,
  LLMAgentResponse,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMMessage,
  LLMStreamRequest,
  LLMToolCall,
} from './interface.js';
import { LLMError } from '../types/errors.js';

interface GeminiConfig {
  api_key: string;
  base_url?: string | null;
  model: string;
  timeout_ms: number;
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { result: string } } };

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export class GeminiProvider implements ILLMProvider {
  name = 'gemini';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private config: GeminiConfig) {
    this.baseUrl = config.base_url?.replace(/\/$/, '') ??
      'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = config.api_key;
    this.timeoutMs = config.timeout_ms;
  }

  // ─── Simple completion ──────────────────────────────────────────────────────

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const start = Date.now();
    const contents = this.messagesFromSimple(req.messages);
    const url = `${this.baseUrl}/models/${req.model}:generateContent?key=${this.apiKey}`;

    const generationConfig: Record<string, unknown> = {
      temperature: req.temperature,
      maxOutputTokens: req.max_tokens,
    };

    if (req.response_mime_type) {
      generationConfig.responseMimeType = req.response_mime_type;
    }

    try {
      const response = await axios.post(
        url,
        {
          contents,
          generationConfig,
        },
        { timeout: this.timeoutMs }
      );

      const candidate = response.data?.candidates?.[0];
      if (!candidate) throw new LLMError('Gemini returned no candidates', 'RESPONSE_MALFORMED');

      const parts: GeminiPart[] = candidate.content?.parts ?? [];
      const content = parts
        .filter((part): part is { text: string } => 'text' in part)
        .map(part => part.text)
        .join('');
      const usage = response.data.usageMetadata ?? {};

      return {
        content,
        model: req.model,
        input_tokens: usage.promptTokenCount ?? 0,
        output_tokens: usage.candidatesTokenCount ?? 0,
        finish_reason: candidate.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
        latency_ms: Date.now() - start,
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ─── Tool-calling / agentic completion ──────────────────────────────────────

  async completeWithTools(req: LLMAgentRequest): Promise<LLMAgentResponse> {
    const start = Date.now();
    const contents = this.messagesFromAgent(req.messages);
    const url = `${this.baseUrl}/models/${req.model}:generateContent?key=${this.apiKey}`;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature: req.temperature, maxOutputTokens: req.max_tokens },
    };

    if (req.tools.length > 0) {
      body['tools'] = [{
        functionDeclarations: req.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }];
      body['tool_config'] = { function_calling_config: { mode: 'AUTO' } };
    }

    try {
      const response = await axios.post(url, body, { timeout: this.timeoutMs });

      const candidate = response.data?.candidates?.[0];
      if (!candidate) throw new LLMError('Gemini returned no candidates', 'RESPONSE_MALFORMED');

      const parts: GeminiPart[] = candidate.content?.parts ?? [];
      const usage = response.data.usageMetadata ?? {};

      const funcCallParts = parts.filter(
        (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
          'functionCall' in p
      );
      const textParts = parts.filter((p): p is { text: string } => 'text' in p);

      if (funcCallParts.length > 0) {
        const tool_calls: LLMToolCall[] = funcCallParts.map((p, i) => ({
          id: `gc_${i}_${Date.now()}`,
          name: p.functionCall.name,
          arguments: p.functionCall.args ?? {},
        }));

        return {
          content: null,
          tool_calls,
          model: req.model,
          input_tokens: usage.promptTokenCount ?? 0,
          output_tokens: usage.candidatesTokenCount ?? 0,
          finish_reason: 'tool_calls',
          latency_ms: Date.now() - start,
        };
      }

      return {
        content: textParts.map(p => p.text).join(''),
        tool_calls: [],
        model: req.model,
        input_tokens: usage.promptTokenCount ?? 0,
        output_tokens: usage.candidatesTokenCount ?? 0,
        finish_reason: candidate.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
        latency_ms: Date.now() - start,
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  // ─── Streaming completion ───────────────────────────────────────────────────

  async streamCompletion(req: LLMStreamRequest, onChunk: (text: string) => void): Promise<void> {
    const contents = this.messagesFromSimple(req.messages);
    const url = `${this.baseUrl}/models/${req.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;

    const response = await axios.post(
      url,
      { contents, generationConfig: { temperature: req.temperature, maxOutputTokens: req.max_tokens } },
      { timeout: this.timeoutMs, responseType: 'stream' }
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
            const parsed = JSON.parse(json) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) onChunk(text);
          } catch { /* skip malformed */ }
        }
      });
      response.data.on('end', resolve);
      response.data.on('error', reject);
    });
  }

  // ─── Message converters ─────────────────────────────────────────────────────

  private messagesFromSimple(messages: LLMMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
        contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
      } else {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }
    return contents;
  }

  private messagesFromAgent(messages: LLMAgentMessage[]): GeminiContent[] {
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
        contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });

      } else if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });

      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          contents.push({
            role: 'model',
            parts: msg.tool_calls.map(tc => ({
              functionCall: { name: tc.name, args: tc.arguments },
            })),
          });
        } else {
          contents.push({ role: 'model', parts: [{ text: msg.content ?? '' }] });
        }

      } else if (msg.role === 'tool') {
        // Gemini expects tool results as a user turn with functionResponse parts.
        // Consecutive tool results are grouped into one user turn.
        const funcResponsePart: GeminiPart = {
          functionResponse: { name: msg.name, response: { result: msg.content } },
        };
        const last = contents[contents.length - 1];
        if (last?.role === 'user' && last.parts.some(p => 'functionResponse' in p)) {
          last.parts.push(funcResponsePart);
        } else {
          contents.push({ role: 'user', parts: [funcResponsePart] });
        }
      }
    }

    return contents;
  }

  // ─── Error handling ─────────────────────────────────────────────────────────

  private wrapError(err: unknown): Error {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message ?? err.message;
      if (status === 400) return new LLMError(`Gemini bad request: ${msg}`, 'RESPONSE_MALFORMED');
      if (status === 401 || status === 403) return new LLMError('Invalid Gemini API key', 'INVALID_API_KEY');
      if (status === 429) return new LLMError('Gemini rate limit exceeded', 'RATE_LIMIT_EXCEEDED', true);
      if (err.code === 'ECONNABORTED') return new LLMError('Gemini request timed out', 'TIMEOUT');
      return new LLMError(`Gemini provider error: ${msg}`, 'PROVIDER_UNREACHABLE', true);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
