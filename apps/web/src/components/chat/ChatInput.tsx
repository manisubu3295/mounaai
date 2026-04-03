import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_LENGTH = 4000;

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value.slice(0, MAX_LENGTH));
    // Auto-resize
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }
  };

  const pct = value.length / MAX_LENGTH;

  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-3 focus-within:border-[hsl(var(--accent))] transition-colors">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder={placeholder ?? 'Ask me anything... (⌘Enter to send)'}
            disabled={disabled}
            rows={1}
            className="flex-1 border-0 bg-transparent p-0 focus:ring-0 resize-none text-sm min-h-[24px] max-h-[140px]"
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            {pct > 0.8 && (
              <span className={cn('text-[11px]', pct > 0.95 ? 'text-[hsl(var(--error))]' : 'text-[hsl(var(--text-secondary))]')}>
                {value.length}/{MAX_LENGTH}
              </span>
            )}
            <Button
              size="icon"
              onClick={submit}
              disabled={!value.trim() || disabled}
              className="h-8 w-8 flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-[hsl(var(--text-disabled))] text-center mt-2">
          PocketComputer may make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
