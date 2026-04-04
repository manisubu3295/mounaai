// ─── Simple completion ────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model: string;
  temperature: number;
  max_tokens: number;
  response_mime_type?: 'application/json' | 'text/plain';
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  finish_reason: 'stop' | 'length' | 'error';
  latency_ms: number;
}

// ─── Tool / agentic completion ────────────────────────────────────────────────

export interface LLMTool {
  /** Must match /^[a-zA-Z0-9_-]{1,64}$/ */
  name: string;
  description: string;
  /** JSON Schema object describing the tool's parameters */
  parameters: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type LLMAgentMessage =
  | { role: 'system';    content: string }
  | { role: 'user';      content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LLMToolCall[] }
  | { role: 'tool';      call_id: string; name: string; content: string };

export interface LLMAgentRequest {
  messages: LLMAgentMessage[];
  /** Empty array = no tools, just do a standard completion */
  tools: LLMTool[];
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface LLMAgentResponse {
  /** null when the response is a tool call */
  content: string | null;
  tool_calls: LLMToolCall[];
  model: string;
  input_tokens: number;
  output_tokens: number;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'error';
  latency_ms: number;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

export interface LLMStreamRequest {
  messages: LLMMessage[];
  model: string;
  temperature: number;
  max_tokens: number;
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface ILLMProvider {
  name: string;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  completeWithTools(req: LLMAgentRequest): Promise<LLMAgentResponse>;
  /** Stream tokens as they arrive; calls onChunk for each text delta */
  streamCompletion(req: LLMStreamRequest, onChunk: (text: string) => void): Promise<void>;
}
