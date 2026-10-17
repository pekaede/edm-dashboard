import { useMemo } from "react";
import { useSiteEmails, useSiteSelection } from "../site-data";
import { aggregateThreeWeek, buildSiteInsights, formatWindowRange } from "../three-week-aggregation";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

const INSIGHT_THEMES = ["price", "behavior", "new", "lifestyle"];

export function Insights() {
  const emailData = useSiteEmails();
  const { market, setMarket } = useSiteSelection();

  const aggregated = useMemo(
    () => (emailData.status === "ready" ? aggregateThreeWeek(emailData.emails) : null),
    [emailData.status, emailData.emails],
  );

  const insights = useMemo(
    () => (aggregated ? buildSiteInsights(aggregated) : []),
    [aggregated],
  );

  if (emailData.status !== "ready") {
    return (
      <Card title="关键洞察">
        <ExtendedEmailsState {...emailData} />
      </Card>
    );
  }

  if (!aggregated || aggregated.total === 0) {
    const marketLabel = getMarketLabel(market);
    const windowText = aggregated ? formatWindowRange(aggregated.window) : "2026-09-25 – 2026-10-16";
    return (
      <Card title="关键洞察" hint={`${emailData.meta.market} · 三周实时聚合`}>
        <div className="py-4">
          <EmptyState
            title={`${marketLabel}暂无三周洞察`}
            description={`该市场在三周聚合窗口（${windowText}）内暂无公开邮件收录记录，不推断主题偏好或触达策略。看板统计总量均为 Milled 公开收录样本，非品牌私域全量投递。`}
            actionLabel={market ? "切换至全部市场" : "重新拉取"}
            onAction={market ? () => setMarket(null) : emailData.retry}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card title="关键洞察" hint={`${emailData.meta.market} · 三周实时聚合`}>
      <ol className="grid h-full auto-rows-fr gap-3 text-sm leading-6 sm:grid-cols-2 xl:grid-cols-1">
        {insights.map((s, i) => (
          <li
            key={i}
            className="group flex min-h-24 gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 transition duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--surface-card)] hover:shadow-xs sm:gap-4 xl:items-center"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full border text-base font-bold text-[var(--text-heading)] shadow-xs"
              style={{
                background: THEME_TINTS[INSIGHT_THEMES[i % INSIGHT_THEMES.length]],
                borderColor: THEME_COLORS[INSIGHT_THEMES[i % INSIGHT_THEMES.length]],
              }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="text-[var(--text-body)]">{s}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
