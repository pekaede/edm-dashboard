import { useMemo } from "react";
import { DATA } from "../data";
import { countEmailsByMarket, useExtendedEmails } from "../email-data";
import { useSiteEmails, useSiteSelection } from "../site-data";
import { MarketFilter } from "./MarketFilter";
import { aggregateThreeWeek, formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

export function DashboardHeader() {
  const { status, emails, meta } = useSiteEmails();
  const allEmails = useExtendedEmails();
  const { market, setMarket } = useSiteSelection();
  const marketCounts = useMemo(() => countEmailsByMarket(allEmails.emails), [allEmails.emails]);
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  const tags = [
    { label: meta.market, theme: "price" },
    { label: meta.source, theme: "behavior" },
    { label: `${data ? data.total : "—"} 封样本（3 周）`, theme: "new" },
    {
      label: `3 个月有记录品牌 ${meta.brandCount} · 研究周期 ${meta.weekCount} 周`,
      theme: "lifestyle",
    },
  ];

  return (
    <header className="dashboard-container py-5 sm:py-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Email Marketing Intelligence</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-snug tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
            {DATA.meta.title}
          </h1>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="数据范围摘要">
            {tags.map(({ label, theme }) => (
              <li
                key={label}
                className="rounded-full border px-3 py-1.5 text-sm font-semibold text-slate-800"
                style={{
                  borderColor: `color-mix(in srgb, ${THEME_COLORS[theme]} 35%, var(--color-slate-200))`,
                  background: THEME_TINTS[theme],
                }}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 border-l-2 border-[var(--accent)] pl-3 lg:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">研究周期</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{formatWindowRange(THREE_WEEK_WINDOW)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
        <MarketFilter value={market} onChange={setMarket} counts={marketCounts} total={allEmails.total} label="全局站点（三个月）" />
        <p className="text-xs leading-5 text-slate-600">
          {meta.source} · 查询固定至 {meta.windowEnd}。站点联动看板、OnePage、邮件、日历和词云；跨市场对比独立选择。
          {status === "loading" ? " 计数加载中。" : null}
        </p>
      </div>
    </header>
  );
}
