import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { matchesMarket, useExtendedEmails } from "./email-data";
import { getMarketLabel, type MarketFilterValue } from "./components/MarketFilter";

interface SiteSelection {
  market: MarketFilterValue;
  setMarket: (market: MarketFilterValue) => void;
}

const SiteContext = createContext<SiteSelection | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<MarketFilterValue>("US");
  const value = useMemo(() => ({ market, setMarket }), [market]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSiteSelection(): SiteSelection {
  const selection = useContext(SiteContext);
  if (!selection) throw new Error("站点视图需要 SiteProvider。");
  return selection;
}

export function useSiteEmails() {
  const data = useExtendedEmails();
  const { market } = useSiteSelection();
  return useMemo(() => {
    const emails = data.emails.filter((email) => matchesMarket(email, market));
    return {
      ...data,
      emails,
      total: emails.length,
      meta: {
        ...data.meta,
        market: `${getMarketLabel(market)}${data.meta.dataSource === "json" ? "（历史 US 回滚源）" : ""}`,
        total: data.status === "ready" ? emails.length : null,
        brandCount: new Set(emails.map((email) => email.brand)).size,
      },
    };
  }, [data.emails, data.meta, data.status, data.error, data.retry, market]);
}
