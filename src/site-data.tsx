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

export function SiteProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<MarketFilterValue>("US");
  // 跨市场对比视图独立多选：默认 US + UK，切换全局站点时不被覆盖
  const [comparisonMarkets, setComparisonMarkets] = useState<string[]>(["US", "UK"]);
  // 切站点时保留的筛选条件字典（如主题、品牌、排序等）
  const [filters, setFilters] = useState<Record<string, unknown>>({});

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

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
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

interface CachedSiteData {
  emails: EmailRecord[];
  total: number;
  meta: ExtendedEmailsResult["meta"];
}

/** 当前语言下的站点标签（getMarketLabel 走当前语言翻译）。 */
function siteMarketLabel(market: MarketFilterValue, dataSource: string): string {
  return `${getMarketLabel(market)}${dataSource === "json" ? "（历史 US 回滚源）" : ""}`;
}

export function useSiteEmails(): ExtendedEmailsResult {
  const data = useExtendedEmails();
  const { market } = useSiteSelection();
  // 订阅语言：meta.market 是按当前语言生成的标签，切换语言时必须重算，
  // 否则站点缓存会把上一种语言的标签（如 "United States"）带进新语言界面。
  const { locale } = useLocale();

  // 站点邮件缓存：已访问站点不重复过滤计算；底层数据变更时失效
  const cacheRef = useRef<{
    sourceEmails: EmailRecord[];
    sites: Map<MarketFilterValue, CachedSiteData>;
  }>({
    sourceEmails: [],
    sites: new Map(),
  });

  return useMemo(() => {
    // 数据源引用变化时重置缓存
    if (cacheRef.current.sourceEmails !== data.emails) {
      cacheRef.current = {
        sourceEmails: data.emails,
        sites: new Map(),
      };
    }

    const cached = cacheRef.current.sites.get(market);
    if (cached && data.status === "ready") {
      return {
        ...data,
        emails: cached.emails,
        total: cached.total,
        // 缓存里的 market 标签可能是旧语言生成的，返回前按当前语言重算。
        meta: { ...cached.meta, market: siteMarketLabel(market, data.meta.dataSource) },
      };
    }

    const emails = data.emails.filter((email) => matchesMarket(email, market));
    const nextMeta = {
      ...data.meta,
      market: siteMarketLabel(market, data.meta.dataSource),
      total: data.status === "ready" ? emails.length : null,
      brandCount: new Set(emails.map((email) => email.brand)).size,
    };

    const siteData: CachedSiteData = {
      emails,
      total: emails.length,
      meta: nextMeta,
    };

    if (data.status === "ready") {
      cacheRef.current.sites.set(market, siteData);
    }

    return {
      ...data,
      emails,
      total: emails.length,
      meta: nextMeta,
    };
  }, [data, market, locale]);
}

/** 共享当前站点的三周聚合入口；非 ready 状态保持空值，meta 沿用三个月口径。 */
export function useSiteThreeWeekData() {
  const site = useSiteEmails();
  const data = useMemo(
    () => (site.status === "ready" ? aggregateThreeWeek(site.emails) : null),
    [site.status, site.emails],
  );
  return { ...site, data };
}
