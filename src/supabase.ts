export interface SupabaseEmailRow {
  brand: string;
  sent_date: string;
  day_seq: number;
  source_index: number;
  theme: string;
  keywords: string[];
  original_url: string | null;
}

const PAGE_SIZE = 200;

function isEmailRow(value: unknown): value is SupabaseEmailRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.brand === "string" &&
    typeof row.sent_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.sent_date) &&
    typeof row.theme === "string" &&
    typeof row.day_seq === "number" &&
    Number.isInteger(row.day_seq) && row.day_seq >= 0 &&
    typeof row.source_index === "number" &&
    Number.isInteger(row.source_index) && row.source_index >= 0 &&
    Array.isArray(row.keywords) &&
    row.keywords.every((keyword) => typeof keyword === "string") &&
    (row.original_url === null || typeof row.original_url === "string")
  );
}

export async function fetchAllEmails(): Promise<SupabaseEmailRow[]> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) {
    throw new Error("缺少 Supabase 本地环境配置。");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/rest/v1/emails`);
  } catch {
    throw new Error("Supabase 环境配置无效。");
  }
  endpoint.searchParams.set("select", "brand,sent_date,day_seq,source_index,theme,keywords,original_url");
  endpoint.searchParams.append("sent_date", "gte.2026-07-16");
  endpoint.searchParams.append("sent_date", "lte.2026-10-15");
  endpoint.searchParams.set("order", "sent_date.desc,brand.asc,day_seq.asc");
  endpoint.searchParams.set("limit", String(PAGE_SIZE));

  const rows: SupabaseEmailRow[] = [];
  let exactTotal: number | undefined;

  while (exactTotal === undefined || rows.length < exactTotal) {
    endpoint.searchParams.set("offset", String(rows.length));
    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: { apikey: publishableKey, Prefer: "count=exact" },
      });
    } catch {
      throw new Error("邮件请求失败，请检查网络后重试。");
    }
    if (!response.ok) {
      throw new Error(`邮件请求失败（HTTP ${response.status}）。`);
    }

    const totalMatch = response.headers.get("Content-Range")?.match(/\/(\d+)$/);
    const pageTotal = totalMatch ? Number(totalMatch[1]) : NaN;
    if (!Number.isSafeInteger(pageTotal) || pageTotal < 0) {
      throw new Error("邮件响应缺少精确总数，无法确认数据完整性。");
    }
    if (exactTotal !== undefined && exactTotal !== pageTotal) {
      throw new Error("邮件总数在加载期间发生变化，请重试。");
    }
    exactTotal = pageTotal;

    let page: unknown;
    try {
      page = await response.json();
    } catch {
      throw new Error("邮件响应格式无效。");
    }
    if (!Array.isArray(page) || !page.every(isEmailRow)) {
      throw new Error("邮件记录格式无效。");
    }
    if (page.length === 0 && rows.length < exactTotal) {
      throw new Error(`邮件分页未取齐（已取 ${rows.length} / ${exactTotal} 封）。`);
    }
    rows.push(...page);
    if (rows.length > exactTotal) {
      throw new Error("邮件返回条数超过精确总数，请重试。");
    }
  }

  return rows;
}
