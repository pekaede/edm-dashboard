import { CircleAlert, CircleX, RotateCw, TriangleAlert } from "lucide-react";
import { LoadingBlock } from "./ui/loading-block";
import type { SnapshotResult } from "../snapshot";
import { useLocale } from "../i18n";
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
  const { t } = useLocale();
  // 1. P0-06 空态判断：使用 EmptyState 组件
  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle ?? t("ssEmptyTitle")}
        description={emptyDescription ?? t("ssEmptyDesc")}
        actionLabel={actionLabel ?? (onAction ? t("emptyStateReset") : t("stRetryFetch"))}
        onAction={onAction ?? retry}
      />
    );
  }

  // 2. 就绪状态无须占位
  if (status === "ready") return null;

  // 3. 首次加载状态：无假零、无 NaN、无永久空白
  if (status === "loading") {
    return (
      <LoadingBlock className="min-h-[14rem]">
        <h3 className="mt-4 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          {loadingText || t("ssLoadingDefault")}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {t("ssLoadingDesc")}
        </p>
      </LoadingBlock>
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
          <CircleAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <span className="mt-3 inline-flex items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-warning)]">
          {t("stConfigBadge")}
        </span>
        <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          {t("ssConfigTitle")}
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {error || t("ssConfigDesc")}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--control-active-bg)] px-4 py-2 text-xs font-bold text-[var(--control-active-text)] shadow-xs transition hover:bg-[var(--control-active-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
          >
            <RotateCw className="mr-2 size-4" aria-hidden="true" />
            {t("stRecheck")}
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
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <span className="mt-3 inline-flex items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-warning)]">
          {t("stIncompleteBadge")}
        </span>
        <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          {t("ssIncompleteTitle")}
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {error || t("ssIncompleteDesc")}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--control-active-bg)] px-4 py-2 text-xs font-bold text-[var(--control-active-text)] shadow-xs transition hover:bg-[var(--control-active-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
          >
            <RotateCw className="mr-2 size-4" aria-hidden="true" />
            {t("stRetryFetch")}
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
        <CircleX className="h-6 w-6" aria-hidden="true" />
      </div>
      <span className="mt-3 inline-flex items-center rounded-full border border-[var(--status-error-border)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-error)]">
        {t("stNetworkBadge")}
      </span>
      <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
        {t("ssErrorTitle")}
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
        {error || t("ssErrorDesc")}
      </p>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--control-active-bg)] px-4 py-2 text-xs font-bold text-[var(--control-active-text)] shadow-xs transition hover:bg-[var(--control-active-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
        >
          <RotateCw className="mr-2 size-4" aria-hidden="true" />
          {t("stRetryLoad")}
        </button>
      ) : null}
    </div>
  );
}
