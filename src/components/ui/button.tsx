import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--control-active-bg)] text-[var(--text-inverse)] shadow-xs hover:bg-[var(--color-slate-800)]",
        destructive:
          "border border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error)] shadow-xs hover:opacity-90",
        outline:
          "border border-[var(--control-border)] bg-[var(--control-bg)] text-[var(--text-control)] shadow-xs hover:border-[var(--control-hover-border)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]",
        secondary:
          "border border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-body)] shadow-xs hover:bg-[var(--color-slate-100)] hover:text-[var(--text-heading)]",
        ghost:
          "text-[var(--text-body)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--text-heading)]",
        link: "text-[var(--accent-ink)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-11 rounded-xl px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
