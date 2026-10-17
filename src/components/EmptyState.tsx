export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel = "重置筛选",
  onAction,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[16rem] w-full flex-col items-center justify-center rounded-2xl border border-[#e5dbce] bg-[#fffdf9] px-6 py-10 text-center shadow-xs sm:py-14"
    >
      {/* CSS 圆形占位（不用图片） */}
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e5dbce] bg-[#faf6ef] text-[#938273] shadow-inner sm:h-16 sm:w-16"
        aria-hidden="true"
      >
        <svg
          className="h-6 w-6 sm:h-7 sm:w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>

      <h3 className="mt-4 text-base font-bold text-[#1f1c19] sm:text-lg">
        {title}
      </h3>

      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#685d53] sm:text-sm">
          {description}
        </p>
      ) : null}

      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#29231f] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#342d27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a13f2d] focus-visible:ring-offset-2 sm:text-sm"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
