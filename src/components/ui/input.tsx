import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        lg: 'h-10',
        default: 'h-9',
        sm: 'h-8',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    Omit<VariantProps<typeof inputVariants>, 'size'> {
  variantSize?: VariantProps<typeof inputVariants>['size'];
}
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, variantSize, type, ...props }, ref) => {
  return <input type={type} className={cn(inputVariants({ size: variantSize }), className)} ref={ref} {...props} />;
});
Input.displayName = 'Input';

export { Input, inputVariants };
