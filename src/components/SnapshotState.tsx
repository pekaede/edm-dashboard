import type { SnapshotResult } from "../snapshot";
import { EmptyState } from "./EmptyState";

function isConfigError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /配置|env|VITE_|Supabase 本地环境/i.test(error);
}

export type SnapshotStateProps = Pick<SnapshotResult<unknown>, "status" | "error" | "retry"> & {
  loadingText?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SnapshotState({
  status,
  error,
  retry,
  loadingText,
  isEmpty,
  emptyTitle,
  emptyDescription,
  actionLabel,
  onAction,
}: SnapshotStateProps) {
  // 1. P0-06 空态判断：使用 EmptyState 组件
  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle ?? "暂无快照数据"}
        description={emptyDescription ?? "当前无可用快照记录。"}
        actionLabel={actionLabel ?? (onAction ? "重置筛选" : "重新拉取")}
        onAction={onAction ?? retry}
      />
    );
  }

  // 2. 就绪状态无须占位
  if (status === "ready") return null;

  // 3. 首次加载状态：无假零、无 NaN、无永久空白
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[14rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-6 py-10 text-center shadow-xs"
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--accent-ink)]"
          aria-hidden="true"
        >
          <svg
            className="h-6 w-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          {loadingText || "正在加载快照数据…"}
        </h3>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          正在拉取数据视图，请稍候。
        </p>
      </div>
    );
  }

  // 4. 配置缺失独立状态
  if (isConfigError(error)) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex min-h-[14rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-6 py-10 text-center shadow-xs"
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--status-warning-border)] bg-[var(--surface-card)] text-[var(--status-warning)]"
          aria-hidden="true"
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <span className="mt-3 inline-flex items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-warning)]">
          配置缺失
        </span>
        <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          快照环境配置缺失
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {error || "缺少必要的环境变量配置，请检查相关设置。"}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-[var(--text-inverse)] shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
          >
            重新检测配置
          </button>
        ) : null}
      </div>
    );
  }

  // 5. 不完整数据独立状态（若存在 incomplete 状态）
  if ((status as string) === "incomplete") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex min-h-[14rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-6 py-10 text-center shadow-xs"
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--status-warning-border)] bg-[var(--surface-card)] text-[var(--status-warning)]"
          aria-hidden="true"
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <span className="mt-3 inline-flex items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-warning)]">
          数据未取齐
        </span>
        <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          快照数据不完整
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {error || "快照数据未能完全拉取，请重试以重新同步完整数据。"}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-[var(--text-inverse)] shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
          >
            重新拉取
          </button>
        ) : null}
      </div>
    );
  }

  // 6. 网络失败 / 请求失败独立状态
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[14rem] w-full flex-col items-center justify-center rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-6 py-10 text-center shadow-xs"
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--status-error-border)] bg-[var(--surface-card)] text-[var(--status-error)]"
        aria-hidden="true"
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <span className="mt-3 inline-flex items-center rounded-full border border-[var(--status-error-border)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-error)]">
        网络请求失败
      </span>
      <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
        快照加载失败
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
        {error || "网络连接异常，未能获取快照数据，请重试。"}
      </p>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-[var(--text-inverse)] shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
        >
          重试加载
        </button>
      ) : null}
    </div>
  );
}
