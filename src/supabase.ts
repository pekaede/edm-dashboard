export interface SupabaseEmailRow {
  [column: string]: unknown;
  brand: string;
  sent_date: string;
  day_seq: number;
  source_index: number;
  theme: string;
  keywords: string[];
  original_url: string | null;
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
const SOURCE_KEY = ["market", "brand", "sent_date", "source_index", "day_seq"];

async function getEmailKeyColumns(baseUrl: string, publishableKey: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/rest/v1/`, {
      headers: { apikey: publishableKey, Accept: "application/openapi+json" },
      signal: AbortSignal.timeout(10000),
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
  } catch {}
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

export async function fetchEmailDataset(): Promise<EmailDataset> {
  const { baseUrl, publishableKey } = getSupabaseConfig();

  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/rest/v1/emails`);
  } catch {
    throw new Error("Supabase 环境配置无效。");
  }
  const keyColumns = await getEmailKeyColumns(baseUrl, publishableKey);
  const columns = new Set(["brand", "sent_date", "day_seq", "source_index", "theme", "keywords", "original_url", "market", ...keyColumns]);
  endpoint.searchParams.set("select", [...columns].join(","));
  endpoint.searchParams.append("sent_date", "gte.2026-07-16");
  endpoint.searchParams.append("sent_date", "lte.2026-10-15");
  const orderColumns = [...new Set(["sent_date", "brand", "day_seq", ...keyColumns])];
  endpoint.searchParams.set("order", orderColumns.map((column) => `${column}.${column === "sent_date" ? "desc" : "asc"}`).join(","));
  endpoint.searchParams.set("limit", String(PAGE_SIZE));

  const headers = { apikey: publishableKey, Prefer: "count=exact" };
  async function requestPage(method: "GET" | "HEAD" = "GET"): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(endpoint, { method, headers });
    } catch {
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
      return { rows, exactTotal };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("邮件加载失败，请重试。");
}

export async function fetchAllEmails(): Promise<SupabaseEmailRow[]> {
  return (await fetchEmailDataset()).rows;
}
