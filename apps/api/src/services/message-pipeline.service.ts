import { prisma } from '../lib/prisma.js';
import { LLMProviderFactory } from '../llm/provider-factory.js';
import { ANALYST_SYSTEM_PROMPT } from '../llm/context-assembler.js';
import { ToolRegistry } from '../llm/tool-registry.js';
import { auditLog } from './audit.service.js';
import { saveMessage, autoNameChat } from './chat.service.js';
import { LLMAgentMessage, LLMMessage } from '../llm/interface.js';
import { ChatMessage, MessageSource } from '@pocketcomputer/shared-types';
import { logger } from '../lib/logger.js';

/** Maximum LLM→tool→LLM turns before the agent gives up */
const MAX_AGENT_TURNS = 5;

interface PipelineContext {
  chatId: string;
  tenantId: string;
  userId: string;
  userMessage: string;
  chatHistory: ChatMessage[];
  isFirstMessage: boolean;
}

export async function executePipeline(ctx: PipelineContext): Promise<ChatMessage> {
  // ── 1. Persist the user's message ──────────────────────────────────────────
  await saveMessage({
    chat_id: ctx.chatId,
    tenant_id: ctx.tenantId,
    role: 'USER',
    content: ctx.userMessage,
  });
  if (ctx.isFirstMessage) {
    await autoNameChat(ctx.chatId, ctx.userMessage);
  }

  // ── 2. Build connector tools ────────────────────────────────────────────────
  const registry = new ToolRegistry();
  const tools = await registry.buildTools(ctx.tenantId);

  // ── 3. Get LLM config ───────────────────────────────────────────────────────
  const llmConfig = await prisma.providerConfig.findFirst({
    where: { tenant_id: ctx.tenantId, is_active: true },
  });
  const provider = await LLMProviderFactory.resolve(ctx.tenantId);

  // ── 4. Seed agent message history ───────────────────────────────────────────
  const agentMessages: LLMAgentMessage[] = [
    { role: 'system', content: ANALYST_SYSTEM_PROMPT },
    ...ctx.chatHistory.slice(-10).flatMap((msg): LLMAgentMessage[] => {
      if (msg.role === 'USER')      return [{ role: 'user',      content: msg.content }];
      if (msg.role === 'ASSISTANT') return [{ role: 'assistant', content: msg.content }];
      return [];
    }),
    { role: 'user', content: ctx.userMessage },
  ];

  // ── 5. Agent loop ───────────────────────────────────────────────────────────
  const allSources: MessageSource[] = [];
  const allMaskedFields: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatencyMs = 0;
  let lastModel = llmConfig?.model ?? 'gemini-2.0-flash';
  let finalContent = '';
  let agentTurns = 0;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const response = await provider.completeWithTools({
      messages: agentMessages,
      tools,
      model: llmConfig?.model ?? 'gemini-2.0-flash',
      temperature: llmConfig?.temperature ?? 0.3,
      max_tokens: llmConfig?.max_tokens ?? 2048,
    });

    totalInputTokens  += response.input_tokens;
    totalOutputTokens += response.output_tokens;
    totalLatencyMs    += response.latency_ms;
    lastModel          = response.model;

    // LLM returned a final answer
    if (response.finish_reason !== 'tool_calls' || response.tool_calls.length === 0) {
      finalContent = response.content ?? '';
      break;
    }

    agentTurns++;

    // Add the assistant's decision (tool calls) to history
    agentMessages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.tool_calls,
    });

    // Execute all requested tool calls in parallel
    const toolResults = await Promise.all(
      response.tool_calls.map(call =>
        registry.executeTool(ctx.tenantId, ctx.chatId, call)
      )
    );

    for (const result of toolResults) {
      allSources.push(result.source);
      allMaskedFields.push(...result.masked_fields);

      if (result.error) {
        logger.warn('Tool returned error', { tool: result.tool_name, error: result.error });
      }

      // Feed result back to the LLM
      agentMessages.push({
        role: 'tool',
        call_id: result.tool_call_id,
        name: result.tool_name,
        content: result.content,
      });
    }
  }

  // Safeguard: agent loop exhausted without a final text response
  if (!finalContent) {
    finalContent =
      'I was unable to complete the analysis within the allowed steps. ' +
      'Please try rephrasing your question or narrowing the scope.';
  }

  // ── 6. Persist assistant response ───────────────────────────────────────────
  const assistantMsg = await saveMessage({
    chat_id: ctx.chatId,
    tenant_id: ctx.tenantId,
    role: 'ASSISTANT',
    content: finalContent,
    model_used: lastModel,
    latency_ms: totalLatencyMs,
    metadata: { sources: allSources },
  });

  // ── 7. Audit log ─────────────────────────────────────────────────────────────
  await auditLog({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    action: 'llm.call',
    resource_type: 'chat',
    resource_id: ctx.chatId,
    status: 'SUCCESS',
    payload: {
      model: lastModel,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      latency_ms: totalLatencyMs,
      agent_turns: agentTurns,
      connectors_used: [...new Set(allSources.map(s => s.connector_id))],
      masked_fields_count: allMaskedFields.length,
    },
  });

  return assistantMsg;
}

/**
 * Streaming variant: runs the agentic tool loop synchronously (same as executePipeline),
 * then streams the final text response token-by-token via SSE.
 * Calls onChunk() for each text delta, then onDone() when complete.
 */
export async function executePipelineStream(
  ctx: PipelineContext,
  onChunk: (text: string) => void,
  onDone: (msg: ChatMessage) => void,
  onError: (err: Error) => void
): Promise<void> {
  try {
    // Persist user message
    await saveMessage({
      chat_id: ctx.chatId,
      tenant_id: ctx.tenantId,
      role: 'USER',
      content: ctx.userMessage,
    });
    if (ctx.isFirstMessage) {
      await autoNameChat(ctx.chatId, ctx.userMessage);
    }

    const registry = new ToolRegistry();
    const tools = await registry.buildTools(ctx.tenantId);
    const llmConfig = await prisma.providerConfig.findFirst({
      where: { tenant_id: ctx.tenantId, is_active: true },
    });
    const provider = await LLMProviderFactory.resolve(ctx.tenantId);

    const agentMessages: LLMAgentMessage[] = [
      { role: 'system', content: ANALYST_SYSTEM_PROMPT },
      ...ctx.chatHistory.slice(-10).flatMap((msg): LLMAgentMessage[] => {
        if (msg.role === 'USER')      return [{ role: 'user',      content: msg.content }];
        if (msg.role === 'ASSISTANT') return [{ role: 'assistant', content: msg.content }];
        return [];
      }),
      { role: 'user', content: ctx.userMessage },
    ];

    const allSources: MessageSource[] = [];
    const allMaskedFields: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalLatencyMs = 0;
    let lastModel = llmConfig?.model ?? 'gemini-2.0-flash';
    let agentTurns = 0;
    // After tool calls complete, collect final non-streaming content here
    // Only stream the very last text response
    let toolPhaseMessages = agentMessages;

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      const response = await provider.completeWithTools({
        messages: toolPhaseMessages,
        tools,
        model: llmConfig?.model ?? 'gemini-2.0-flash',
        temperature: llmConfig?.temperature ?? 0.3,
        max_tokens: llmConfig?.max_tokens ?? 2048,
      });

      totalInputTokens  += response.input_tokens;
      totalOutputTokens += response.output_tokens;
      totalLatencyMs    += response.latency_ms;
      lastModel          = response.model;

      if (response.finish_reason !== 'tool_calls' || response.tool_calls.length === 0) {
        // We have the final prompt context. Now re-stream the final answer.
        const streamMessages: LLMMessage[] = toolPhaseMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : m.role === 'tool' ? 'user' : m.role as 'user' | 'system' | 'assistant',
          content: m.role === 'tool' ? `Tool result (${m.name}): ${m.content}` : (m.role === 'assistant' ? (m.content ?? '') : m.content as string),
        }));
        let streamedContent = '';
        const streamStart = Date.now();
        await provider.streamCompletion(
          {
            messages: streamMessages,
            model: llmConfig?.model ?? 'gemini-2.0-flash',
            temperature: llmConfig?.temperature ?? 0.3,
            max_tokens: llmConfig?.max_tokens ?? 2048,
          },
          (chunk) => {
            streamedContent += chunk;
            onChunk(chunk);
          }
        );
        totalLatencyMs += Date.now() - streamStart;
        if (!streamedContent) streamedContent = response.content ?? '';

        const assistantMsg = await saveMessage({
          chat_id: ctx.chatId,
          tenant_id: ctx.tenantId,
          role: 'ASSISTANT',
          content: streamedContent,
          model_used: lastModel,
          latency_ms: totalLatencyMs,
          metadata: { sources: allSources },
        });

        await auditLog({
          tenant_id: ctx.tenantId,
          user_id: ctx.userId,
          action: 'llm.call',
          resource_type: 'chat',
          resource_id: ctx.chatId,
          status: 'SUCCESS',
          payload: {
            model: lastModel,
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            latency_ms: totalLatencyMs,
            agent_turns: agentTurns,
            connectors_used: [...new Set(allSources.map(s => s.connector_id))],
            masked_fields_count: allMaskedFields.length,
            streamed: true,
          },
        });

        onDone(assistantMsg);
        return;
      }

      agentTurns++;
      toolPhaseMessages = [...toolPhaseMessages];
      toolPhaseMessages.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls });

      const toolResults = await Promise.all(
        response.tool_calls.map(call => registry.executeTool(ctx.tenantId, ctx.chatId, call))
      );

      for (const result of toolResults) {
        allSources.push(result.source);
        allMaskedFields.push(...result.masked_fields);
        toolPhaseMessages.push({ role: 'tool', call_id: result.tool_call_id, name: result.tool_name, content: result.content });
      }
    }

    // Exhausted turns with no final text
    const fallback = 'I was unable to complete the analysis within the allowed steps. Please try rephrasing your question.';
    onChunk(fallback);
    const assistantMsg = await saveMessage({
      chat_id: ctx.chatId,
      tenant_id: ctx.tenantId,
      role: 'ASSISTANT',
      content: fallback,
      model_used: lastModel,
      latency_ms: totalLatencyMs,
      metadata: { sources: allSources },
    });
    onDone(assistantMsg);
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
