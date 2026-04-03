export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] flex items-center justify-center flex-shrink-0 mt-1">
        <span className="text-[10px] font-bold text-[hsl(var(--accent-hover))]">AI</span>
      </div>
      <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl rounded-tl-sm px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--text-secondary))]"
              style={{ animation: `pulse_dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
          <span className="text-xs text-[hsl(var(--text-secondary))] ml-1">Thinking...</span>
        </div>
      </div>
    </div>
  );
}
