import { useCallback, useEffect, useState } from "react";

export type SnapshotStatus = "loading" | "ready" | "error";

export interface SnapshotResult<T> {
  status: SnapshotStatus;
  data: T | null;
  error: string | null;
  retry: () => void;
}

const promiseCache = new Map<string, Promise<unknown>>();

export function useSnapshotData<T>(key: string, fetcher: () => Promise<T>): SnapshotResult<T> {
  const [status, setStatus] = useState<SnapshotStatus>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    const cached = promiseCache.get(key) as Promise<T> | undefined;
    const request = cached ?? fetcher();
    if (!cached) promiseCache.set(key, request);
    request.then(
      (value) => {
        if (cancelled) return;
        setData(value);
        setStatus("ready");
      },
      (fetchError: unknown) => {
        // 先清理失败缓存（仅当缓存仍指向当前请求），再检查是否允许更新状态：
        // 否则卸载后失败的请求会留在缓存中，重挂载时直接复用旧 rejection 而不重拉。
        if (promiseCache.get(key) === request) promiseCache.delete(key);
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : "快照加载失败，请重试。");
        setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, fetcher, attempt]);

  const retry = useCallback(() => {
    promiseCache.delete(key);
    setAttempt((current) => current + 1);
  }, [key]);

  return { status, data, error, retry };
}
