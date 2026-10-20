import { useMemo, useState } from "react";
import type { Brand } from "../data";
import { useLocale } from "../i18n";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  aggregateThreeWeek,
  buildAggregatedBrand,
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

interface BrandThemeBreakdownProps {
  onSelectBrand: (brand: Brand) => void;
}

export function BrandThemeBreakdown({ onSelectBrand }: BrandThemeBreakdownProps) {
  const { t } = useLocale();
  const themeName = (theme: { key: string; labelZh: string }) =>
    THEME_LABEL_KEYS[theme.key] ? t(THEME_LABEL_KEYS[theme.key]) : theme.labelZh;
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [pinnedTheme, setPinnedTheme] = useState<string | null>(null);
  const highlightedTheme = previewTheme ?? pinnedTheme;
  const { status, emails, total, error, retry, meta } = useSiteEmails();
  const { market, setMarket } = useSiteSelection();
  const data = useMemo(
    () => (status === "ready" ? aggregateThreeWeek(emails) : null),
    [status, emails],
  );

  const hint = data
    ? `${meta.market} · ${t("btbHintRealtime")}${formatWindowRange(data.window)}${t("btbHintTotalPart")}${data.total}${t("btbHintDiffPart")}${meta.total}${t("btbHintDescPart")}`
    : `${meta.market} · ${t("btbHintRealtime")}${formatWindowRange(THREE_WEEK_WINDOW)}${t("btbHintFallback")}`;

  if (status !== "ready" || !data) {
    return (
      <Card title={t("btbTitle")} hint={hint}>
        <ExtendedEmailsState status={status} total={total} error={error} retry={retry} meta={meta} />
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <Card title={t("btbTitle")} hint={hint}>
        <div className={EMPTY_STATE_CLASS_NAME}>
          <EmptyState
            title={t("btbEmptyTitle")}
            description={t("btbEmptyDesc")}
            actionLabel={market === null ? t("btbRetry") : t("btbSwitchAll")}
            onAction={market === null ? retry : () => setMarket(null)}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={t("btbTitle")}
      hint={hint}
    >
      <p className="mb-3 text-xs leading-5 text-[var(--text-secondary)]">{t("btbNote")}</p>
      <div onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPinnedTheme(null);
          setPreviewTheme(null);
        }
      }}>
      <div
        className="-mt-1 mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-600"
        role="group"
        aria-label={t("btbLegendAria")}
      >
        {data.themes
          .filter((theme) => theme.count > 0)
          .map((theme) => {
          const isHighlighted = highlightedTheme === theme.key;
          return (
            <button
              type="button"
              key={theme.key}
              aria-pressed={pinnedTheme === theme.key}
              onClick={() => {
                setPinnedTheme((previous) => previous === theme.key ? null : theme.key);
                setPreviewTheme(null);
              }}
              onMouseEnter={() => setPreviewTheme(theme.key)}
              onMouseLeave={() => setPreviewTheme(null)}
              onFocus={() => setPreviewTheme(theme.key)}
              onBlur={() => setPreviewTheme(null)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${
                isHighlighted
                  ? "border-[var(--control-focus)] bg-[var(--surface-subtle)] font-semibold text-[var(--text-heading)]"
                  : "border-[var(--border-default)] text-[var(--text-body)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: themeColor(theme.key) }}
              />
              <span>{themeName(theme)}</span>
              {pinnedTheme === theme.key ? <span className="text-xs">{t("btbPinned")}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex justify-between text-xs text-[var(--text-secondary)]" aria-hidden="true"><span>{t("btbAxisLeft")}</span><span>{t("btbAxisRight")}</span></div>
      <div className="space-y-3.5">
        {data.brands.map((b) => {
          // Sort brand's themes by count descending to match visual layout
          const segs = data.themes
            .filter((t) => (b.themes[t.key] || 0) > 0)
            .map((t) => ({
              ...t,
              themeCount: b.themes[t.key],
              pct: Math.round((b.themes[t.key] / b.total) * 100),
              widthPct: (b.themes[t.key] / b.total) * 100,
            }))
            .sort((a, b) => b.themeCount - a.themeCount);

          return (
            <div key={b.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 sm:flex sm:gap-3">
              {/* Brand button with keyboard navigation */}
              <button
                type="button"
                className="min-h-11 w-fit shrink-0 rounded-md px-1 py-0.5 text-left text-xs font-semibold text-[var(--text-body)] transition hover:bg-[var(--accent-tint)] hover:text-[var(--accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] sm:w-22 sm:text-sm"
                onClick={() => onSelectBrand(buildAggregatedBrand(data, b.name))}
              >
                {b.name}
              </button>

              {/* Segmented Bar */}
              <div className="relative order-3 col-span-2 flex h-8 min-w-0 flex-1 rounded-lg bg-slate-100 sm:order-none">
                {segs.map((seg, index) => {
                  const isSingle = segs.length === 1;
                  const isFirst = index === 0;
                  const isLast = index === segs.length - 1;

                  // Precise corner rounding on segments
                  const roundingClass = isSingle
                    ? "rounded-lg"
                    : isFirst
                      ? "rounded-l-lg"
                      : isLast
                        ? "rounded-r-lg"
                        : "rounded-none";

                  const isThemeDimmed =
                    highlightedTheme !== null && highlightedTheme !== seg.key;
                  const textColor = isThemeDimmed ? "var(--theme-label-dark)" : themeLabelColor(seg.key);

                  return (
                    <Tooltip
                      key={seg.key}
                      className={`relative h-full hover:z-10 hover:ring-2 hover:ring-[var(--control-focus)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--control-focus)] ${roundingClass}`}
                      style={{ width: `${seg.widthPct}%` }}
                      label={t("btbSegLabel").replace("{brand}", b.name).replace("{theme}", themeName(seg)).replace("{count}", String(seg.themeCount)).replace("{pct}", String(seg.pct)).replace("{total}", String(b.total))}
                      content={<>
                        <div className="font-semibold">{b.name} · {themeName(seg)}</div>
                        <div className="mt-1 font-mono font-bold">{seg.themeCount} {t("marketUnitEmails")} · {t("btbBrandShare")} {seg.pct}%</div>
                        <div className="mt-1">{meta.market} · {formatWindowRange(data.window)} · {t("btbDenominator")} {b.total} {t("marketUnitEmails")}</div>
                      </>}
                    >
                      <div
                        className={`flex h-full w-full items-center justify-center border-r border-[var(--surface-card)] transition-colors ${roundingClass} ${
                          isLast ? "border-r-0" : ""
                        }`}
                        style={{
                          backgroundColor: isThemeDimmed
                            ? `color-mix(in srgb, ${themeColor(seg.key)} 25%, var(--surface-card))`
                            : themeColor(seg.key),
                        }}
                      >
                        {/* Only show percentage when wide enough to prevent overlap/clipping */}
                        {seg.widthPct >= 14 ? (
                          <span
                            className="select-none px-1 font-mono text-xs font-bold"
                            style={{ color: textColor }}
                          >
                            {seg.pct}%
                          </span>
                        ) : null}
                      </div>

                    </Tooltip>
                  );
                })}
              </div>

              {/* Total volume label */}
              <div className="w-11 shrink-0 text-right font-mono text-xs font-semibold text-slate-600 tabular-nums sm:w-12">
                {b.total} {t("marketUnitEmails")}
              </div>

              {b.total === 0 ? <p className="order-4 col-span-2 text-xs text-[var(--text-secondary)] sm:sr-only">{t("btbZeroNote")}</p> : null}
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}
