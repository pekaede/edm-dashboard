import type { ExtendedEmailsResult } from "../email-data";

type ExtendedEmailsStateProps = Pick<ExtendedEmailsResult, "status" | "total" | "error" | "retry">;

export function ExtendedEmailsState({ status, total, error, retry }: ExtendedEmailsStateProps) {
  if (status === "ready") return null;

  const message = status === "loading"
    ? "正在加载邮件…"
    : status === "incomplete"
      ? `数据未取齐（已取 ${total} / 770 封）`
      : error ?? "邮件加载失败，请重试。";

  return (
    <div
      className="rounded-xl border border-[#d9d0c3] bg-[#fffaf3] px-5 py-6 text-sm text-[#5f574f]"
      role={status === "loading" ? "status" : "alert"}
      aria-live="polite"
    >
      <p>{message}</p>
      {status !== "loading" ? (
        <button
          type="button"
          onClick={retry}
          className="mt-4 min-h-11 rounded-full bg-[#292521] px-5 py-2.5 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)] focus-visible:ring-offset-2"
        >
          重试
        </button>
      ) : null}
    </div>
  );
}
