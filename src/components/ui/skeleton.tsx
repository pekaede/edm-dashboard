import type * as React from "react";
import { cn } from "../../lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[var(--color-slate-200)]/70",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
