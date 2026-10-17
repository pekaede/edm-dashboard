export type ViewType = "report" | "emails" | "calendar" | "dashboard";

export interface PageState {
  view: ViewType;
  market: string | null;
  brand: string;
  theme: string | null;
  query: string;
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
  "other",
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
  brand: "all",
  theme: null,
  query: "",
};

function safeDecode(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
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

  const market = state.market && state.market.trim() !== "" ? state.market.trim() : null;
  const brand = state.brand && state.brand.trim() !== "" ? state.brand.trim() : "all";
  const theme = state.theme && state.theme.trim() !== "" ? state.theme.trim() : null;
  const query = typeof state.query === "string" ? state.query : "";

  // Segment layout: [view, market, brand, theme]
  // Trailing default values can be omitted while preserving exact round-trip
  let segments: string[];
  if (theme !== null) {
    segments = [view, market ?? "", brand, theme];
  } else if (brand !== "all") {
    segments = [view, market ?? "", brand];
  } else if (market !== null) {
    segments = [view, market];
  } else {
    segments = [view];
  }

  const encodedPath = segments.map((s) => encodeURIComponent(s)).join("/");
  const queryString = query ? `?q=${encodeURIComponent(query)}` : "";

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
  if (searchPart) {
    try {
      const params = new URLSearchParams(searchPart);
      query = params.get("q") ?? "";
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
  let brand = "all";
  let theme: string | null = null;

  // Short format single-argument resolution: #emails/xyz
  if (rawSegments.length === 2) {
    const seg = rawSegments[1]?.trim() ?? "";
    if (seg.toLowerCase().startsWith("theme:")) {
      const rawVal = seg.slice(6).trim();
      theme = rawVal || null;
      market = null;
    } else {
      const lower = seg.toLowerCase();
      if (KNOWN_MARKETS.has(lower)) {
        // Known market (including 'other') resolves as market
        market = seg || null;
        theme = null;
      } else if (KNOWN_THEMES.has(lower)) {
        // Known legacy theme (e.g. #emails/price) resolves as theme
        market = null;
        theme = seg || null;
      } else {
        // Unknown single segment defaults to market
        market = seg || null;
        theme = null;
      }
    }
    brand = "all";
  } else {
    // Positional round-trip: segment 1 is always prioritized as market
    market =
      rawMarket === undefined || rawMarket.trim() === ""
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
    market,
    brand,
    theme,
    query,
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
    a.brand === b.brand &&
    a.theme === b.theme &&
    a.query === b.query
  );
}
