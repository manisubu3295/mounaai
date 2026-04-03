import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../types/errors.js';
import { Chat, ChatMessage, PaginatedResponse } from '@pocketcomputer/shared-types';

function formatChat(c: {
  id: string; title: string; status: string; created_at: Date; updated_at: Date;
  messages?: Array<{ content: string; role: string; created_at: Date }>;
}): Chat {
  const msgs = c.messages ?? [];
  const last = msgs.filter(m => m.role !== 'SYSTEM').sort((a, b) =>
    b.created_at.getTime() - a.created_at.getTime())[0];
  return {
    id: c.id,
    title: c.title,
    status: c.status as Chat['status'],
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
    ...(last ? { last_message: last.content.slice(0, 80) } : {}),
  };
}

function formatMessage(m: {
  id: string; chat_id: string; role: string; content: string;
  model_used?: string | null; latency_ms?: number | null; created_at: Date;
  metadata: unknown;
}): ChatMessage {
  const meta = (m.metadata !== null && typeof m.metadata === 'object'
    ? m.metadata
    : {}) as { sources?: ChatMessage['sources'] };
  return {
    id: m.id,
    chat_id: m.chat_id,
    role: m.role as ChatMessage['role'],
    content: m.content,
    created_at: m.created_at.toISOString(),
    ...(m.model_used !== undefined ? { model_used: m.model_used } : {}),
    ...(m.latency_ms !== undefined ? { latency_ms: m.latency_ms } : {}),
    ...(meta.sources !== undefined ? { sources: meta.sources } : {}),
  };
}

export async function listChats(
  userId: string,
  tenantId: string,
  page = 1,
  limit = 20
): Promise<PaginatedResponse<Chat>> {
  const skip = (page - 1) * limit;

  const [total, chats] = await Promise.all([
    prisma.chat.count({ where: { user_id: userId, tenant_id: tenantId, status: { not: 'DELETED' } } }),
    prisma.chat.findMany({
      where: { user_id: userId, tenant_id: tenantId, status: { not: 'DELETED' } },
      orderBy: { updated_at: 'desc' },
      skip,
      take: limit,
      include: {
        messages: { take: 1, orderBy: { created_at: 'desc' }, where: { role: { not: 'SYSTEM' } } },
      },
    }),
  ]);

  return {
    items: chats.map(formatChat),
    total,
    page,
    limit,
    has_more: skip + chats.length < total,
  };
}

export async function createChat(
  userId: string,
  tenantId: string,
  title?: string
): Promise<Chat> {
  const chat = await prisma.chat.create({
    data: { user_id: userId, tenant_id: tenantId, title: title ?? 'New Chat' },
  });
  return formatChat(chat);
}

export async function getChat(
  chatId: string,
  userId: string,
  tenantId: string
): Promise<{ chat: Chat; messages: ChatMessage[] }> {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });

  if (!chat || chat.status === 'DELETED') throw new NotFoundError('Chat');
  if (chat.user_id !== userId || chat.tenant_id !== tenantId) throw new ForbiddenError();

  return {
    chat: formatChat(chat),
    messages: chat.messages.map(formatMessage),
  };
}

export async function updateChat(
  chatId: string,
  userId: string,
  tenantId: string,
  data: { title?: string; status?: 'ACTIVE' | 'ARCHIVED' }
): Promise<Chat> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || chat.status === 'DELETED') throw new NotFoundError('Chat');
  if (chat.user_id !== userId || chat.tenant_id !== tenantId) throw new ForbiddenError();

  const updated = await prisma.chat.update({
    where: { id: chatId },
    data,
    include: { messages: { take: 1, orderBy: { created_at: 'desc' } } },
  });
  return formatChat(updated);
}

export async function deleteChat(chatId: string, userId: string, tenantId: string): Promise<void> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || chat.status === 'DELETED') throw new NotFoundError('Chat');
  if (chat.user_id !== userId || chat.tenant_id !== tenantId) throw new ForbiddenError();
  await prisma.chat.update({ where: { id: chatId }, data: { status: 'DELETED' } });
}

export async function autoNameChat(chatId: string, userMessage: string): Promise<void> {
  const title = userMessage.slice(0, 50).trim() + (userMessage.length > 50 ? '...' : '');
  await prisma.chat.update({ where: { id: chatId }, data: { title } });
}

export async function saveMessage(data: {
  chat_id: string;
  tenant_id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  model_used?: string;
  latency_ms?: number;
  tool_run_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessage> {
  const createData: Parameters<typeof prisma.chatMessage.create>[0]['data'] = {
    chat_id: data.chat_id,
    tenant_id: data.tenant_id,
    role: data.role,
    content: data.content,
  };

  if (data.model_used !== undefined) createData.model_used = data.model_used;
  if (data.latency_ms !== undefined) createData.latency_ms = data.latency_ms;
  if (data.tool_run_id !== undefined) createData.tool_run_id = data.tool_run_id;
  if (data.metadata !== undefined) createData.metadata = data.metadata as Prisma.InputJsonValue;

  const msg = await prisma.chatMessage.create({ data: createData });
  return formatMessage(msg);
}
