import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  EMAIL_DATA_REQUEST_TIMEOUT_MS,
  EMAIL_DATA_STALE_TIME,
  subscribeEmailDataRefresh,
  type EmailDataSource,
} from "./email-data";
import { fetchContentAnalysis, type EmailContentAnalysisRow } from "./email-content-analysis";

interface AnalysisParams {
  source: EmailDataSource;
  market: string | null;
  start: string;
  end: string;
}

interface AnalysisState {
  status: "loading" | "ready" | "error";
  rows: EmailContentAnalysisRow[] | null;
  error: Error | null;
}

interface AnalysisEntry {
  params: AnalysisParams;
  state: AnalysisState;
  updatedAt: number | null;
  controller: AbortController | null;
  listeners: Set<() => void>;
}

const loadingState: AnalysisState = { status: "loading", rows: null, error: null };
// 历史 JSON 快照没有内容分析结果；与主数据一样只使用离线源，绝不查询 live Supabase。
const offlineState: AnalysisState = { status: "ready", rows: [], error: null };
const cache = new Map<string, AnalysisEntry>();

function getEntry(params: AnalysisParams): AnalysisEntry {
  const key = JSON.stringify([params.source, params.market, params.start, params.end]);
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      params,
      state: params.source === "json" || params.market === null ? offlineState : loadingState,
      updatedAt: null,
      controller: null,
      listeners: new Set(),
    };
    cache.set(key, entry);
  }
  return entry;
}

function setState(entry: AnalysisEntry, state: AnalysisState) {
  entry.state = state;
  entry.listeners.forEach((listener) => listener());
}

function cancelRequest(entry: AnalysisEntry) {
  entry.controller?.abort();
  entry.controller = null;
}

function loadAnalysis(entry: AnalysisEntry, refresh = false, force = false) {
  const { source, market, start, end } = entry.params;
  if (source === "json" || market === null) return;
  if (!force && entry.controller !== null) return;
  if (!force && !refresh && entry.updatedAt !== null && Date.now() - entry.updatedAt < EMAIL_DATA_STALE_TIME) return;
  cancelRequest(entry);
  const controller = new AbortController();
  entry.controller = controller;
  if (entry.state.status !== "ready") setState(entry, loadingState);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("内容分析加载超时，请重试。");
      controller.abort(error);
      reject(error);
    }, EMAIL_DATA_REQUEST_TIMEOUT_MS);
  });
  // 与主数据一致：超时覆盖 HEAD、全部分页、响应体及完整性重试；同时取消底层请求。
  const request = Promise.race([
    fetchContentAnalysis({ market, start, end, signal: controller.signal }),
    timeout,
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
  void request.then(
    (rows) => {
      if (entry.controller !== controller) return;
      entry.controller = null;
      entry.updatedAt = Date.now();
      setState(entry, { status: "ready", rows, error: null });
    },
    (error: unknown) => {
      if (entry.controller !== controller) return;
      entry.controller = null;
      // SWR：后台更新失败保留上一份成功数据，首次失败不写入有效缓存。
      if (entry.state.status === "ready") return;
      setState(entry, {
        status: "error",
        rows: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    },
  );
}

// 模块生命周期内持续接收失效信号，未挂载的市场/窗口缓存也会被显式重试清空。
subscribeEmailDataRefresh((event) => {
  for (const entry of cache.values()) {
    if (event.type === "reset") {
      cancelRequest(entry);
      entry.updatedAt = null;
      setState(entry, entry.params.source === "json" || entry.params.market === null ? offlineState : loadingState);
    } else if (entry.params.source === event.source && entry.listeners.size > 0) {
      loadAnalysis(entry, true, event.force);
    }
  }
});

/** 按数据源/市场/窗口共享缓存；自动刷新由 useExtendedEmails 的同一刷新信号驱动。 */
export function useEmailContentAnalysis({ source, market, start, end }: AnalysisParams): AnalysisState {
  const entry = useMemo(() => getEntry({ source, market, start, end }), [source, market, start, end]);
  const subscribe = useMemo(() => (listener: () => void) => {
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0) cancelRequest(entry);
    };
  }, [entry]);
  const snapshot = useSyncExternalStore(subscribe, () => entry.state, () => entry.state);
  useEffect(() => { loadAnalysis(entry); }, [entry]);
  return snapshot;
}
