import { LIVE_WINDOW } from "./data-window";

export interface SupabaseEmailRow {
  [column: string]: unknown;
  brand: string;
  sent_date: string;
  day_seq: number;
  source_index: number;
  theme: string;
  keywords: string[];
  original_url: string | null;
  // 原始内容（可空；ALTER TABLE 由迁移执行，见 email_content_analysis 契约）。
  // 供内容 AI 分析读取：subject / preheader / banner_url。
  subject?: string | null;
  preheader?: string | null;
  banner_url?: string | null;
  // 市场代码（US/UK/AU/FR/DE/EU）。SELECT 必须含 market，且 isEmailRow 强制校验，
  // 避免 SELECT 遗漏时静默兜底为 US（会让 UK 筛选撒谎）。
  market: string;
}

export interface EmailDataset {
  rows: SupabaseEmailRow[];
  exactTotal: number;
}

/**
 * 数据完整性失败（分页未取齐、总数变化、标识不一致等）。
 * 与网络失败 / 配置错误区分：上游应映射为 `incomplete` 状态，而非 `error`（网络失败）。
 * `code` 供通用 hook（如 snapshot.ts）做鸭子类型判断，避免通用层依赖本模块。
 */
export class IncompleteDataError extends Error {
  readonly code = "incomplete" as const;
  constructor(message: string) {
    super(message);
    this.name = "IncompleteDataError";
  }
}

export function isIncompleteDataError(error: unknown): boolean {
  return (
    error instanceof IncompleteDataError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "incomplete")
  );
}

function getSupabaseConfig(): { baseUrl: string; publishableKey: string } {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) {
    throw new Error("缺少 Supabase 本地环境配置。");
  }
  return { baseUrl, publishableKey };
}

const PAGE_SIZE = 200;
const MAX_ATTEMPTS = 3;
const EMAIL_REQUEST_TIMEOUT_MS = 30_000;
const SOURCE_KEY = ["market", "brand", "sent_date", "source_index", "day_seq"];

async function getEmailKeyColumns(baseUrl: string, publishableKey: string, signal: AbortSignal): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/rest/v1/`, {
      headers: { apikey: publishableKey, Accept: "application/openapi+json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    if (response.ok) {
      const schema = await response.json();
      const properties = schema?.definitions?.emails?.properties;
      if (properties && typeof properties === "object") {
        const primaryKeys = Object.entries(properties).filter(([, definition]) => {
          const description = (definition as { description?: unknown })?.description;
          return typeof description === "string" && /<pk\s*\/>/.test(description);
        }).map(([column]) => column);
        if (primaryKeys.length > 0 && primaryKeys.every((column) => /^[a-z_][a-z0-9_]*$/i.test(column))) {
          return primaryKeys.sort();
        }
      }
    }
  } catch {
    signal.throwIfAborted();
  }
  signal.throwIfAborted();
  return SOURCE_KEY;
}

function readExactTotal(response: Response): number {
  const totalMatch = response.headers.get("Content-Range")?.match(/\/(\d+)$/);
  const total = totalMatch ? Number(totalMatch[1]) : NaN;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new IncompleteDataError("邮件响应缺少精确总数，无法确认数据完整性。");
  }
  return total;
}

function rowIdentity(row: SupabaseEmailRow, columns: string[]): string {
  const values = columns.map((column) => row[column]);
  if (values.some((value) =>
    !(typeof value === "string" && value.length > 0) &&
    !(typeof value === "number" && Number.isSafeInteger(value)),
  )) {
    throw new IncompleteDataError("邮件唯一标识无效，无法确认数据完整性。");
  }
  return JSON.stringify(values);
}

function isEmailRow(value: unknown): value is SupabaseEmailRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.brand === "string" &&
    typeof row.sent_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.sent_date) &&
    typeof row.theme === "string" &&
    typeof row.market === "string" &&
    row.market.trim().length > 0 &&
    typeof row.day_seq === "number" &&
    Number.isInteger(row.day_seq) && row.day_seq >= 0 &&
    typeof row.source_index === "number" &&
    Number.isInteger(row.source_index) && row.source_index >= 0 &&
    Array.isArray(row.keywords) &&
    row.keywords.every((keyword) => typeof keyword === "string") &&
    (row.original_url === null || typeof row.original_url === "string")
  );
}

async function fetchEmailDatasetPages(signal: AbortSignal): Promise<EmailDataset> {
  signal.throwIfAborted();
  const { baseUrl, publishableKey } = getSupabaseConfig();

  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/rest/v1/emails`);
  } catch {
    throw new Error("Supabase 环境配置无效。");
  }
  const keyColumns = await getEmailKeyColumns(baseUrl, publishableKey, signal);
  signal.throwIfAborted();
  const columns = new Set(["brand", "sent_date", "day_seq", "source_index", "theme", "keywords", "original_url", "market", "subject", "preheader", "banner_url", ...keyColumns]);
  endpoint.searchParams.set("select", [...columns].join(","));
  endpoint.searchParams.append("sent_date", `gte.${LIVE_WINDOW.start}`);
  endpoint.searchParams.append("sent_date", `lte.${LIVE_WINDOW.end}`);
  const orderColumns = [...new Set(["sent_date", "brand", "day_seq", ...keyColumns])];
  endpoint.searchParams.set("order", orderColumns.map((column) => `${column}.${column === "sent_date" ? "desc" : "asc"}`).join(","));
  endpoint.searchParams.set("limit", String(PAGE_SIZE));

  const headers = { apikey: publishableKey, Prefer: "count=exact" };
  async function requestPage(method: "GET" | "HEAD" = "GET"): Promise<Response> {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetch(endpoint, { method, headers, signal });
    } catch {
      signal.throwIfAborted();
      throw new Error("邮件请求失败，请检查网络后重试。");
    }
    if (!response.ok) throw new Error(`邮件请求失败（HTTP ${response.status}）。`);
    return response;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      endpoint.searchParams.set("offset", "0");
      const exactTotal = readExactTotal(await requestPage("HEAD"));
      const rows: SupabaseEmailRow[] = [];
      const identities = new Set<string>();
      const sourceIdentities = new Set<string>();
      while (rows.length < exactTotal) {
        endpoint.searchParams.set("offset", String(rows.length));
        const response = await requestPage();
        if (readExactTotal(response) !== exactTotal) throw new IncompleteDataError("邮件总数在加载期间发生变化，请重试。");
        const page: unknown = await response.json();
        signal.throwIfAborted();
        if (!Array.isArray(page) || !page.every(isEmailRow)) throw new IncompleteDataError("邮件记录格式无效。");
        if (page.length === 0) throw new IncompleteDataError(`邮件分页未取齐（已取 ${rows.length} / ${exactTotal} 封）。`);
        for (const row of page) {
          const identity = rowIdentity(row, keyColumns);
          const sourceIdentity = rowIdentity(row, SOURCE_KEY);
          if (identities.has(identity) || sourceIdentities.has(sourceIdentity)) {
            throw new IncompleteDataError("邮件分页存在重复标识，已拒绝本次结果并重新加载。");
          }
          identities.add(identity);
          sourceIdentities.add(sourceIdentity);
          rows.push(row);
        }
        if (rows.length > exactTotal) throw new IncompleteDataError("邮件返回条数超过精确总数，请重试。");
      }
      endpoint.searchParams.set("offset", "0");
      if (readExactTotal(await requestPage("HEAD")) !== exactTotal) throw new IncompleteDataError("邮件总数在加载期间发生变化，请重试。");
      if (rows.length !== exactTotal || identities.size !== rows.length || sourceIdentities.size !== rows.length) {
        throw new IncompleteDataError("邮件条数或唯一标识数与精确总数不一致。");
      }
      signal.throwIfAborted();
      return { rows, exactTotal };
    } catch (error) {
      signal.throwIfAborted();
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("邮件加载失败，请重试。");
}

async function fetchEmailDatasetUncached(): Promise<EmailDataset> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("邮件加载超时，请重试。");
      controller.abort(error);
      reject(error);
    }, EMAIL_REQUEST_TIMEOUT_MS);
  });
  try {
    // 覆盖 schema、HEAD、全部分页/响应体和完整性重试；即使底层未响应 abort 也按时结算。
    return await Promise.race([fetchEmailDatasetPages(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function fetchAllEmails(): Promise<SupabaseEmailRow[]> {
  return (await fetchEmailDataset()).rows;
}

// 全量结果共享缓存（与 email-data.ts 的 5 分钟口径一致）：看板与内容分析同页
// 并行调用时只真正拉取一次。失败不缓存；force 绕过缓存重新拉取。
const EMAIL_DATASET_STALE_MS = 5 * 60 * 1000;
let emailDatasetCache: { request: Promise<EmailDataset>; updatedAt: number | null } | null = null;

export function fetchEmailDataset(force = false): Promise<EmailDataset> {
  const cached = emailDatasetCache;
  if (
    !force &&
    cached &&
    (cached.updatedAt === null || Date.now() - cached.updatedAt < EMAIL_DATASET_STALE_MS)
  ) {
    return cached.request;
  }
  const entry: { request: Promise<EmailDataset>; updatedAt: number | null } = {
    request: fetchEmailDatasetUncached(),
    updatedAt: null,
  };
  emailDatasetCache = entry;
  entry.request.then(
    () => {
      if (emailDatasetCache === entry) entry.updatedAt = Date.now();
    },
    () => {
      if (emailDatasetCache === entry) emailDatasetCache = null;
    },
  );
  return entry.request;
}


export interface BrandOverviewRow {
  brand: string;
  market: string;
  source: string | null;
  company_name: string | null;
  tracked_site_url: string | null;
  source_page_url: string | null;
  latest_activity_date: string | null;
  sending_provider: string | null;
  notes: string | null;
  captured_at: string | null;
  emails_archived: number | null;
  total_ads: number | null;
  new_ads_30d: number | null;
  unique_copy_30d: number | null;
  new_ads_90d: number | null;
  new_copy_90d: number | null;
  avg_ad_live_days: number | null;
  video_share_pct: number | null;
  emoji_use_pct: number | null;
  landing_pages_tracked: number | null;
  new_emails_sent_30d: number | null;
  avg_email_scoring_pct: number | null;
  avg_subject_length: number | null;
  avg_email_size_kb: number | null;
  avg_spam_score: number | null;
  top_keywords: string[] | null;
  email_top_keywords: string[] | null;
}

export function isBrandOverviewRow(value: unknown): value is BrandOverviewRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return ["brand", "market"].every((key) => typeof row[key] === "string" && row[key].trim().length > 0)
    && ["source", "company_name", "tracked_site_url", "source_page_url", "latest_activity_date", "sending_provider", "notes", "captured_at"].every((key) => row[key] === null || typeof row[key] === "string")
    && ["emails_archived", "total_ads", "new_ads_30d", "unique_copy_30d", "new_ads_90d", "new_copy_90d", "avg_ad_live_days", "video_share_pct", "emoji_use_pct", "landing_pages_tracked", "new_emails_sent_30d", "avg_email_scoring_pct", "avg_subject_length", "avg_email_size_kb", "avg_spam_score"].every((key) => row[key] === null || (typeof row[key] === "number" && Number.isFinite(row[key])))
    && ["top_keywords", "email_top_keywords"].every((key) => row[key] === null || (Array.isArray(row[key]) && row[key].every((word: unknown) => typeof word === "string")));
}

export async function fetchBrandOverview(signal?: AbortSignal): Promise<BrandOverviewRow[]> {
  const { baseUrl, publishableKey } = getSupabaseConfig();
  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/rest/v1/brand_overview`);
  } catch {
    throw new Error("Supabase 环境配置无效。");
  }
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("order", "brand,market");
  const timeout = AbortSignal.timeout(30_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(endpoint, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
      signal: requestSignal,
    });
    if (!response.ok) throw new Error(`品牌概览请求失败（HTTP ${response.status}）。`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || !rows.every(isBrandOverviewRow)) {
      throw new Error("品牌概览记录格式无效。");
    }
    return rows;
  } catch (error) {
    requestSignal.throwIfAborted();
    throw error instanceof Error ? error : new Error("品牌概览加载失败，请重试。");
  }
}
