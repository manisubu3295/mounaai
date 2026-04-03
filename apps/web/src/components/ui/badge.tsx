import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent-hover))]',
        success: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]',
        warning: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]',
        error: 'bg-[hsl(var(--error)/0.15)] text-[hsl(var(--error))]',
        model: 'bg-[hsl(var(--surface-2))] border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] font-mono text-[10px]',
        free: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]',
        pro: 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent-hover))]',
        api: 'bg-blue-500/10 text-blue-400',
        db: 'bg-purple-500/10 text-purple-400',
        outline: 'border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
