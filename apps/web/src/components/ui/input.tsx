import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-[34px] w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-3 py-2 text-[13px] text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-disabled))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.5)] focus:border-[hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Input.displayName = 'Input';
