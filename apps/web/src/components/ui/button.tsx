import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--background))] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent-hover))] shadow-[0_1px_3px_hsl(var(--accent)/0.4)]',
        secondary:
          'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--surface-3))]',
        ghost:
          'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-primary))]',
        destructive:
          'bg-[hsl(var(--error))] text-white hover:opacity-90 shadow-[0_1px_3px_hsl(var(--error)/0.35)]',
        whatsapp:
          'bg-[#25D366] text-white hover:bg-[#22bf5b] shadow-sm',
        link:
          'text-[hsl(var(--accent))] underline-offset-4 hover:underline p-0 h-auto shadow-none',
      },
      size: {
        default: 'h-[34px] px-4 py-2',
        sm:      'h-[28px] px-3 text-[12px]',
        lg:      'h-[40px] px-5 text-[14px]',
        icon:    'h-[32px] w-[32px] p-0',
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
