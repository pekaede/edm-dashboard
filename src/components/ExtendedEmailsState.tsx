import type { ExtendedEmailMeta, ExtendedEmailsResult } from "../email-data";

// meta 可选：3 周汇总三组件（他人文件）只传 {status, total, error, retry}，缺失时回落到 EXTENDED_EMAIL_META。
type ExtendedEmailsStateProps = Pick<ExtendedEmailsResult, "status" | "total" | "error" | "retry"> & {
  meta?: ExtendedEmailMeta;
};

export function ExtendedEmailsState({ status, total, error, retry, meta }: ExtendedEmailsStateProps) {
  if (status === "ready") return null;

  const message = status === "loading"
    ? "正在加载邮件…"
    : status === "incomplete"
      ? `数据未取齐（已取 ${total} / ${meta?.total ?? "未知"} 封）`
      : error ?? "邮件加载失败，请重试。";

  return (
    <div
      className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 py-6 text-sm text-[var(--text-detail)]"
      role={status === "loading" ? "status" : "alert"}
      aria-live="polite"
    >
      <p>{message}</p>
      {status !== "loading" ? (
        <button
          type="button"
          onClick={retry}
          className="mt-4 min-h-11 rounded-full bg-[var(--text-control)] px-5 py-2.5 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2"
        >
          重试
        </button>
      ) : null}
    </div>
  );
}
