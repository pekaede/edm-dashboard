import { useEffect, useSyncExternalStore } from "react";
import { fetchAllEmails } from "./supabase";

export interface EmailRecord {
  brand: string;
  date: string;
  theme: string;
  keywords: string[];
  url?: string;
  day_seq: number;
  source_index: number;
  // 市场代码（US/UK/AU/FR/DE/EU）。Supabase 行由 supabase.ts SELECT market 并经 isEmailRow 校验，
  // 此处直接透传；JSON 回滚行无 market 时由 getEmailMarket() 兜底为 "US"。
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

export const EXTENDED_EMAIL_META = {
  windowStart: "2026-07-16",
  windowEnd: "2026-10-15",
  range: "2026-07-16 – 2026-10-15",
  // 数据集已含多市场（US 770 + UK 89 = 859）。新增市场导入后需同步更新 total 与 market，
  // 否则 ready 判定（emails.length === meta.total）与日历校验（validateCalendarData）会误判为未取齐。
  market: "美国 + 英国",
  source: "Milled",
  brandCount: BRAND_ORDER.length,
  // 3 周视图的周数（结构常量，非冻结计数；KPI/页眉用聚合 weeks.length 亦可）。
  weekCount: 3,
  total: 859,
} as const;

export type EmailDataSource = "supabase" | "json";

interface ExtendedEmailsData {
  emails: EmailRecord[];
  meta: typeof EXTENDED_EMAIL_META;
}

interface ExtendedEmailsState extends ExtendedEmailsData {
  status: "loading" | "ready" | "error" | "incomplete";
  total: number;
  error: string | null;
}

export interface ExtendedEmailsResult extends ExtendedEmailsState {
  retry: () => void;
}

const DEFAULT_SOURCE: EmailDataSource = import.meta.env.VITE_EDM_DATA_SOURCE === "json"
  ? "json"
  : "supabase";

const jsonAdapter = import.meta.env.VITE_EDM_DATA_SOURCE === "json"
  ? async (): Promise<EmailRecord[]> => {
    try {
      const adapter = await import("./email-data-json");
      return await adapter.jsonAdapter();
    } catch {
      throw new Error("本地回滚数据加载失败。");
    }
  }
  : async (): Promise<EmailRecord[]> => {
    throw new Error("JSON 回滚需配置 VITE_EDM_DATA_SOURCE=json 后重新启动或构建。");
  };

function sortEmails(emails: EmailRecord[]): EmailRecord[] {
  const brandRanks = new Map<string, number>(BRAND_ORDER.map((brand, index) => [brand, index]));
  return emails.sort((left, right) =>
    right.date.localeCompare(left.date) ||
    (brandRanks.get(left.brand) ?? BRAND_ORDER.length) - (brandRanks.get(right.brand) ?? BRAND_ORDER.length) ||
    left.source_index - right.source_index,
  );
}

async function supabaseAdapter(): Promise<EmailRecord[]> {
  const rows = await fetchAllEmails();
  return sortEmails(rows.map((row) => ({
    brand: row.brand,
    date: row.sent_date,
    theme: row.theme,
    keywords: [...row.keywords],
    url: row.original_url ?? undefined,
    day_seq: row.day_seq,
    source_index: row.source_index,
    market: row.market,
  })));
}

const promiseCache = new Map<EmailDataSource, Promise<ExtendedEmailsData>>();

export function getExtendedEmails(source: EmailDataSource = DEFAULT_SOURCE): Promise<ExtendedEmailsData> {
  const cached = promiseCache.get(source);
  if (cached) return cached;

  const request = (source === "json" ? jsonAdapter().then(sortEmails) : supabaseAdapter())
    .then((emails) => ({ emails, meta: EXTENDED_EMAIL_META }));
  promiseCache.set(source, request);
  return request;
}

const loadingState: ExtendedEmailsState = {
  status: "loading",
  emails: [],
  meta: EXTENDED_EMAIL_META,
  total: 0,
  error: null,
};

let state = loadingState;
let activeRequest: Promise<ExtendedEmailsData> | null = null;
const listeners = new Set<() => void>();

function setState(nextState: ExtendedEmailsState) {
  state = nextState;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return state;
}

function loadExtendedEmails() {
  const request = getExtendedEmails();
  if (activeRequest === request) return;
  activeRequest = request;

  request.then(
    ({ emails, meta }) => {
      if (activeRequest !== request) return;
      setState({
        status: emails.length === meta.total ? "ready" : "incomplete",
        emails,
        meta,
        total: emails.length,
        error: null,
      });
    },
    (error: unknown) => {
      if (activeRequest !== request) return;
      setState({
        ...loadingState,
        status: "error",
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

function retryExtendedEmails() {
  resetExtendedEmailsCache();
  loadExtendedEmails();
}

export function useExtendedEmails(): ExtendedEmailsResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(loadExtendedEmails, []);
  return { ...snapshot, retry: retryExtendedEmails };
}
