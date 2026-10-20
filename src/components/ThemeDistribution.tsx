import { useMemo, useState } from "react";
import { useLocale } from "../i18n";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  aggregateThreeWeek,
  formatWindowRange,
  themeColor,
  themeLabelColor,
  THREE_WEEK_WINDOW,
} from "../three-week-aggregation";
import { Card } from "./Card";
import { THEME_LABEL_KEYS } from "./dashboard";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { Tooltip } from "./Tooltip";

const EMPTY_STATE_CLASS_NAME =
  "[&>div]:border-[var(--border-default)] [&>div]:bg-[var(--surface-card)] [&_[aria-hidden]]:border-[var(--border-default)] [&_[aria-hidden]]:bg-[var(--surface-subtle)] [&_[aria-hidden]]:text-[var(--text-secondary)] [&_h3]:text-[var(--text-heading)] [&_p]:text-[var(--text-secondary)] [&_button]:bg-[var(--text-heading)] [&_button]:text-[var(--text-inverse)] [&_button:hover]:bg-[var(--text-body)] [&_button:focus-visible]:ring-[var(--accent-ink)] [&_button:focus-visible]:ring-offset-[var(--surface-card)]";

function slicePath(start: number, end: number) {
  const point = (radius: number, angle: number) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return `${120 + radius * Math.cos(radians)} ${120 + radius * Math.sin(radians)}`;
  };
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${point(108, start)} A 108 108 0 ${largeArc} 1 ${point(108, end)} L ${point(60, end)} A 60 60 0 ${largeArc} 0 ${point(60, start)} Z`;
}

export function ThemeDistribution() {
  const { t } = useLocale();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const { status, emails, total: emailTotal, error, retry, meta } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );
  const themeName = (theme: { key: string; labelZh: string }) =>
    THEME_LABEL_KEYS[theme.key] ? t(THEME_LABEL_KEYS[theme.key]) : theme.labelZh;
  const hint = data
    ? `${meta.market} · ${t("tdHintRealtime")}${formatWindowRange(data.window)}${t("tdHintTotalPart")}${data.total}${t("tdHintDiffPart")}${meta.total}${t("tdHintDescPart")}`
    : `${meta.market} · ${t("tdHintRealtime")}${formatWindowRange(THREE_WEEK_WINDOW)}${t("tdHintFallback")}`;

  if (status !== "ready" || !data) {
    return (
      <Card title={t("tdTitle")} hint={hint}>
        <ExtendedEmailsState status={status} total={emailTotal} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }
  if (data.total === 0) {
    return (
      <Card title={t("tdTitle")} hint={hint}>
        <div className={EMPTY_STATE_CLASS_NAME}>
          <EmptyState
            title={t("tdEmptyTitle")}
            description={t("tdEmptyDesc")}
            actionLabel={market === null ? t("tdRetry") : t("tdSwitchAll")}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      </Card>
    );
  }

  let currentAngle = 0;
  const slices = data.themes.filter((theme) => theme.count > 0).map((theme) => {
    const start = currentAngle;
    const span = theme.count / data.total * 360;
    currentAngle += span;
    const middle = ((start + span / 2 - 90) * Math.PI) / 180;
    return { theme, start, end: currentAngle, span, x: 120 + 84 * Math.cos(middle), y: 120 + 84 * Math.sin(middle) };
  });
  const active = slices.find((slice) => slice.theme.key === hoveredKey)?.theme;
  const activeName = active ? themeName(active) : null;
  const centerLabel = activeName && activeName.length > 8 ? `${activeName.slice(0, 7)}…` : activeName;
  const chartLabel = t("tdChartLabel")
    .replace("{market}", meta.market)
    .replace("{range}", formatWindowRange(data.window))
    .replace("{total}", String(data.total))
    .replace("{parts}", slices.map(({ theme }) => t("tdChartPart").replace("{label}", themeName(theme)).replace("{count}", String(theme.count)).replace("{pct}", String(theme.pct))).join("；"));
  const sliceAria = (theme: { key: string; labelZh: string; count: number; pct: number }) =>
    t("tdSliceAria").replace("{label}", themeName(theme)).replace("{count}", String(theme.count)).replace("{pct}", String(theme.pct));

  return (
    <Card title={t("tdTitle")} hint={hint}>
      <div
        className="flex flex-col items-center"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") setHoveredKey(null);
        }}
      >
        <Tooltip
          className="my-1 w-full max-w-64 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
          label={chartLabel}
          onOpenChange={(open) => {
            if (!open) setHoveredKey(null);
          }}
          content={<>
            <div className="font-semibold">{activeName ?? t("tdAllThemes")} · {meta.market}</div>
            <div className="mt-1 font-mono font-bold">{active?.count ?? data.total} {t("marketUnitEmails")} · {t("tdTooltipShare")} {active?.pct ?? 100}%</div>
            <div className="mt-1">{formatWindowRange(data.window)} · {t("tdDenominator")} {data.total} {t("marketUnitEmails")} · {t("tdVisible")}</div>
          </>}
        >
          <svg viewBox="0 0 240 240" className="h-auto w-full" role="group" aria-label={t("tdSliceGroupAria")}>
            {slices.map(({ theme, start, end, span, x, y }) => {
              const inspected = theme.key === hoveredKey;
              const dimmed = Boolean(active) && !inspected;
              const fill = dimmed ? `color-mix(in srgb, ${themeColor(theme.key)} 25%, var(--surface-card))` : themeColor(theme.key);
              return (
                <a
                  key={theme.key}
                  href={`#emails/${encodeURIComponent(theme.key)}`}
                  tabIndex={0}
                  aria-label={sliceAria(theme)}
                  onMouseEnter={() => setHoveredKey(theme.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(theme.key)}
                  onBlur={() => setHoveredKey(null)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      window.location.hash = `#emails/${encodeURIComponent(theme.key)}`;
                    }
                  }}
                  className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)]"
                >
                  {slices.length === 1 ? (
                    <circle cx="120" cy="120" r="84" fill="none" stroke={fill} strokeWidth="48" />
                  ) : (
                    <path d={slicePath(start, end)} fill={fill} stroke={inspected ? "var(--control-focus)" : "var(--surface-card)"} strokeWidth="2" />
                  )}
                  {span >= 25 ? (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={dimmed ? "var(--theme-label-dark)" : themeLabelColor(theme.key)} className="pointer-events-none select-none text-xs font-bold">
                      {theme.pct}%
                    </text>
                  ) : null}
                </a>
              );
            })}
            <text x="120" y="110" textAnchor="middle" className="pointer-events-none fill-[var(--text-heading)] font-mono text-3xl font-bold">{active?.count ?? data.total}</text>
            <text x="120" y="137" textAnchor="middle" className="pointer-events-none fill-[var(--text-secondary)] text-xs">{active ? `${centerLabel} ${active.pct}%` : t("tdCenterAll")}</text>
          </svg>
        </Tooltip>
        <div className="chart-legend mt-3 grid w-full gap-2 text-sm" role="group" aria-label={t("tdLegendAria")}>
          {slices.map(({ theme }) => (
            <a
              key={theme.key}
              href={`#emails/${encodeURIComponent(theme.key)}`}
              onMouseEnter={() => setHoveredKey(theme.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onFocus={() => setHoveredKey(theme.key)}
              onBlur={() => setHoveredKey(null)}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${hoveredKey === theme.key ? "border-[var(--control-focus)] bg-[var(--surface-subtle)]" : "border-[var(--border-default)] hover:border-[var(--control-focus)]"}`}
              aria-label={sliceAria(theme)}
            >
              <span className="flex min-w-0 items-center gap-2 text-[var(--text-body)]">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: themeColor(theme.key) }} />
                <span className="break-words font-semibold">{themeName(theme)}</span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]"><strong className="text-[var(--text-heading)]">{theme.count} {t("marketUnitEmails")}</strong> · {theme.pct}%</span>
            </a>
          ))}
        </div>
        <p className="mt-3 w-full text-xs leading-5 text-[var(--text-secondary)]">{t("tdFooterNote")}</p>
      </div>
    </Card>
  );
}
