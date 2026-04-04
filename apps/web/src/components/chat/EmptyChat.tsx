import { Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'How is my business doing today?',
  'Show me what happened this week',
  'Are there any problems I should know about?',
  'What should I focus on right now?',
];

interface EmptyChatProps {
  onSuggestion: (text: string) => void;
}

export function EmptyChat({ onSuggestion }: EmptyChatProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.2)] flex items-center justify-center mb-4">
        <Sparkles className="w-5 h-5 text-[hsl(var(--accent-hover))]" />
      </div>

      <h2 className="text-[17px] font-semibold text-[hsl(var(--text-primary))] mb-1">
        Ask me anything about your business
      </h2>
      <p className="text-[13px] text-[hsl(var(--text-secondary))] mb-7 max-w-sm leading-relaxed">
        Just type your question in plain English. You don't need to know any technical terms — I'll figure it out.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-4 py-3 text-[13px] text-left rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-2))] transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
