import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-sm text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = 'Input';
