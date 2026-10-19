import { useEffect, useSyncExternalStore } from "react";
import { fetchEmailDataset, isIncompleteDataError } from "./supabase";

export interface EmailRecord {
  brand: string;
  date: string;
  theme: string;
  keywords: string[];
  url?: string;
  day_seq: number;
  source_index: number;
  market?: string;
}

/** 市场兜底 + 归一化：market 缺失/空串时视为 US；统一 trim + 大写（防 DB 返回 "" 或小写导致行从筛选中静默消失）。 */
export function getEmailMarket(email: EmailRecord): string {
  const normalized = (email.market ?? "US").trim().toUpperCase();
  return normalized === "" ? "US" : normalized;
}

/** 市场匹配：null = 全部市场，否则按 getEmailMarket() 的兜底值精确匹配。 */
export function matchesMarket(email: EmailRecord, market: string | null): boolean {
  return market === null || getEmailMarket(email) === market;
}

/** 按市场统计封数（market 代码 → 封数），供三视图的市场下拉展示。 */
export function countEmailsByMarket(emails: EmailRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const email of emails) {
    const market = getEmailMarket(email);
    counts[market] = (counts[market] ?? 0) + 1;
  }
  return counts;
}

export const BRAND_ORDER = ["Zara", "lululemon", "ALO Yoga", "Halara", "Temu", "SHEIN"] as const;

export type EmailDataSource = "supabase" | "json";

const DEFAULT_SOURCE: EmailDataSource = import.meta.env.VITE_EDM_DATA_SOURCE === "json"
  ? "json"
  : "supabase";

export const EXTENDED_EMAIL_META = {
  // 按数据源区分窗口：live Supabase 分支随每日任务滑动；JSON 回滚模式保留历史快照窗口。
  // 必须在此处区分：email-data-json.ts 与 data-calendar.ts 都直接读这个共享常量做校验/派生，
  // 只在返回的 meta 里覆盖历史日期是不够的——校验在覆盖之前就已用 live 边界拒绝了历史邮件。
  windowStart: DEFAULT_SOURCE === "json" ? "2026-07-16" : "2026-07-18",
  windowEnd: DEFAULT_SOURCE === "json" ? "2026-10-15" : "2026-10-18",
  range: DEFAULT_SOURCE === "json" ? "2026-07-16 – 2026-10-15" : "2026-07-18 – 2026-10-18",
  market: "美国 / 英国 / 澳洲 / 法国 / 德国 / 意大利 / 荷兰；西班牙 0 封",
  source: "Milled",
  brandCount: BRAND_ORDER.length,
  weekCount: 3,
} as const;

export interface ExtendedEmailMeta {
  windowStart: string;
  windowEnd: string;
  range: string;
  market: string;
  source: string;
  brandCount: number;
  weekCount: number;
  total: number | null;
  dataSource: EmailDataSource;
  provenance: string;
}

interface ExtendedEmailsData {
  emails: EmailRecord[];
  meta: ExtendedEmailMeta;
}

interface ExtendedEmailsState extends ExtendedEmailsData {
  status: "loading" | "ready" | "error" | "incomplete";
  total: number;
  error: string | null;
}

export interface ExtendedEmailsResult extends ExtendedEmailsState {
  retry: () => void;
}

const jsonAdapter = import.meta.env.VITE_EDM_DATA_SOURCE === "json"
  ? async (): Promise<ExtendedEmailsData> => {
    try {
      const adapter = await import("./email-data-json");
      const { emails, expectedTotal } = await adapter.loadJsonEmailDataset();
      return {
        emails: sortEmails(emails),
        meta: {
          ...EXTENDED_EMAIL_META,
          total: expectedTotal,
          market: "美国（离线快照）",
          source: "Milled 公开归档收录（离线快照，历史 US 样本）",
          dataSource: "json",
          provenance: "六份历史 US 文件完整加载；保留服务/法务通知，仅排除 Temu 商家侧 other。不是 live 多市场全量。",
        },
      };
    } catch {
      throw new Error("本地回滚数据加载失败。");
    }
  }
  : async (): Promise<ExtendedEmailsData> => {
    throw new Error("JSON 回滚需配置 VITE_EDM_DATA_SOURCE=json 后重新启动或构建。");
  };

function sortEmails(emails: EmailRecord[]): EmailRecord[] {
  const brandRanks = new Map<string, number>(BRAND_ORDER.map((brand, index) => [brand, index]));
  return emails.sort((left, right) =>
    right.date.localeCompare(left.date) ||
    (brandRanks.get(left.brand) ?? BRAND_ORDER.length) - (brandRanks.get(right.brand) ?? BRAND_ORDER.length) ||
    getEmailMarket(left).localeCompare(getEmailMarket(right)) ||
    left.source_index - right.source_index || left.day_seq - right.day_seq,
  );
}

async function supabaseAdapter(): Promise<ExtendedEmailsData> {
  const { rows, exactTotal } = await fetchEmailDataset();
  const emails = sortEmails(rows.map((row) => ({
    brand: row.brand,
    date: row.sent_date,
    theme: row.theme,
    keywords: [...row.keywords],
    url: row.original_url ?? undefined,
    day_seq: row.day_seq,
    source_index: row.source_index,
    market: row.market,
  })));
  return {
    emails,
    meta: {
      ...EXTENDED_EMAIL_META,
      total: exactTotal,
      dataSource: "supabase",
      provenance: "Supabase emails 实时只读；完整性按固定查询窗口的精确总数与唯一标识校验。",
    },
  };
}

// 每日更新为主、白天偶有补数：5 分钟兼顾补数可见时效与全量分页查询的开销。
const STALE_TIME = 5 * 60 * 1000;

interface EmailCacheEntry {
  request: Promise<ExtendedEmailsData>;
  updatedAt: number | null;
}

const promiseCache = new Map<EmailDataSource, EmailCacheEntry>();
const inFlightRequests = new Map<EmailDataSource, Promise<ExtendedEmailsData>>();

function requestExtendedEmails(source: EmailDataSource, force = false): Promise<ExtendedEmailsData> {
  const cached = promiseCache.get(source);
  const pending = inFlightRequests.get(source);
  if (cached && (
    cached.request === pending ||
    (!force && (cached.updatedAt === null || Date.now() - cached.updatedAt < STALE_TIME))
  )) return cached.request;

  const fetchDataset = () => source === "json" ? jsonAdapter() : supabaseAdapter();
  const request = pending ? pending.then(fetchDataset, fetchDataset) : fetchDataset();
  const entry: EmailCacheEntry = { request, updatedAt: null };
  promiseCache.set(source, entry);
  inFlightRequests.set(source, request);

  function settleRequest(data?: ExtendedEmailsData) {
    if (inFlightRequests.get(source) === request) inFlightRequests.delete(source);
    if (promiseCache.get(source) !== entry) return;
    if (data && data.meta.total !== null && data.emails.length === data.meta.total) {
      entry.updatedAt = Date.now();
    } else if (cached && cached.updatedAt !== null) {
      promiseCache.set(source, cached);
    }
  }

  void request.then(settleRequest, () => settleRequest());
  return request;
}

export function getExtendedEmails(source: EmailDataSource = DEFAULT_SOURCE): Promise<ExtendedEmailsData> {
  return requestExtendedEmails(source);
}

const loadingState: ExtendedEmailsState = {
  status: "loading",
  emails: [],
  meta: { ...EXTENDED_EMAIL_META, total: null, dataSource: DEFAULT_SOURCE, provenance: "数据加载中" },
  total: 0,
  error: null,
};

let state = loadingState;
let activeRequest: Promise<ExtendedEmailsData> | null = null;
const listeners = new Set<() => void>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function stopRefreshTimer() {
  if (refreshTimer === null) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

function refreshVisibleEmails() {
  if (document.visibilityState === "visible" && navigator.onLine) loadExtendedEmails(true);
}

function startRefreshTimer() {
  if (refreshTimer !== null || document.visibilityState !== "visible") return;
  refreshTimer = setInterval(refreshVisibleEmails, STALE_TIME);
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    startRefreshTimer();
    refreshVisibleEmails();
  } else {
    stopRefreshTimer();
  }
}

function handleOnline() {
  loadExtendedEmails(true);
}

function startAutoRefresh() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);
  startRefreshTimer();
}

function stopAutoRefresh() {
  stopRefreshTimer();
  if (typeof window === "undefined" || typeof document === "undefined") return;
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("online", handleOnline);
}

function setState(nextState: ExtendedEmailsState) {
  state = nextState;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) startAutoRefresh();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopAutoRefresh();
  };
}

function getSnapshot() {
  return state;
}

function loadExtendedEmails(force = false) {
  const request = requestExtendedEmails(DEFAULT_SOURCE, force);
  if (activeRequest === request) return;
  activeRequest = request;

  request.then(
    ({ emails, meta }) => {
      if (activeRequest !== request) return;
      const complete = meta.total !== null && emails.length === meta.total;
      if (state.status === "ready" && !complete) return;
      setState({
        status: complete ? "ready" : "incomplete",
        emails,
        meta,
        total: emails.length,
        error: null,
      });
    },
    (error: unknown) => {
      if (activeRequest !== request || state.status === "ready") return;
      // 完整性失败（分页未取齐/总数变化/标识不一致）映射为 incomplete，
      // 与网络失败（error）区分，避免分页不完整被展示为网络失败。
      setState({
        ...loadingState,
        status: isIncompleteDataError(error) ? "incomplete" : "error",
        error: error instanceof Error ? error.message : "邮件加载失败，请重试。",
      });
    },
  );
}

export function resetExtendedEmailsCache() {
  promiseCache.clear();
  activeRequest = null;
  setState(loadingState);
}

export function retryExtendedEmails() {
  resetExtendedEmailsCache();
  loadExtendedEmails();
}

export function useExtendedEmails(): ExtendedEmailsResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { loadExtendedEmails(); }, []);
  return { ...snapshot, retry: retryExtendedEmails };
}
