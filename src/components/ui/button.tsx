import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-semibold transition-[background-color,color,box-shadow,transform] duration-fast disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-button-press hover:bg-primary/90 active:translate-y-px',
        destructive:
          'bg-destructive text-destructive-foreground shadow-button-press hover:bg-destructive/90 active:translate-y-px',
        outline:
          'border border-input bg-transparent text-foreground shadow-button-inset hover:bg-accent hover:text-accent-foreground active:translate-y-px',
        secondary:
          'bg-secondary text-secondary-foreground border border-border shadow-button-press hover:bg-secondary/80 active:translate-y-px',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[42px] rounded-lg px-[18px] gap-2 text-sm tracking-[-0.005em]',
        sm: 'h-[34px] rounded-md px-[13px] gap-1.5 text-[13px] tracking-[-0.005em]',
        lg: 'h-12 rounded-lg px-8 gap-2 text-sm tracking-[-0.005em]',
        icon: 'h-10 w-10 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
