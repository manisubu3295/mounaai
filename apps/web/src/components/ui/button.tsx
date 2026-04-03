import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] hover:border-[hsl(var(--accent))]',
        ghost: 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]',
        destructive: 'bg-[hsl(var(--error))] text-white hover:bg-[hsl(var(--error))/90]',
        whatsapp: 'bg-[#25D366] text-white hover:bg-[#22bf5b]',
        link: 'text-[hsl(var(--accent))] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);

Button.displayName = 'Button';
