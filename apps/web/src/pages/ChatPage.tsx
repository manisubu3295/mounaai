import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { EmptyChat } from '@/components/chat/EmptyChat';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { getChat, sendMessageStream } from '@/services/chat.service';
import type { ChatMessage } from '@pocketcomputer/shared-types';

export function ChatPage() {
  const { id: chatId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId!),
    enabled: !!chatId,
  });

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.messages, pendingMessage, streamingContent]);

  // Cancel any in-flight stream when unmounting or switching chats
  useEffect(() => {
    return () => {
      cancelStreamRef.current?.();
    };
  }, [chatId]);

  const handleSend = useCallback((content: string) => {
    if (!chatId || isSending) return;

    setPendingMessage(content);
    setStreamingContent('');
    setSendError(null);
    setIsSending(true);

    const cancel = sendMessageStream(
      chatId,
      content,
      (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      (msg: ChatMessage) => {
        setPendingMessage(null);
        setStreamingContent('');
        setIsSending(false);
        cancelStreamRef.current = null;
        // Update cache with the new message
        qc.setQueryData(['chat', chatId], (old: typeof data) => {
          if (!old) return old;
          return { ...old, messages: [...old.messages, msg] };
        });
        void qc.invalidateQueries({ queryKey: ['chats'] });
      },
      (error) => {
        setPendingMessage(null);
        setStreamingContent('');
        setIsSending(false);
        cancelStreamRef.current = null;
        setSendError(error ?? 'Failed to send message. Please try again.');
      }
    );

    cancelStreamRef.current = cancel;
  }, [chatId, isSending, qc, data]);

  // No chat selected
  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">💬</span>
            </div>
            <h2 className="text-base font-semibold text-[hsl(var(--text-primary))] mb-1">No chat selected</h2>
            <p className="text-sm text-[hsl(var(--text-secondary))]">Select a conversation from the sidebar or create a new one.</p>
          </div>
        </div>
      </div>
    );
  }

  const messages = data?.messages?.filter((m) => m.role !== 'SYSTEM') ?? [];
  const chat = data?.chat;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thread header */}
      {chat && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--border))] flex-shrink-0">
          <h1 className="text-sm font-semibold text-[hsl(var(--text-primary))] truncate">{chat.title}</h1>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
          </div>
        )}

        {!isLoading && messages.length === 0 && !isSending && (
          <EmptyChat onSuggestion={handleSend} />
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Optimistic user message while waiting */}
        {isSending && pendingMessage && (
          <MessageBubble
            message={{
              id: 'pending-user',
              chat_id: chatId,
              role: 'USER',
              content: pendingMessage,
              created_at: new Date().toISOString(),
            }}
          />
        )}

        {/* Streaming assistant bubble */}
        {isSending && streamingContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              chat_id: chatId,
              role: 'ASSISTANT',
              content: streamingContent,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Typing indicator while waiting for first token */}
        {isSending && !streamingContent && (
          <TypingIndicator />
        )}
      </div>

      {/* Error bar */}
      {sendError && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--error)/0.1)] border border-[hsl(var(--error)/0.3)] text-xs text-[hsl(var(--error))]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {sendError}
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isSending} />
    </div>
  );
}
