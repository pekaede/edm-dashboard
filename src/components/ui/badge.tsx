import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--control-focus)] focus:ring-offset-2 focus:ring-offset-[var(--control-focus-offset)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--control-active-bg)] text-[var(--text-inverse)] shadow-xs",
        secondary:
          "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-body)]",
        destructive:
          "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error)]",
        outline:
          "border-[var(--border-default)] text-[var(--text-heading)]",
        success:
          "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)]",
        warning:
          "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
