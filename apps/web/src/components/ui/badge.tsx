import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded px-[7px] py-[2px] text-[11px] font-medium leading-none transition-colors border',
  {
    variants: {
      variant: {
        default:  'bg-[hsl(var(--accent)/0.12)] border-[hsl(var(--accent)/0.25)] text-[hsl(var(--accent-hover))]',
        success:  'bg-[hsl(var(--success)/0.1)]  border-[hsl(var(--success)/0.25)] text-[hsl(var(--success))]',
        warning:  'bg-[hsl(var(--warning)/0.1)]  border-[hsl(var(--warning)/0.25)] text-[hsl(var(--warning))]',
        error:    'bg-[hsl(var(--error)/0.1)]    border-[hsl(var(--error)/0.25)]   text-[hsl(var(--error))]',
        model:    'bg-[hsl(var(--surface-2))]    border-[hsl(var(--border))]        text-[hsl(var(--text-secondary))] font-mono text-[10px]',
        free:     'bg-[hsl(var(--warning)/0.1)]  border-[hsl(var(--warning)/0.2)]  text-[hsl(var(--warning))]',
        pro:      'bg-[hsl(var(--accent)/0.12)]  border-[hsl(var(--accent)/0.25)]  text-[hsl(var(--accent-hover))]',
        api:      'bg-blue-500/10  border-blue-500/20  text-blue-400',
        db:       'bg-purple-500/10 border-purple-500/20 text-purple-400',
        outline:  'border-[hsl(var(--border-strong))] text-[hsl(var(--text-secondary))] bg-transparent',
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
