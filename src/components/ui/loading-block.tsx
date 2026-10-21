import type * as React from "react";
import { cn } from "../../lib/utils";
import { Skeleton } from "./skeleton";

export interface LoadingBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 标题骨架行宽度，设为 false 则不显示标题行。默认 "w-1/3" */
  titleWidth?: string | false;
  /** 内容骨架行数，默认 3 行 */
  lines?: number;
  /** 是否带卡片边框背景容器（与现有 Card / EmptyState 容器质感一致），默认 true */
  card?: boolean;
  /** 自定义内容行宽数组（循环匹配），未指定时使用自然参差宽度 */
  lineWidths?: string[];
}

const DEFAULT_LINE_WIDTHS = ["w-full", "w-4/5", "w-3/5", "w-5/6", "w-2/3"];

export function LoadingBlock({
  titleWidth = "w-1/3",
  lines = 3,
  card = true,
  lineWidths = DEFAULT_LINE_WIDTHS,
  className,
  ...props
}: LoadingBlockProps) {
  const lineCount = Math.max(0, lines);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        card
          ? "flex min-h-[12rem] w-full flex-col justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-xs sm:p-8"
          : "flex w-full flex-col justify-center space-y-4",
        className
      )}
      {...props}
    >
      {titleWidth !== false ? (
        <div className="mb-4 space-y-2">
          <Skeleton
            className={cn(
              "h-5 rounded-md",
              typeof titleWidth === "string" ? titleWidth : "w-1/3"
            )}
          />
        </div>
      ) : null}

      {lineCount > 0 ? (
        <div className="space-y-3">
          {Array.from({ length: lineCount }).map((_, index) => {
            const widthClass =
              lineWidths[index % (lineWidths.length || 1)] ?? "w-full";
            return (
              <Skeleton
                key={index}
                className={cn("h-4 rounded-md", widthClass)}
              />
            );
          })}
        </div>
      ) : null}

      <span className="sr-only">Loading...</span>
    </div>
  );
}
