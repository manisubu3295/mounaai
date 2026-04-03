import { Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'What data can you help me access?',
  'Show me a summary of recent activity',
  'What connectors are configured?',
  'Help me understand my business data',
];

interface EmptyChatProps {
  onSuggestion: (text: string) => void;
}

export function EmptyChat({ onSuggestion }: EmptyChatProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.2)] flex items-center justify-center mb-4">
        <Sparkles className="w-5 h-5 text-[hsl(var(--accent-hover))]" />
      </div>

      <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))] mb-1">
        Ask me anything
      </h2>
      <p className="text-sm text-[hsl(var(--text-secondary))] mb-8 max-w-sm">
        I can help you query and understand your connected business data through natural language.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-4 py-3 text-sm text-left rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-2))] transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
