import type { SnapshotResult } from "../snapshot";

type SnapshotStateProps = Pick<SnapshotResult<unknown>, "status" | "error" | "retry"> & {
  loadingText: string;
};

export function SnapshotState({ status, error, retry, loadingText }: SnapshotStateProps) {
  if (status === "ready") return null;

  const message = status === "loading" ? loadingText : error ?? "加载失败，请重试。";

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
