export type ViewType = "report" | "emails" | "calendar" | "dashboard";

export interface PageState {
  view: ViewType;
  market: string | null;
  /**
   * 市场是否显式写在 URL 里。#emails 与 #emails/all 解析后的 market 都是 null，
   * 但语义不同：前者是“未写市场段的旧链接/视图导航”（保留当前站点），
   * 后者是“显式全部市场”（恢复全部市场）。没有这个字段，两者无法区分，
   * 前进后退也就无法恢复“全部市场”。
   */
  marketSpecified: boolean;
  brand: string;
  theme: string | null;
  query: string;
  /**
   * 邮件视图的日期范围（YYYY-MM-DD；空字符串表示未限定）。
   * 仅 emails 视图写入/恢复：其他视图的 hash 不携带日期参数，解析时也归一为空，
   * 保证"日期只属于邮件列表"的不变式。
   */
  dateFrom: string;
  dateTo: string;
}

export const KNOWN_MARKETS = new Set([
  "us",
  "uk",
  "au",
  "fr",
  "de",
  "it",
  "nl",
  "es",
  "eu",
  // 注意：不要加入 "other"——#emails/other 是“其他”主题的旧深链接（主题图例生成），
  // 而 "other" 不是真实市场；若把 "other" 当市场，主题链接会被误读为市场、邮件列表为空。
  // 代价：market "other"（无任何界面产生）不再 round-trip，主题 "other"（真实链接）优先。
]);

export const KNOWN_THEMES = new Set([
  "price",
  "behavior",
  "new",
  "lifestyle",
  "category",
  "other",
]);

export const DEFAULT_PAGE_STATE: PageState = {
  view: "report",
  market: null,
  marketSpecified: false,
  brand: "all",
  theme: null,
  query: "",
  dateFrom: "",
  dateTo: "",
};

function safeDecode(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function normalizeMarket(market: string | null): string | null {
  const value = market?.trim();
  return !value || value.toLowerCase() === "all" ? null : value.toUpperCase();
}

function normalizeTheme(theme: string | null): string | null {
  const value = theme?.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  return KNOWN_THEMES.has(lower) ? lower : value;
}

/**
 * 日期参数只接受 YYYY-MM-DD 形式（与 <input type="date"> 的值格式一致）；
 * 非法值归一为空，避免脏参数把邮件列表筛成空。
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeISODate(value: string | null | undefined): string {
  const v = value?.trim() ?? "";
  // 正则只看形状；Date.parse 再挡掉 2026-99-99 这类不存在的日历日期。
  return ISO_DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? v : "";
}

/**
 * Encodes PageState into a reversible URL hash, e.g. #emails/US/all/price?q=xxx
 */
export function buildHash(state: PageState): string {
  const view: ViewType =
    state.view === "report" ||
    state.view === "emails" ||
    state.view === "calendar" ||
    state.view === "dashboard"
      ? state.view
      : "report";

  const market = normalizeMarket(state.market);
  const marketSpecified = state.marketSpecified === true;
  const brand = state.brand && state.brand.trim() !== "" ? state.brand.trim() : "all";
  const theme = normalizeTheme(state.theme);
  const query = typeof state.query === "string" ? state.query : "";

  // Segment layout: [view, market, brand, theme]
  // Trailing default values can be omitted while preserving exact round-trip.
  // market 为 null 时：marketSpecified 为 true（显式全部市场）写 "all" 段；
  // 为 false（未写市场段）且无主题时省略市场段；有主题时保持旧短链接形式 #emails/<theme>。
  // 注意："all" 不是真实市场；parseHash 会把 "all" 段还原为 null + marketSpecified=true。
  const marketSeg =
    market !== null ? market : marketSpecified ? "all" : "";
  let segments: string[];
  if (
    theme !== null &&
    market === null &&
    !marketSpecified &&
    brand === "all" &&
    KNOWN_THEMES.has(theme.toLowerCase())
  ) {
    // 旧主题短链接形式，保持 round-trip（#emails/price → #emails/price）。
    // 仅当主题段重解析仍为主题时压缩：品牌非 all 时短形式会丢品牌；主题不在
    // 已知主题集时（如 theme:US 的 US、任意未知主题），短形式重解析会被误读为
    // 市场。这两种情况必须用完整位置段形式（#emails//Zara/price、#emails//all/US）。
    segments = [view, theme];
  } else if (theme !== null) {
    segments = [view, marketSeg, brand, theme];
  } else if (brand !== "all") {
    segments = [view, marketSeg, brand];
  } else if (market !== null) {
    segments = [view, market];
  } else if (marketSpecified) {
    segments = [view, "all"];
  } else {
    segments = [view];
  }

  const encodedPath = segments.map((s) => encodeURIComponent(s)).join("/");
  // 查询参数：搜索词 q 与（仅 emails 视图的）日期范围 from/to。
  // 日期以 from/to 命名避开与站点/品牌路径段的歧义；数字与连字符无需转义，
  // URL 保持可读（如 #emails/US/all/price?q=coat&from=2026-10-01&to=2026-10-20）。
  const queryParams: string[] = [];
  if (query) queryParams.push(`q=${encodeURIComponent(query)}`);
  if (state.view === "emails") {
    const dateFrom = normalizeISODate(state.dateFrom);
    const dateTo = normalizeISODate(state.dateTo);
    if (dateFrom) queryParams.push(`from=${dateFrom}`);
    if (dateTo) queryParams.push(`to=${dateTo}`);
  }
  const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

  return `#${encodedPath}${queryString}`;
}

/**
 * Decodes URL hash back into PageState. Falls back gracefully on missing or invalid parts.
 */
export function parseHash(hash: string): PageState {
  if (!hash) {
    return { ...DEFAULT_PAGE_STATE };
  }

  // Strip leading '#' and '/'
  let raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw.startsWith("/")) {
    raw = raw.slice(1);
  }

  const qIdx = raw.indexOf("?");
  const pathPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const searchPart = qIdx >= 0 ? raw.slice(qIdx + 1) : "";

  let query = "";
  let dateFrom = "";
  let dateTo = "";
  if (searchPart) {
    try {
      const params = new URLSearchParams(searchPart);
      query = params.get("q") ?? "";
      dateFrom = normalizeISODate(params.get("from"));
      dateTo = normalizeISODate(params.get("to"));
    } catch {
      query = "";
    }
  }

  const rawSegments = pathPart ? pathPart.split("/").map(safeDecode) : [];

  const rawView = rawSegments[0] ?? "";
  const view: ViewType =
    rawView === "report" ||
    rawView === "emails" ||
    rawView === "calendar" ||
    rawView === "dashboard"
      ? rawView
      : "report";

  const rawMarket = rawSegments[1];
  const rawBrand = rawSegments[2];
  const rawTheme = rawSegments[3];

  let market: string | null = null;
  let marketSpecified = false;
  let brand = "all";
  let theme: string | null = null;

  // Short format single-argument resolution: #emails/xyz
  if (rawSegments.length === 2) {
    const seg = rawSegments[1]?.trim() ?? "";
    const lower = seg.toLowerCase();
    if (lower === "all") {
      // 显式“全部市场”（buildHash 为 null 市场写出的 "all" 段）
      market = null;
      theme = null;
      marketSpecified = true;
    } else if (seg.toLowerCase().startsWith("theme:")) {
      const rawVal = seg.slice(6).trim();
      theme = rawVal || null;
      market = null;
      marketSpecified = false;
    } else {
      if (KNOWN_MARKETS.has(lower)) {
        // Known market resolves as market
        market = seg || null;
        theme = null;
        marketSpecified = true;
      } else if (KNOWN_THEMES.has(lower)) {
        // Known legacy theme (e.g. #emails/price, #emails/other) resolves as theme
        market = null;
        theme = seg || null;
        marketSpecified = false;
      } else {
        // Unknown single segment defaults to market
        market = seg || null;
        theme = null;
        marketSpecified = true;
      }
    }
    brand = "all";
  } else {
    // Positional round-trip: segment 1 is always prioritized as market;
    // "all" segment means 全部市场 (null).
    // 空段（#emails//…）视作未指定市场。
    marketSpecified =
      rawMarket !== undefined && rawMarket.trim() !== "";
    market =
      rawMarket === undefined ||
      rawMarket.trim() === "" ||
      rawMarket.trim().toLowerCase() === "all"
        ? null
        : rawMarket.trim();

    brand =
      rawBrand === undefined || rawBrand.trim() === ""
        ? "all"
        : rawBrand.trim();

    theme =
      rawTheme === undefined || rawTheme.trim() === ""
        ? null
        : rawTheme.trim();
  }

  return {
    view,
    market: normalizeMarket(market),
    marketSpecified,
    brand,
    theme: normalizeTheme(theme),
    query,
    // 日期只属于邮件列表：非 emails 视图的 from/to 参数直接丢弃，
    // 与 buildHash"仅 emails 视图写日期"对称，保证往返归一。
    dateFrom: view === "emails" ? dateFrom : "",
    dateTo: view === "emails" ? dateTo : "",
  };
}

/**
 * Event name for synchronized URL state updates across components.
 */
export const URL_SYNC_EVENT = "edm_url_state_changed";

/**
 * Dispatches a notification that the URL hash state has changed externally (via replaceState / pushState).
 */
export function notifyUrlChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(URL_SYNC_EVENT));
  } catch {
    // Ignore in environments without CustomEvent
  }
}

/**
 * Compares two PageStates for deep equality.
 */
export function isEqualPageState(a: PageState, b: PageState): boolean {
  return (
    a.view === b.view &&
    a.market === b.market &&
    a.marketSpecified === b.marketSpecified &&
    a.brand === b.brand &&
    a.theme === b.theme &&
    a.query === b.query &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo
  );
}
