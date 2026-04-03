import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';
