import { useMemo } from "react";
import { useLocale } from "../i18n";
import { useSiteEmails, useSiteSelection } from "../site-data";
import { aggregateThreeWeek, buildSiteInsights, formatWindowRange, THREE_WEEK_WINDOW } from "../three-week-aggregation";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

const INSIGHT_THEMES = ["price", "behavior", "new", "lifestyle"];

export function Insights() {
  const { t, locale } = useLocale();
  const emailData = useSiteEmails();
  const { market, setMarket } = useSiteSelection();

  const aggregated = useMemo(
    () => (emailData.status === "ready" ? aggregateThreeWeek(emailData.emails) : null),
    [emailData.status, emailData.emails],
  );

  const insights = useMemo(
    () => (aggregated ? buildSiteInsights(aggregated, t) : []),
    // locale 必须入依赖：洞察句由注入的 t 按当前语言生成，切换语言要重算（t 本身每渲染重建，不直接入依赖）。
    [aggregated, locale],
  );

  if (emailData.status !== "ready") {
    return (
      <Card title={t("insightsTitle")}>
        <ExtendedEmailsState {...emailData} />
      </Card>
    );
  }

  if (!aggregated || aggregated.total === 0) {
    const marketLabel = getMarketLabel(market);
    const windowText = aggregated ? formatWindowRange(aggregated.window) : formatWindowRange(THREE_WEEK_WINDOW);
    return (
      <Card title={t("insightsTitle")} hint={`${emailData.meta.market} · ${t("insightsHint")}`}>
        <div className="py-4">
          <EmptyState
            title={`${marketLabel}${t("insightsEmptyTitle")}`}
            description={`${t("insightsEmptyDesc1")}${windowText}${t("insightsEmptyDesc2")}`}
            actionLabel={market ? t("insightsSwitchAll") : t("insightsRetry")}
            onAction={market ? () => setMarket(null) : emailData.retry}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card title={t("insightsTitle")} hint={`${emailData.meta.market} · ${t("insightsHint")}`}>
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
