import type { ExtendedEmailMeta, ExtendedEmailsResult } from "../email-data";
import { useLocale } from "../i18n";
import { EmptyState } from "./EmptyState";

function isConfigError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /配置|env|VITE_|Supabase 本地环境/i.test(error);
}

// meta 可选：3 周汇总三组件（他人文件）只传 {status, total, error, retry}，缺失时回落到 EXTENDED_EMAIL_META。
export interface ExtendedEmailsStateProps {
  status: ExtendedEmailsResult["status"];
  total?: number;
  error?: string | null;
  retry?: () => void;
  meta?: ExtendedEmailMeta;
  // P0-06 空态统一支持
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ExtendedEmailsState({
  status,
  total,
  error,
  retry,
  meta,
  isEmpty,
  emptyTitle,
  emptyDescription,
  actionLabel,
  onAction,
}: ExtendedEmailsStateProps) {
  const { t } = useLocale();
  // 1. P0-06 空态：筛选零结果、市场零记录时统一用 EmptyState
  const isZeroRecords = status === "ready" && typeof total === "number" && total === 0;
  if (isEmpty || isZeroRecords || (status === "ready" && emptyTitle)) {
    const marketName = meta?.market;
    return (
      <EmptyState
        title={emptyTitle ?? (marketName ? t("stEmptyMarketTitle").replace("{market}", marketName) : t("stEmptyNoMatch"))}
        description={
          emptyDescription ??
          (marketName ? t("stEmptyMarketDesc") : t("stEmptyFilterDesc"))
        }
        actionLabel={actionLabel ?? (onAction ? t("emptyStateReset") : retry ? t("stRetryFetch") : undefined)}
        onAction={onAction ?? retry}
      />
    );
  }

  // 2. 就绪且有数据：不渲染占位
  if (status === "ready") return null;

  // 3. 首次加载：无假零、无 NaN、无永久空白
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
          {t("stLoadingTitle")}
        </h3>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {t("stLoadingDesc")}
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
          {t("stConfigBadge")}
        </span>
        <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          {t("stConfigTitleEmails")}
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {error || t("stConfigDescEmails")}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-[var(--text-inverse)] shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
          >
            {t("stRecheck")}
          </button>
        ) : null}
      </div>
    );
  }

  // 5. 不完整数据独立状态
  if (status === "incomplete") {
    const safeLoaded = typeof total === "number" && Number.isFinite(total) ? Math.max(0, total) : 0;
    const safeExpected = meta?.total != null && Number.isFinite(meta.total) ? meta.total : null;
    const description = error
      ? error
      : safeExpected !== null
        ? t("stIncompleteDescToken").replace("{loaded}", String(safeLoaded)).replace("{expected}", String(safeExpected))
        : t("stIncompleteDescPlain");

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
          {t("stIncompleteBadge")}
        </span>
        <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          {t("stIncompleteTitle")}
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {description}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-[var(--text-inverse)] shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
          >
            {t("stRefetchFull")}
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
        {t("stNetworkBadge")}
      </span>
      <h3 className="mt-2 text-base font-bold text-[var(--text-heading)] sm:text-lg">
        {t("stErrorTitleEmails")}
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
        {error || t("stErrorDescEmails")}
      </p>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-[var(--text-inverse)] shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--control-focus-offset)] sm:text-sm"
        >
          {t("stRetryLoad")}
        </button>
      ) : null}
    </div>
  );
}
