import { apiClient, getAccessToken } from '@/lib/api-client';
import type { Chat, ChatMessage, PaginatedResponse } from '@pocketcomputer/shared-types';

export async function listChats(page = 1, limit = 20): Promise<PaginatedResponse<Chat>> {
  const res = await apiClient.get<{ data: PaginatedResponse<Chat> }>('/chats', {
    params: { page, limit },
  });
  return res.data.data;
}

export async function createChat(title?: string): Promise<Chat> {
  const res = await apiClient.post<{ data: { chat: Chat } }>('/chats', { title });
  return res.data.data.chat;
}

export async function getChat(id: string): Promise<{ chat: Chat; messages: ChatMessage[] }> {
  const res = await apiClient.get<{ data: { chat: Chat; messages: ChatMessage[] } }>(`/chats/${id}`);
  return res.data.data;
}

export async function updateChat(id: string, data: { title?: string; status?: 'ACTIVE' | 'ARCHIVED' }): Promise<Chat> {
  const res = await apiClient.patch<{ data: { chat: Chat } }>(`/chats/${id}`, data);
  return res.data.data.chat;
}

export async function deleteChat(id: string): Promise<void> {
  await apiClient.delete(`/chats/${id}`);
}

export async function sendMessage(chatId: string, content: string): Promise<ChatMessage> {
  const res = await apiClient.post<{ data: { message: ChatMessage } }>(
    `/chats/${chatId}/messages`,
    { content }
  );
  return res.data.data.message;
}

export type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; error: string };

export function sendMessageStream(
  chatId: string,
  content: string,
  onChunk: (text: string) => void,
  onDone: (message: ChatMessage) => void,
  onError: (error: string) => void
): () => void {
  const token = getAccessToken();
  const ctrl = new AbortController();

  (async () => {
    try {
      const resp = await fetch(`/api/v1/chats/${chatId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
        signal: ctrl.signal,
        credentials: 'include',
      });

      if (!resp.ok || !resp.body) {
        onError(`HTTP ${resp.status}`);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            const evt = JSON.parse(json) as StreamEvent;
            if (evt.type === 'chunk') onChunk(evt.text);
            else if (evt.type === 'done') onDone(evt.message);
            else if (evt.type === 'error') onError(evt.error);
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError((err as Error).message ?? 'Stream error');
      }
    }
  })();

  return () => ctrl.abort();
}
