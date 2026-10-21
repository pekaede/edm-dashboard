import { CircleAlert, CircleX, RotateCw, TriangleAlert } from "lucide-react";
import { LoadingBlock } from "./ui/loading-block";
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
        title={emptyTitle ?? (marketName ? t("stEmptyMarketTitle", { market: marketName }) : t("stEmptyNoMatch"))}
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
      <LoadingBlock className="min-h-[14rem]">
        <h3 className="mt-4 text-base font-bold text-[var(--text-heading)] sm:text-lg">
          {t("stLoadingTitle")}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {t("stLoadingDesc")}
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
            <RotateCw className="mr-2 size-4" aria-hidden="true" />
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
        ? t("stIncompleteDescToken", { loaded: safeLoaded, expected: safeExpected })
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
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
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
            <RotateCw className="mr-2 size-4" aria-hidden="true" />
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
        <CircleX className="h-6 w-6" aria-hidden="true" />
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
          <RotateCw className="mr-2 size-4" aria-hidden="true" />
          {t("stRetryLoad")}
        </button>
      ) : null}
    </div>
  );
}
