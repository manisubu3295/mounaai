import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check, ChevronDown, ChevronUp, Database, Globe } from 'lucide-react';
import type { ChatMessage } from '@pocketcomputer/shared-types';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === 'USER';

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('group flex animate-fade-in', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mr-3 mt-1 flex-shrink-0 w-7 h-7 rounded-full bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] flex items-center justify-center">
          <span className="text-[10px] font-bold text-[hsl(var(--accent-hover))]">AI</span>
        </div>
      )}

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end max-w-[72%]' : 'items-start max-w-[80%]')}>
        <div
          className={cn(
            'px-4 py-3 text-sm leading-6',
            isUser
              ? 'bg-[hsl(var(--surface-2))] rounded-2xl rounded-br-sm text-[hsl(var(--text-primary))]'
              : 'bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl rounded-tl-sm text-[hsl(var(--text-primary))]'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming ? (
            <p className="whitespace-pre-wrap">{message.content}<span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse" /></p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  return isBlock ? (
                    <pre className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg p-3 overflow-x-auto my-2">
                      <code className="font-mono text-xs text-[hsl(var(--text-primary))]">{children}</code>
                    </pre>
                  ) : (
                    <code className="font-mono text-xs bg-[hsl(var(--background))] px-1.5 py-0.5 rounded text-[hsl(var(--accent-hover))]">
                      {children}
                    </code>
                  );
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full text-xs border-collapse">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-[hsl(var(--border))] px-3 py-1.5 bg-[hsl(var(--surface-2))] text-left font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-[hsl(var(--border))] px-3 py-1.5">{children}</td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Meta row */}
        <div className={cn('flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[11px] text-[hsl(var(--text-disabled))]">
            {formatRelativeTime(message.created_at)}
          </span>

          {message.model_used && (
            <Badge variant="model">{message.model_used}</Badge>
          )}

          {!isUser && (
            <button
              onClick={copy}
              className="p-1 rounded text-[hsl(var(--text-disabled))] hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1 text-[11px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent-hover))] px-1 transition-colors"
            >
              {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
            </button>

            {sourcesOpen && (
              <div className="mt-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-3 space-y-2">
                {message.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {s.connector_type === 'API' ? (
                      <Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    ) : (
                      <Database className="w-3 h-3 text-purple-400 flex-shrink-0" />
                    )}
                    <span className="text-[11px] text-[hsl(var(--text-secondary))]">
                      <span className="font-medium text-[hsl(var(--text-primary))]">{s.connector_name}</span>
                      {' · '}{s.endpoint_or_query}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
