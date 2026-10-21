import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { matchesMarket, useExtendedEmails, type EmailRecord, type ExtendedEmailsResult } from "./email-data";
import { getMarketLabel, type MarketFilterValue } from "./components/MarketFilter";
import { useLocale } from "./i18n";
import { aggregateThreeWeek } from "./three-week-aggregation";

export interface SiteSelection {
  market: MarketFilterValue;
  setMarket: (market: MarketFilterValue) => void;
  /** 跨市场对比视图的多选状态（独立于全局单选站点，切站点时不被覆盖） */
  comparisonMarkets: string[];
  setComparisonMarkets: (markets: string[]) => void;
  /** 切站点时保留的筛选条件字典 */
  filters: Record<string, unknown>;
  setFilter: (key: string, value: unknown) => void;
  getFilter: <T>(key: string, defaultValue?: T) => T | undefined;
  clearFilters: () => void;
}

const SiteContext = createContext<SiteSelection | null>(null);

interface CachedSiteData {
  emails: EmailRecord[];
  total: number;
  threeWeekData: ReturnType<typeof aggregateThreeWeek> | null;
}

interface SiteDataValue {
  site: ExtendedEmailsResult;
  threeWeekData: CachedSiteData["threeWeekData"];
}

const SiteDataContext = createContext<SiteDataValue | null>(null);

/** 每个 Provider 独享缓存；同一数据版本按站点复用过滤和聚合结果。 */
function createSiteDataCache() {
  let sourceEmails: EmailRecord[] | null = null;
  const sites = new Map<MarketFilterValue, CachedSiteData>();

  return (
    emails: EmailRecord[],
    status: ExtendedEmailsResult["status"],
    market: MarketFilterValue,
  ): CachedSiteData => {
    // 刷新/重试/reset 后不复用旧版本；非 ready 的部分数据不进入缓存。
    if (sourceEmails !== emails || status !== "ready") {
      sourceEmails = emails;
      sites.clear();
    }
    const cached = sites.get(market);
    if (cached) return cached;

    const siteEmails = emails.filter((email) => matchesMarket(email, market));
    const siteData: CachedSiteData = {
      emails: siteEmails,
      total: siteEmails.length,
      threeWeekData: status === "ready" ? aggregateThreeWeek(siteEmails) : null,
    };
    if (status === "ready") sites.set(market, siteData);
    return siteData;
  };
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const data = useExtendedEmails();
  const { locale } = useLocale();
  const [market, setMarket] = useState<MarketFilterValue>("US");
  // 跨市场对比视图独立多选：默认 US + UK，切换全局站点时不被覆盖
  const [comparisonMarkets, setComparisonMarkets] = useState<string[]>(["US", "UK"]);
  // 切站点时保留的筛选条件字典（如主题、品牌、排序等）
  const [filters, setFilters] = useState<Record<string, unknown>>({});

  const cacheRef = useRef<ReturnType<typeof createSiteDataCache> | null>(null);
  if (cacheRef.current === null) cacheRef.current = createSiteDataCache();
  const cached = useMemo(
    () => cacheRef.current!(data.emails, data.status, market),
    [data.emails, data.status, market],
  );
  const siteData = useMemo<SiteDataValue>(() => ({
    site: {
      ...data,
      emails: cached.emails,
      total: cached.total,
      // 元数据不缓存：语言、来源、窗口或完整性变化时使用当前值。
      meta: {
        ...data.meta,
        market: siteMarketLabel(market, data.meta.dataSource),
        total: data.status === "ready" ? cached.total : null,
        brandCount: new Set(cached.emails.map((email) => email.brand)).size,
      },
    },
    threeWeekData: cached.threeWeekData,
  }), [data, cached, market, locale]);

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getFilter = useCallback(
    <T,>(key: string, defaultValue?: T): T | undefined => {
      return (filters[key] as T) ?? defaultValue;
    },
    [filters],
  );

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const value = useMemo<SiteSelection>(
    () => ({
      market,
      setMarket,
      comparisonMarkets,
      setComparisonMarkets,
      filters,
      setFilter,
      getFilter,
      clearFilters,
    }),
    [market, comparisonMarkets, filters, setFilter, getFilter, clearFilters],
  );

  return (
    <SiteContext.Provider value={value}>
      <SiteDataContext.Provider value={siteData}>{children}</SiteDataContext.Provider>
    </SiteContext.Provider>
  );
}

export function useSiteSelection(): SiteSelection {
  const selection = useContext(SiteContext);
  if (!selection) throw new Error("站点视图需要 SiteProvider。");
  return selection;
}

export function useComparisonMarkets(): [string[], (markets: string[]) => void] {
  const { comparisonMarkets, setComparisonMarkets } = useSiteSelection();
  return [comparisonMarkets, setComparisonMarkets];
}

export function useSiteFilters() {
  const { filters, setFilter, getFilter, clearFilters } = useSiteSelection();
  return { filters, setFilter, getFilter, clearFilters };
}

/** 当前语言下的站点标签（getMarketLabel 走当前语言翻译）。 */
function siteMarketLabel(market: MarketFilterValue, dataSource: string): string {
  return `${getMarketLabel(market)}${dataSource === "json" ? "（历史 US 回滚源）" : ""}`;
}

function useSiteData(): SiteDataValue {
  const data = useContext(SiteDataContext);
  if (!data) throw new Error("站点视图需要 SiteProvider。");
  return data;
}

export function useSiteEmails(): ExtendedEmailsResult {
  return useSiteData().site;
}

/** 共享当前站点的三周聚合入口；非 ready 状态保持空值，meta 沿用三个月口径。 */
export function useSiteThreeWeekData() {
  const { site, threeWeekData } = useSiteData();
  return { ...site, data: threeWeekData };
}
