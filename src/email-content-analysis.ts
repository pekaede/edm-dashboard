/**
 * @file email-content-analysis.ts
 * @description “内容 AI 分析”读取层：TS 类型 + 结果校验 + 只读拉取。
 *
 * 契约（与离线 pipeline、SQL 共用，见 supabase/email_content_analysis.sql）：
 * - 前端只读视图 email_content_analysis_current，不直接读基表。
 * - 读取：显式选列、按稳定唯一键排序、分页拉全并核对总数（Prefer: count=exact），
 *   绝不假设一次响应完整（Supabase 默认单次最多 1000 行）。
 * - result 校验失败的行当作 failed 处理（result 置 null），不返回脏数据。
 * - dominant_colors 口径是色族枚举（见 src/banner-vision-prompt.ts
 *   COLOR_FAMILIES），不是 #RRGGBB Hex：模型不编 Hex（编造风险），
 *   真实 Hex 由图像算法提取并归一成色族；Hex 结果校验失败 ⇒ 按 failed 处理。
 * - 公开 Key 只放 apikey 头，不放 Bearer。
 * - 邮件身份是真实 4 元组 (market, brand, sent_date, day_seq)，
 *   与 emails 主键（emails_pkey）一致；读取/排序/去重键用该 4 元组。
 *   source_index 不是主键的一部分，绝不进邮件关联键。
 * - 三周窗口不由本文件定义；调用方从 src/three-week-aggregation.ts 传入
 *   --start/--end 对应的 start/end（22 天）。
 */

import {
  BANNER_COMPOSITIONS,
  BANNER_CTA_POSITIONS,
  BANNER_SEASONAL_CUES,
  BANNER_TEXT_IMAGE_RATIOS,
  COLOR_FAMILIES,
  type BannerSeasonalCue,
} from "./banner-vision-prompt";

/** 趋势词分类（与 pipeline 口径一致）：时尚 / 趋势 / 热点 / 季节 / 营销事件。 */
export const TREND_CATEGORIES = ["fashion", "trend", "hotspot", "seasonal", "marketing"] as const;
export type TrendCategory = (typeof TREND_CATEGORIES)[number];

export interface TrendTerm {
  term: string;
  category: TrendCategory;
}

export interface SubjectAnalysis {
  tactics: string[];
  discount_framing: string | null;
  length_chars: number;
  emoji_count: number;
  cta_verbs: string[];
  personalization: boolean;
  /** v2 新增：趋势/热点/季节词抽取。v1 结果没有此字段，读取层按可选处理（缺失视为 []）。 */
  trend_terms?: TrendTerm[];
}

export interface BannerAnalysis {
  dominant_colors: string[];
  composition: string;
  cta_presence: boolean;
  cta_position: string | null;
  text_image_ratio: string;
  seasonal_cues: BannerSeasonalCue[];
}

export type AnalysisStatus = "pending" | "processing" | "success" | "failed" | "skipped";

export interface EmailContentAnalysisRow {
  market: string;
  brand: string;
  sent_date: string;
  day_seq: number;
  analysis_type: "subject" | "banner";
  status: AnalysisStatus;
  result: SubjectAnalysis | BannerAnalysis | null;
  analyzed_at: string | null;
  /** 视图所选结果的输入是否与最新尝试不同；不改变 status / analyzed_at 的历史结果语义。 */
  is_stale: boolean;
}

export interface FetchContentAnalysisParams {
  market: string;
  start: string;
  end: string;
  /** 可选：调用方取消时中止底层 fetch（组件卸载时用）。 */
  signal?: AbortSignal;
}

/** 数据完整性失败（分页未取齐、总数变化、标识重复等），与网络/配置错误区分。 */
export class ContentAnalysisIncompleteError extends Error {
  readonly code = "incomplete" as const;
  constructor(message: string) {
    super(message);
    this.name = "ContentAnalysisIncompleteError";
  }
}

const ANALYSIS_TYPES = ["subject", "banner"] as const;
const ANALYSIS_STATUSES: readonly AnalysisStatus[] = [
  "pending",
  "processing",
  "success",
  "failed",
  "skipped",
];
// Banner 枚举一律以 banner-vision-prompt.ts 为规范源（本文件不再自备副本，避免口径漂移）。
const BANNER_COMPOSITION_SET: ReadonlySet<string> = new Set(BANNER_COMPOSITIONS);
const BANNER_CTA_POSITION_SET: ReadonlySet<string> = new Set(BANNER_CTA_POSITIONS);
const BANNER_TEXT_IMAGE_RATIO_SET: ReadonlySet<string> = new Set(BANNER_TEXT_IMAGE_RATIOS);
const BANNER_SEASONAL_CUE_SET: ReadonlySet<string> = new Set(BANNER_SEASONAL_CUES);
const COLOR_FAMILY_SET: ReadonlySet<string> = new Set(COLOR_FAMILIES);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}

/** 数组去重（保序）。校验函数本身不做去重——重复视为脏数据；去重在 normalize 层做。 */
function dedupe<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function isNonNegativeSafeInt(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0
  );
}

/**
 * 校验 SubjectAnalysis。严格项：字段齐全且类型正确、数组元素为非空字符串
 * 且无重复、length_chars / emoji_count 为非负安全整数。
 * 未知多余字段允许（向前兼容），不拒绝。
 */
const TREND_CATEGORY_SET: ReadonlySet<string> = new Set(TREND_CATEGORIES);

/** trend_terms 是 v2 可选字段：缺失合法；出现时必须是 {term, category} 数组、词不重复、分类在枚举内。 */
function isValidTrendTerms(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return false;
    if (typeof item.term !== "string" || item.term.trim().length === 0) return false;
    if (typeof item.category !== "string" || !TREND_CATEGORY_SET.has(item.category)) return false;
    const key = item.term.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

export function validateSubjectAnalysis(v: unknown): v is SubjectAnalysis {
  if (!isRecord(v)) return false;
  return (
    isNonEmptyStringArray(v.tactics) &&
    !hasDuplicates(v.tactics) &&
    (v.discount_framing === null || typeof v.discount_framing === "string") &&
    isNonNegativeSafeInt(v.length_chars) &&
    isNonNegativeSafeInt(v.emoji_count) &&
    isNonEmptyStringArray(v.cta_verbs) &&
    !hasDuplicates(v.cta_verbs) &&
    typeof v.personalization === "boolean" &&
    isValidTrendTerms(v.trend_terms)
  );
}

/**
 * 校验 BannerAnalysis。严格项：dominant_colors 为色族枚举（最多 5 项，
 * 含 Hex 在内的非色族值均拒绝）、composition /
 * text_image_ratio / cta_position / seasonal_cues 在枚举内、数组无重复、
 * 字段间约束 cta_presence=false ⇒ cta_position 必须为 null。
 */
export function validateBannerAnalysis(v: unknown): v is BannerAnalysis {
  if (!isRecord(v)) return false;
  if (
    !Array.isArray(v.dominant_colors) ||
    v.dominant_colors.length > 5 ||
    !v.dominant_colors.every(
      (color) => typeof color === "string" && COLOR_FAMILY_SET.has(color),
    ) ||
    hasDuplicates(v.dominant_colors)
  ) {
    return false;
  }
  if (
    typeof v.composition !== "string" ||
    !BANNER_COMPOSITION_SET.has(v.composition)
  ) {
    return false;
  }
  if (typeof v.cta_presence !== "boolean") return false;
  if (
    v.cta_position !== null &&
    (typeof v.cta_position !== "string" ||
      !BANNER_CTA_POSITION_SET.has(v.cta_position))
  ) {
    return false;
  }
  // 字段间约束：无 CTA 时位置必须为 null。
  if (v.cta_presence === false && v.cta_position !== null) return false;
  if (
    typeof v.text_image_ratio !== "string" ||
    !BANNER_TEXT_IMAGE_RATIO_SET.has(v.text_image_ratio)
  ) {
    return false;
  }
  if (
    !isNonEmptyStringArray(v.seasonal_cues) ||
    !v.seasonal_cues.every((cue) => BANNER_SEASONAL_CUE_SET.has(cue)) ||
    hasDuplicates(v.seasonal_cues)
  ) {
    return false;
  }
  return true;
}

/** 读取边界归一化：数组去重、颜色统一小写色族（非色族值已由校验拒绝）、cta_presence=false 时强制位置为 null。 */
function normalizeSubjectAnalysis(v: SubjectAnalysis): SubjectAnalysis {
  const seenTerms = new Set<string>();
  const trendTerms: TrendTerm[] = [];
  for (const item of v.trend_terms ?? []) {
    const term = item.term.trim();
    const key = term.toLowerCase();
    if (!term || seenTerms.has(key)) continue;
    seenTerms.add(key);
    trendTerms.push({ term, category: item.category });
  }
  return {
    tactics: dedupe(v.tactics),
    discount_framing: v.discount_framing,
    length_chars: v.length_chars,
    emoji_count: v.emoji_count,
    cta_verbs: dedupe(v.cta_verbs),
    personalization: v.personalization,
    trend_terms: trendTerms,
  };
}

function normalizeBannerAnalysis(v: BannerAnalysis): BannerAnalysis {
  return {
    dominant_colors: dedupe(v.dominant_colors.map((color) => color.toLowerCase())).slice(0, 5),
    composition: v.composition,
    cta_presence: v.cta_presence,
    cta_position: v.cta_presence ? v.cta_position : null,
    text_image_ratio: v.text_image_ratio,
    seasonal_cues: dedupe(v.seasonal_cues),
  };
}

function isContentAnalysisRow(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return (
    typeof value.market === "string" &&
    typeof value.brand === "string" &&
    typeof value.sent_date === "string" &&
    DATE_RE.test(value.sent_date) &&
    typeof value.day_seq === "number" &&
    Number.isSafeInteger(value.day_seq) &&
    value.day_seq >= 0 &&
    (value.analysis_type === "subject" || value.analysis_type === "banner") &&
    typeof value.status === "string" &&
    (ANALYSIS_STATUSES as readonly string[]).includes(value.status) &&
    (value.analyzed_at === null || typeof value.analyzed_at === "string") &&
    typeof value.is_stale === "boolean"
  );
}

/**
 * 只读拉取某市场某窗口的“内容 AI 分析”结果（读视图，不读基表）。
 * result 校验失败的行当作 failed 处理（result 置 null），不返回脏数据；
 * 非 success 行若带有 result 也丢弃（基表约束保证仅 success 有 result，
 * 此处防御性处理）。
 */
export async function fetchContentAnalysis(
  params: FetchContentAnalysisParams,
): Promise<EmailContentAnalysisRow[]> {
  const { market, start, end, signal } = params;
  if (typeof market !== "string" || market.trim().length === 0) {
    throw new Error("fetchContentAnalysis: market 不能为空。");
  }
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    throw new Error(
      `fetchContentAnalysis: 无效窗口 ${start} – ${end}（需 YYYY-MM-DD 且 start <= end）。`,
    );
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) {
    throw new Error("缺少 Supabase 本地环境配置。");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(
      `${baseUrl.replace(/\/+$/, "")}/rest/v1/email_content_analysis_current`,
    );
  } catch {
    throw new Error("Supabase 环境配置无效。");
  }
  // 显式选列：绝不 select *（视图列变更时不静默吞入脏字段）。
  endpoint.searchParams.set(
    "select",
    "market,brand,sent_date,day_seq,analysis_type,status,result,analyzed_at,is_stale",
  );
  endpoint.searchParams.append("market", `eq.${market}`);
  endpoint.searchParams.append("sent_date", `gte.${start}`);
  endpoint.searchParams.append("sent_date", `lte.${end}`);
  // 稳定唯一键排序：与视图 DISTINCT ON 键一致，保证分页无遗漏/重复。
  endpoint.searchParams.set(
    "order",
    "market.asc,brand.asc,sent_date.asc,day_seq.asc,analysis_type.asc",
  );
  const PAGE_SIZE = 200;
  endpoint.searchParams.set("limit", String(PAGE_SIZE));

  // 公开 Key 只放 apikey 头，不放 Bearer（见旧 email-content.ts 的反模式）。
  const headers = { apikey: publishableKey, Prefer: "count=exact" };

  const readExactTotal = (response: Response): number => {
    const total = response.headers
      .get("Content-Range")
      ?.match(/\/(\d+)$/)?.[1];
    const parsed = total === undefined ? NaN : Number(total);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new ContentAnalysisIncompleteError(
        "分析响应缺少精确总数，无法确认数据完整性。",
      );
    }
    return parsed;
  };

  const requestPage = async (method: "GET" | "HEAD" = "GET"): Promise<Response> => {
    let response: Response;
    try {
      response = await fetch(endpoint, { method, headers, signal });
    } catch (error) {
      // 调用方取消（组件卸载）不是请求失败：原样抛出，由调用方按 aborted 忽略。
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw error;
      }
      throw new Error("分析请求失败，请检查网络后重试。");
    }
    if (!response.ok) throw new Error(`分析请求失败（HTTP ${response.status}）。`);
    return response;
  };

  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      endpoint.searchParams.set("offset", "0");
      const exactTotal = readExactTotal(await requestPage("HEAD"));
      const rows: EmailContentAnalysisRow[] = [];
      const identities = new Set<string>();
      while (rows.length < exactTotal) {
        endpoint.searchParams.set("offset", String(rows.length));
        const response = await requestPage();
        if (readExactTotal(response) !== exactTotal) {
          throw new ContentAnalysisIncompleteError(
            "分析总数在加载期间发生变化，请重试。",
          );
        }
        const page: unknown = await response.json();
        if (!Array.isArray(page)) {
          throw new ContentAnalysisIncompleteError("分析记录格式无效。");
        }
        if (page.length === 0) {
          throw new ContentAnalysisIncompleteError(
            `分析分页未取齐（已取 ${rows.length} / ${exactTotal} 行）。`,
          );
        }
        for (const raw of page) {
          if (!isContentAnalysisRow(raw)) {
            throw new ContentAnalysisIncompleteError("分析记录格式无效。");
          }
          const identity = JSON.stringify([
            raw.market,
            raw.brand,
            raw.sent_date,
            raw.day_seq,
            raw.analysis_type,
          ]);
          if (identities.has(identity)) {
            throw new ContentAnalysisIncompleteError(
              "分析分页存在重复标识，已拒绝本次结果并重新加载。",
            );
          }
          identities.add(identity);

          const analysisType = raw.analysis_type as "subject" | "banner";
          const status = raw.status as AnalysisStatus;
          let result: SubjectAnalysis | BannerAnalysis | null = null;
          // 仅 success 行接受 result；校验失败 ⇒ 当作 failed，不返回脏数据。
          if (status === "success") {
            const valid =
              analysisType === "subject"
                ? validateSubjectAnalysis(raw.result)
                : validateBannerAnalysis(raw.result);
            if (valid) {
              result =
                analysisType === "subject"
                  ? normalizeSubjectAnalysis(raw.result as SubjectAnalysis)
                  : normalizeBannerAnalysis(raw.result as BannerAnalysis);
            } else {
              // 校验失败：降级为 failed，result 置 null。
              rows.push({
                market: raw.market as string,
                brand: raw.brand as string,
                sent_date: raw.sent_date as string,
                day_seq: raw.day_seq as number,
                analysis_type: analysisType,
                status: "failed",
                result: null,
                analyzed_at: null,
                is_stale: raw.is_stale as boolean,
              });
              continue;
            }
          }
          rows.push({
            market: raw.market as string,
            brand: raw.brand as string,
            sent_date: raw.sent_date as string,
            day_seq: raw.day_seq as number,
            analysis_type: analysisType,
            status,
            result,
            analyzed_at: raw.analyzed_at as string | null,
            is_stale: raw.is_stale as boolean,
          });
        }
        if (rows.length > exactTotal) {
          throw new ContentAnalysisIncompleteError(
            "分析返回条数超过精确总数，请重试。",
          );
        }
      }
      endpoint.searchParams.set("offset", "0");
      if (readExactTotal(await requestPage("HEAD")) !== exactTotal) {
        throw new ContentAnalysisIncompleteError(
          "分析总数在加载期间发生变化，请重试。",
        );
      }
      if (rows.length !== exactTotal || identities.size !== rows.length) {
        throw new ContentAnalysisIncompleteError(
          "分析条数或唯一标识数与精确总数不一致。",
        );
      }
      return rows;
    } catch (error) {
      // 调用方已取消：不再重试，直接抛出（否则取消会被重试循环抵消）。
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("分析加载失败，请重试。");
}
