import type { Brand } from "../data";
import { useLocale } from "../i18n";
import { useSiteThreeWeekData, useSiteSelection } from "../site-data";
import {
  buildAggregatedBrand,
  formatWindowRange,
  THREE_WEEK_WINDOW,
  windowDays,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { Tooltip } from "./Tooltip";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--control-active-bg)] [&_button]:text-[var(--control-active-text)] [&_button:hover]:bg-[var(--control-active-hover-bg)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

const HEATMAP_LEVELS = [
  { label: "0", background: "var(--calendar-heat-empty)", color: "var(--calendar-heat-empty-text)" },
  { label: "1–4", background: "var(--calendar-heat-1)", color: "var(--calendar-heat-text)" },
  { label: "5–9", background: "var(--calendar-heat-2)", color: "var(--calendar-heat-text)" },
  { label: "10–14", background: "var(--calendar-heat-3)", color: "var(--calendar-heat-text)" },
  { label: "15–19", background: "var(--calendar-heat-4)", color: "var(--calendar-heat-strong-text)" },
  { label: "20+", background: "var(--calendar-heat-5)", color: "var(--calendar-heat-strong-text)" },
];

function getHeatmapStyle(count: number) {
  const level = HEATMAP_LEVELS[Math.min(5, count === 0 ? 0 : Math.floor(count / 5) + 1)];
  return {
    background: level.background,
    color: level.color,
  };
}

interface CampaignOverviewProps {
  onSelectBrand: (brand: Brand) => void;
}

export function CampaignOverview({ onSelectBrand }: CampaignOverviewProps) {
  const { t } = useLocale();
  const { status, total, error, retry, meta, data } = useSiteThreeWeekData();
  const { market, setMarket } = useSiteSelection();

  const hint = data
    ? `${meta.market} · ${t("campaignHintRealtime")}${formatWindowRange(data.window)}${t("campaignHintTotalPart")}${data.total}${t("campaignHintDiffPart")}${meta.total}${t("campaignHintDescPart")}`
    : `${meta.market} · ${t("campaignHintRealtime")}${formatWindowRange(THREE_WEEK_WINDOW)}${t("campaignHintFallback")}`;

  if (status !== "ready" || !data) {
    return (
      <Card title={t("campaignTitle")} hint={hint}>
        <ExtendedEmailsState status={status} total={total} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <Card title={t("campaignTitle")} hint={hint}>
        <div className={EMPTY_STATE_CLASS_NAME}>
          <EmptyState
            title={t("campaignEmptyTitle")}
            description={t("campaignEmptyDesc")}
            actionLabel={market === null ? t("campaignRetry") : t("campaignSwitchAll")}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      </Card>
    );
  }

  const grandTotal = data.grandTotal;

  return (
    <Card
      title={t("campaignTitle")}
      hint={hint}
    >
      <p className="mb-3 text-xs leading-5 text-[var(--text-secondary)]">
        {t("campaignScaleNote")}
      </p>
      <div
        className="overflow-x-auto rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
        role="region"
        aria-label={t("campaignTableAriaLabel")}
        tabIndex={0}
      >
        <table className="w-full min-w-[23rem] border-collapse text-xs sm:text-sm">
          <caption className="sr-only">{meta.market}，{formatWindowRange(data.window)}{t("campaignCaptionUnit")}</caption>
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--surface-subtle)]/90 text-[var(--text-body)]">
              <th scope="col" className="py-2.5 pl-3 pr-2 text-left font-semibold">{t("campaignBrand")}</th>
              {data.weeks.map((w) => (
                <th key={w.id} scope="col" className="px-2 py-2 text-center font-semibold">
                  <div>{w.label}</div>
                  <div className="text-xs font-normal text-[var(--text-secondary)]">{w.range}</div>
                  <div className="text-xs font-normal text-[var(--text-secondary)]">{t("campaignWeekDays", { days: windowDays(w) })}</div>
                </th>
              ))}
              <th scope="col" className="border-l border-[var(--border-default)] px-2 py-2 text-center font-semibold text-[var(--text-body)]">
                {t("campaignTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.brands.map((b) => (
              <tr
                key={b.name}
                className="border-b border-[var(--divider)] transition-colors hover:bg-[var(--surface-subtle)]/50"
              >
                <th scope="row" className="py-2 pl-3 pr-2 font-medium">
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center rounded-md px-1.5 py-0.5 text-left font-semibold text-[var(--text-body)] transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]"
                    onClick={() => onSelectBrand(buildAggregatedBrand(data, b.name, t))}
                  >
                    {b.name}
                  </button>
                </th>

                {b.weekly.map((n, colIndex) => {
                  const style = getHeatmapStyle(n);
                  const week = data.weeks[colIndex];
                  // 空窗口（grandTotal = 0）时 0/0 为 NaN，守分母显 0.0%。
                  const pct = grandTotal > 0 ? ((n / grandTotal) * 100).toFixed(1) : "0.0";
                  // 各周覆盖天数不一（W3 为窗口余数天），tooltip 给日均便于横向比。
                  const days = windowDays(week);
                  const perDay = days > 0 ? (n / days).toFixed(1) : "0.0";

                  return (
                    <td key={colIndex} className="p-1 text-center">
                      <Tooltip
                        className="flex h-11 w-full items-center justify-center rounded-md transition-shadow hover:ring-2 hover:ring-[var(--control-focus)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
                        label={`${b.name}，${week.label}，${week.range}：${n}${t("campaignTooltipLabelEmails")}${pct}${t("campaignTooltipLabelSuffix")}`}
                        content={<>
                          <div className="font-semibold">{b.name} · {week.label}（{week.range}）</div>
                          <div className="mt-1 font-mono font-bold">{n} {t("campaignTooltipEmails")} · {t("campaignTooltipShare")} {pct}%</div>
                          <div className="mt-1">{t("campaignTooltipPerDay")} {perDay} {t("campaignTooltipEmails")} · {t("campaignWeekDays", { days })}</div>
                          <div className="mt-1">{meta.market} · {t("campaignTooltipDenominator")} {grandTotal} {t("campaignTooltipEmails")} · {t("campaignTooltipVisible")}</div>
                        </>}
                      >
                        <span
                          className="flex h-full w-full items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums sm:text-sm"
                          style={{
                            backgroundColor: style.background,
                            color: style.color,
                          }}
                        >
                          {n}
                        </span>

                      </Tooltip>
                    </td>
                  );
                })}

                <td className="border-l border-[var(--border-default)]/80 px-2 py-2 text-center font-mono font-bold text-[var(--text-primary)] tabular-nums">
                  <span className="inline-block rounded px-1.5 py-0.5 bg-[var(--surface-subtle)]/80">
                    {b.total}
                  </span>
                </td>
              </tr>
            ))}

            {/* Bottom Total Row */}
            <tr className="border-t-2 border-[var(--border-default)] bg-[var(--surface-subtle)]/90 font-semibold text-[var(--text-primary)]">
              <th scope="row" className="py-2.5 pl-3 pr-2 text-left font-bold">{t("campaignTotal")}</th>
              {data.weekTotals.map((n, i) => (
                <td
                  key={i}
                  className="px-2 py-2.5 text-center font-mono font-bold tabular-nums"
                >
                  {n}
                </td>
              ))}
              <td className="border-l border-[var(--border-default)]/80 px-2 py-2.5 text-center font-mono font-bold text-[var(--accent-ink)] tabular-nums">
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-secondary)]" aria-label={t("campaignLegendAriaLabel")}>
        <span>{t("campaignVolumeLabel")}</span>
        {HEATMAP_LEVELS.map((level) => (
          <span key={level.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-4 rounded-sm" style={{ background: level.background }} />
            {level.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{t("campaignFooterNote")}</p>
    </Card>
  );
}
