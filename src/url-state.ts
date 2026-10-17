export type ViewType = "report" | "emails" | "calendar";

export interface PageState {
  view: ViewType;
  market: string | null;
  brand: string;
  theme: string | null;
  query: string;
}

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
    state.view === "report" || state.view === "emails" || state.view === "calendar"
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
    rawView === "report" || rawView === "emails" || rawView === "calendar"
      ? rawView
      : "report";

  const rawMarket = rawSegments[1];
  const market = rawMarket === undefined || rawMarket.trim() === "" ? null : rawMarket.trim();

  const rawBrand = rawSegments[2];
  const brand = rawBrand === undefined || rawBrand.trim() === "" ? "all" : rawBrand.trim();

  const rawTheme = rawSegments[3];
  const theme = rawTheme === undefined || rawTheme.trim() === "" ? null : rawTheme.trim();

  return {
    view,
    market,
    brand,
    theme,
    query,
  };
}
