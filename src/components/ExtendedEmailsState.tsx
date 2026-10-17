import type { ExtendedEmailMeta, ExtendedEmailsResult } from "../email-data";
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
  // 1. P0-06 空态：筛选零结果、市场零记录时统一用 EmptyState
  const isZeroRecords = status === "ready" && typeof total === "number" && total === 0;
  if (isEmpty || isZeroRecords || (status === "ready" && emptyTitle)) {
    const marketName = meta?.market;
    return (
      <EmptyState
        title={emptyTitle ?? (marketName ? `${marketName}暂无收录邮件` : "未找到匹配邮件")}
        description={
          emptyDescription ??
          (marketName
            ? `该市场在当前统计窗口内暂无邮件收录记录，请切换其他站点或清除筛选条件。`
            : "当前筛选条件下暂无符合条件的邮件记录，请尝试调整筛选条件。")
        }
        actionLabel={actionLabel ?? (onAction ? "重置筛选" : retry ? "重新拉取" : undefined)}
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
          正在载入邮件数据…
        </h3>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          正在连接 Supabase 校验数据完整性与记录总量，请稍候。
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
          Supabase 环境配置缺失
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {error || "缺少 Supabase 本地环境配置，请检查环境变量 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY。"}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 sm:text-sm"
          >
            重新检测配置
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
        ? `当前已接收 ${safeLoaded} 封邮件，预期完整记录应为 ${safeExpected} 封。部分数据分页拉取中断，可点击重新拉取以补全完整记录。`
        : "邮件数据分页拉取未取齐，部分记录中断，可点击重新拉取以补全完整记录。";

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
          邮件数据载入不完整
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
          {description}
        </p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 sm:text-sm"
          >
            重新拉取完整数据
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
        邮件数据加载失败
      </h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
        {error || "网络连接异常或请求超时，未能成功获取邮件数据，请检查网络连接后重试。"}
      </p>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-heading)] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-slate-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2 sm:text-sm"
        >
          重试加载
        </button>
      ) : null}
    </div>
  );
}
